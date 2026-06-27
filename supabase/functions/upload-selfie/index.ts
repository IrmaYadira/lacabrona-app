import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 2.5 MB maximo de payload (base64 string) — suficiente para una foto de ~1.8MB reales
const MAX_PAYLOAD_BYTES = 2_621_440;

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteString = atob(base64);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeType });
}

function estimateDecodedSize(base64: string): number {
  // base64 crece ~33% respecto al binario, asi que el tamaño decodificado ≈ base64.length * 0.75
  return Math.ceil(base64.length * 0.75);
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

    // ── Validacion temprana de tamaño de body ──
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_BYTES) {
      return new Response(
        JSON.stringify({
          error: "La imagen es demasiado grande. Usa una foto de maximo 2.5 MB.",
          code: "payload_too_large",
        }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let body: { dataUrl?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "El cuerpo de la peticion no es JSON valido.", code: "invalid_json" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const dataUrl: string = body.dataUrl ?? "";

    if (!dataUrl || !dataUrl.startsWith("data:image")) {
      return new Response(
        JSON.stringify({ error: "Se requiere una imagen data URL valida.", code: "invalid_data_url" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parts = dataUrl.split(",");
    if (parts.length < 2) {
      return new Response(
        JSON.stringify({ error: "Formato de imagen invalido.", code: "invalid_data_url" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const meta = parts[0];
    const base64Data = parts[1];

    // Validar tamaño de la imagen decodificada
    const decodedSize = estimateDecodedSize(base64Data);
    if (decodedSize > 2_097_152) {
      return new Response(
        JSON.stringify({
          error: "La imagen es demasiado grande despues de decodificar. Usa una foto mas pequeña.",
          code: "image_too_large",
        }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mimeMatch = meta.match(/:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";

    // Solo aceptar formatos de imagen
    const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedMimes.includes(mimeType)) {
      return new Response(
        JSON.stringify({ error: `Formato no soportado: ${mimeType}. Usa JPEG, PNG o WebP.`, code: "unsupported_mime" }),
        { status: 415, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let blob: Blob;
    try {
      blob = base64ToBlob(base64Data, mimeType);
    } catch {
      return new Response(
        JSON.stringify({ error: "No se pudo decodificar la imagen. Intenta con otra foto.", code: "decode_error" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ext = mimeType.split("/")[1] || "jpg";
    const path = `selfies/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;

    // Asegurar que el bucket existe con los limites correctos
    try {
      const { data: buckets } = await supabaseAdmin.storage.listBuckets();
      const bucket = buckets?.find((b: { name: string }) => b.name === "waiter-selfies");
      if (!bucket) {
        await supabaseAdmin.storage.createBucket("waiter-selfies", {
          public: true,
          fileSizeLimit: 2_097_152,
          allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
        });
      } else if (!bucket.file_size_limit || !bucket.allowed_mime_types) {
        await supabaseAdmin.storage.updateBucket("waiter-selfies", {
          public: true,
          fileSizeLimit: 2_097_152,
          allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
        });
      }
    } catch (bucketErr) {
      console.error("Bucket setup error:", bucketErr);
      // Si falla actualizar el bucket, intentamos el upload de todos modos
    }

    const { error: uploadError } = await supabaseAdmin.storage
      .from("waiter-selfies")
      .upload(path, blob, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      let message = uploadError.message;
      let code = "upload_error";

      if (message.includes("Payload too large") || message.includes("exceed")) {
        message = "La foto es demasiado grande para el servidor. Usa una imagen mas pequeña.";
        code = "storage_too_large";
      } else if (message.includes("duplicate") || message.includes("already exists")) {
        message = "Conflicto al guardar la imagen. Intenta de nuevo.";
        code = "storage_duplicate";
      }

      return new Response(
        JSON.stringify({ error: message, code }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: urlData } = supabaseAdmin.storage
      .from("waiter-selfies")
      .getPublicUrl(path);

    return new Response(
      JSON.stringify({ url: urlData.publicUrl, path }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = (err as Error).message || "Error desconocido";
    let code = "internal_error";

    if (message.includes("timeout") || message.includes("abort")) {
      code = "timeout";
    }

    return new Response(
      JSON.stringify({ error: message, code }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
