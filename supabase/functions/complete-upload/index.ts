import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const MEDIA_TYPES = new Set(["image", "video"]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CompleteUploadRequest = {
  eventSlug?: unknown;
  storageKey?: unknown;
  originalFilename?: unknown;
  mimeType?: unknown;
  mediaType?: unknown;
  sizeBytes?: unknown;
  publicUrl?: unknown;
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

function validatePayload(payload: CompleteUploadRequest) {
  const {
    eventSlug,
    storageKey,
    originalFilename,
    mimeType,
    mediaType,
    sizeBytes,
    publicUrl,
  } = payload;

  if (typeof eventSlug !== "string" || eventSlug.trim() === "") {
    return { error: "eventSlug is required." };
  }

  if (typeof storageKey !== "string" || storageKey.trim() === "") {
    return { error: "storageKey is required." };
  }

  if (typeof originalFilename !== "string" || originalFilename.trim() === "") {
    return { error: "originalFilename is required." };
  }

  if (typeof mimeType !== "string" || mimeType.trim() === "") {
    return { error: "mimeType is required." };
  }

  if (typeof mediaType !== "string" || !MEDIA_TYPES.has(mediaType)) {
    return { error: "mediaType must be either image or video." };
  }

  if (typeof sizeBytes !== "number" || !Number.isInteger(sizeBytes) || sizeBytes <= 0) {
    return { error: "sizeBytes is required and must be a positive integer." };
  }

  if (typeof publicUrl !== "string" || publicUrl.trim() === "") {
    return { error: "publicUrl is required." };
  }

  const normalizedEventSlug = eventSlug.trim();
  const normalizedStorageKey = storageKey.trim();
  const requiredPrefix = `events/${normalizedEventSlug}/originals/`;

  // Prevent clients from registering files under a different event path.
  if (!normalizedStorageKey.startsWith(requiredPrefix)) {
    return { error: "storageKey does not match the event." };
  }

  return {
    data: {
      eventSlug: normalizedEventSlug,
      storageKey: normalizedStorageKey,
      originalFilename: originalFilename.trim(),
      mimeType: mimeType.trim().toLowerCase(),
      mediaType,
      sizeBytes,
      publicUrl: publicUrl.trim(),
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed.", 405);
  }

  let payload: CompleteUploadRequest;

  try {
    payload = await req.json();
  } catch {
    return errorResponse("Request body must be valid JSON.");
  }

  const validation = validatePayload(payload);

  if ("error" in validation) {
    return errorResponse(validation.error);
  }

  const {
    eventSlug,
    storageKey,
    originalFilename,
    mimeType,
    mediaType,
    sizeBytes,
    publicUrl,
  } = validation.data;

  try {
    const supabase = createAdminClient();

    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id")
      .eq("slug", eventSlug)
      .maybeSingle();

    if (eventError) {
      console.error("Failed to look up event", {
        message: eventError.message,
        code: eventError.code,
        details: eventError.details,
      });
      return errorResponse(`Failed to look up event: ${eventError.message}`, 500);
    }

    if (!event) {
      return errorResponse("Event not found.", 404);
    }

    const { data: media, error: insertError } = await supabase
      .from("media")
      .insert({
        event_id: event.id,
        storage_key: storageKey,
        original_filename: originalFilename,
        mime_type: mimeType,
        media_type: mediaType,
        size_bytes: sizeBytes,
        public_url: publicUrl,
      })
      .select("id, event_id, storage_key, public_url, media_type, created_at")
      .single();

    if (insertError) {
      console.error("Failed to insert media", {
        message: insertError.message,
        code: insertError.code,
        details: insertError.details,
      });
      return errorResponse(`Failed to insert media: ${insertError.message}`, 500);
    }

    return jsonResponse({
      success: true,
      data: media,
    });
  } catch (error) {
    console.error("Failed to complete upload", error);
    return errorResponse("Failed to complete upload.", 500);
  }
});
