import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteString = atob(base64);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeType });
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

    if (!dataUrl || !dataUrl.startsWith("data:image")) {
      return new Response(
        JSON.stringify({ error: "Se requiere una imagen data URL válida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parts = dataUrl.split(",");
    const meta = parts[0];
    const base64Data = parts[1];
    const mimeMatch = meta.match(/:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";

    const blob = base64ToBlob(base64Data, mimeType);
    const ext = mimeType.split("/")[1] || "jpg";
    const path = `receipts/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;

    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    const exists = buckets?.some((b: { name: string }) => b.name === "payment-receipts");
    if (!exists) {
      await supabaseAdmin.storage.createBucket("payment-receipts", {
        public: true,
        fileSizeLimit: 5242880,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      });
    }

    const { error: uploadError } = await supabaseAdmin.storage
      .from("payment-receipts")
      .upload(path, blob, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      return new Response(
        JSON.stringify({ error: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: urlData } = supabaseAdmin.storage
      .from("payment-receipts")
      .getPublicUrl(path);

    return new Response(
      JSON.stringify({ url: urlData.publicUrl, path }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
