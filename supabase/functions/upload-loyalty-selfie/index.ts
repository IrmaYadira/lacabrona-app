import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const dataUrl: string = body.dataUrl ?? "";
    const customerId: number | null = body.customerId != null ? Number(body.customerId) : null;

    console.log(`[upload-loyalty-selfie] START customerId=${customerId}`);

    if (!dataUrl || !dataUrl.startsWith("data:image")) {
      return new Response(
        JSON.stringify({ error: "Se requiere una imagen data URL válida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parsear data URL
    const commaIdx = dataUrl.indexOf(",");
    const meta = dataUrl.substring(0, commaIdx);
    const base64Data = dataUrl.substring(commaIdx + 1);
    const mimeMatch = meta.match(/:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
    const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "jpg";

    const timestamp = Date.now();
    const filename = customerId
      ? `loyalty_${customerId}_${timestamp}.${ext}`
      : `loyalty_anon_${timestamp}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const path = `loyalty-selfies/${filename}`;

    // Asegurar que el bucket existe
    const BUCKET = "waiter-selfies";
    try {
      const { data: buckets } = await supabaseAdmin.storage.listBuckets();
      const bucketExists = buckets?.some((b: { name: string }) => b.name === BUCKET);
      if (!bucketExists) {
        const { error: bucketErr } = await supabaseAdmin.storage.createBucket(BUCKET, {
          public: true,
          fileSizeLimit: 5242880, // 5MB
          allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
        });
        if (bucketErr) {
          console.error("[upload-loyalty-selfie] bucket create error:", bucketErr.message);
        } else {
          console.log(`[upload-loyalty-selfie] bucket '${BUCKET}' created`);
        }
      }
    } catch (bucketCheckErr) {
      console.error("[upload-loyalty-selfie] bucket check error:", (bucketCheckErr as Error).message);
    }

    // Convertir base64 a Uint8Array
    const imageBytes = base64ToUint8Array(base64Data);

    // Subir con upsert:true para evitar errores si el archivo existe
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, imageBytes, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      console.error("[upload-loyalty-selfie] upload error:", uploadError.message);
      return new Response(
        JSON.stringify({ error: `Error al subir imagen: ${uploadError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Obtener URL pública limpia (sin cache-bust — la guardamos limpia en BD)
    const { data: urlData } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(path);

    const cleanUrl = urlData.publicUrl;
    // URL con cache-bust SOLO para retornar al frontend (no para guardar en BD)
    const publicUrlWithCacheBust = `${cleanUrl}?t=${timestamp}`;

    console.log(`[upload-loyalty-selfie] uploaded OK to: ${cleanUrl}`);

    // Actualizar selfie_url en pos_customers con URL LIMPIA (sin cache-bust)
    if (customerId) {
      const { error: updateError, data: updateData } = await supabaseAdmin
        .from("pos_customers")
        .update({
          selfie_url: cleanUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", customerId)
        .select("id, selfie_url");

      if (updateError) {
        console.error("[upload-loyalty-selfie] DB update error:", updateError.message, updateError.details);
        // Aunque falle el UPDATE, devolvemos la URL para que el frontend la muestre localmente
        return new Response(
          JSON.stringify({ url: publicUrlWithCacheBust, path, warning: `DB update failed: ${updateError.message}` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        console.log(`[upload-loyalty-selfie] DB updated OK for customer ${customerId}:`, JSON.stringify(updateData));
      }
    }

    return new Response(
      JSON.stringify({ url: publicUrlWithCacheBust, path }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[upload-loyalty-selfie] unexpected error:", (err as Error).message);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
