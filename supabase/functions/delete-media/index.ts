import "@supabase/functions-js/edge-runtime.d.ts";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type DeleteMediaRequest = {
  mediaId?: unknown;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: corsHeaders,
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ success: false, error: message }, status);
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function isAuthorized(req: Request) {
  return req.headers.get("x-admin-token") === requiredEnv("ADMIN_TOKEN");
}

function getSupabaseSecretKey() {
  let secretKeys: Record<string, string> = {};
  const secretKeysEnv = Deno.env.get("SUPABASE_SECRET_KEYS");

  if (secretKeysEnv) {
    try {
      secretKeys = JSON.parse(secretKeysEnv);
    } catch (error) {
      console.error("Failed to parse SUPABASE_SECRET_KEYS", error);
    }
  }

  return secretKeys.default ?? (!secretKeysEnv ? Deno.env.get("SERVICE_ROLE_KEY") : undefined);
}

function createAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const secretKey = getSupabaseSecretKey();

  if (!supabaseUrl) {
    throw new Error("Missing required environment variable: SUPABASE_URL");
  }

  if (!secretKey) {
    throw new Error("Missing Supabase secret key.");
  }

  return createClient(
    supabaseUrl,
    secretKey,
    {
      global: {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          apikey: secretKey,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

function createR2Client() {
  return new S3Client({
    region: "auto",
    endpoint: requiredEnv("R2_ENDPOINT"),
    credentials: {
      accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
}

function validatePayload(payload: DeleteMediaRequest) {
  const { mediaId } = payload;

  if (typeof mediaId !== "string" || mediaId.trim() === "") {
    return { error: "mediaId is required." };
  }

  return { data: { mediaId: mediaId.trim() } };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed.", 405);
  }

  if (!isAuthorized(req)) {
    return errorResponse("Unauthorized", 401);
  }

  let payload: DeleteMediaRequest;

  try {
    payload = await req.json();
  } catch {
    return errorResponse("Request body must be valid JSON.");
  }

  const validation = validatePayload(payload);

  if ("error" in validation) {
    return errorResponse(validation.error);
  }

  const { mediaId } = validation.data;

  try {
    const supabase = createAdminClient();

    const { data: media, error: mediaError } = await supabase
      .from("media")
      .select("id, storage_key")
      .eq("id", mediaId)
      .maybeSingle();

    if (mediaError) {
      console.error("Failed to look up media", {
        message: mediaError.message,
        code: mediaError.code,
        details: mediaError.details,
      });
      return errorResponse(`Failed to look up media: ${mediaError.message}`, 500);
    }

    if (!media) {
      return errorResponse("Media not found.", 404);
    }

    const storageKey = media.storage_key;

    if (!storageKey) {
      return errorResponse("Media row is missing storage_key.", 500);
    }

    // Delete from R2 first so the database row remains available if object deletion fails.
    const r2 = createR2Client();
    await r2.send(new DeleteObjectCommand({
      Bucket: requiredEnv("R2_BUCKET_NAME"),
      Key: storageKey,
    }));

    const { error: deleteError } = await supabase
      .from("media")
      .delete()
      .eq("id", mediaId);

    if (deleteError) {
      console.error("Failed to delete media row", {
        message: deleteError.message,
        code: deleteError.code,
        details: deleteError.details,
      });
      return errorResponse(`Failed to delete media row: ${deleteError.message}`, 500);
    }

    return jsonResponse({
      success: true,
      data: {
        deletedMediaId: media.id,
        deletedStorageKey: storageKey,
      },
    });
  } catch (error) {
    console.error("Failed to delete media", error);
    return errorResponse("Failed to delete media.", 500);
  }
});
