import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import webpush from 'https://esm.sh/web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch (parseErr) {
      console.error('[send-push-notification] JSON parse error:', parseErr);
      return response({ error: 'Invalid JSON body' }, 400);
    }

    const { account_id, title, body: messageBody, tag = 'la-cabrona-default', data = {}, actions = [] } = body;

    if (!account_id || !title || !messageBody) {
      console.warn('[send-push-notification] Missing fields:', { account_id, title, messageBody });
      return response({ error: 'Missing account_id, title, or body' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !serviceKey) {
      console.error('[send-push-notification] Missing env vars');
      return response({ error: 'Server configuration error' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Get VAPID keys
    const { data: keys, error: keysError } = await supabase
      .from('push_vapid_keys')
      .select('public_key, private_key')
      .eq('id', 1)
      .maybeSingle();

    if (keysError) {
      console.error('[send-push-notification] VAPID keys query error:', keysError);
      return response({ error: 'VAPID keys query failed', detail: keysError.message }, 500);
    }

    if (!keys) {
      console.error('[send-push-notification] VAPID keys not found');
      return response({ error: 'VAPID keys not configured' }, 500);
    }

    try {
      webpush.setVapidDetails(
        'mailto:contacto@barlacabrona.com',
        keys.public_key,
        keys.private_key,
      );
    } catch (vapidErr) {
      console.error('[send-push-notification] VAPID setup error:', vapidErr);
      return response({ error: 'VAPID setup failed', detail: String(vapidErr) }, 500);
    }

    // Get subscriptions for this account
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('account_id', account_id);

    if (subError) {
      console.error('[send-push-notification] Subscriptions query error:', subError);
      return response({ error: 'Subscriptions query failed', detail: subError.message }, 500);
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('[send-push-notification] No subscriptions for account_id:', account_id);
      return response({ sent: 0, total: 0, message: 'No push subscriptions found for this account' });
    }

    const payload = JSON.stringify({ title, body: messageBody, tag, data, actions });
    const results: Array<{ id: number; success: boolean; error?: string }> = [];
    const expiredIds: number[] = [];

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload,
        );
        results.push({ id: sub.id, success: true });
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          expiredIds.push(sub.id);
        }
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ id: sub.id, success: false, error: msg });
      }
    }

    // Clean up expired subscriptions
    if (expiredIds.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', expiredIds);
    }

    // Update last_used_at for successful ones
    const successIds = results.filter(r => r.success).map(r => r.id);
    if (successIds.length > 0) {
      await supabase
        .from('push_subscriptions')
        .update({ last_used_at: new Date().toISOString() })
        .in('id', successIds);
    }

    console.log('[send-push-notification] Result:', {
      account_id,
      sent: successIds.length,
      total: subscriptions.length,
      cleaned: expiredIds.length,
    });

    return response({
      sent: successIds.length,
      total: subscriptions.length,
      cleaned: expiredIds.length,
      results,
    });
  } catch (err) {
    console.error('[send-push-notification] Fatal error:', err);
    return response({ error: 'Internal error', detail: String(err) }, 500);
  }
});