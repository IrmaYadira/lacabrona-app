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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get or generate VAPID keys
    let { data: keys } = await supabase
      .from('push_vapid_keys')
      .select('public_key, private_key')
      .eq('id', 1)
      .maybeSingle();

    if (!keys) {
      const vapidKeys = webpush.generateVAPIDKeys();
      const { error: insertError } = await supabase
        .from('push_vapid_keys')
        .insert({
          id: 1,
          public_key: vapidKeys.publicKey,
          private_key: vapidKeys.privateKey,
        });

      if (insertError) {
        // Another worker might have inserted concurrently, try fetching again
        const { data: retryKeys } = await supabase
          .from('push_vapid_keys')
          .select('public_key, private_key')
          .eq('id', 1)
          .maybeSingle();
        keys = retryKeys ?? null;
      } else {
        keys = { public_key: vapidKeys.publicKey, private_key: vapidKeys.privateKey };
      }
    }

    if (!keys) {
      return response({ error: 'Failed to generate or retrieve VAPID keys' }, 500);
    }

    return response({ publicKey: keys.public_key });
  } catch (err) {
    console.error('[get-vapid-public-key] Error:', err);
    return response({ error: 'Internal error' }, 500);
  }
});
