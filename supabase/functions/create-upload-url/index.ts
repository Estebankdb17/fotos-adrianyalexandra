import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
]);

const MAX_IMAGE_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_SIZE_BYTES = 300 * 1024 * 1024;
const UPLOAD_URL_EXPIRES_IN_SECONDS = 10 * 60;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type UploadRequest = {
  eventSlug?: unknown;
  filename?: unknown;
  mimeType?: unknown;
  sizeBytes?: unknown;
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

function sanitizeFilename(filename: string) {
  const basename = filename.split(/[\\/]/).pop() ?? "upload";
  const sanitized = basename
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 120);

  return sanitized || "upload";
}

function encodeStorageKey(storageKey: string) {
  return storageKey.split("/").map(encodeURIComponent).join("/");
}

function buildPublicUrl(storageKey: string) {
  const publicBaseUrl = Deno.env.get("R2_PUBLIC_URL")?.replace(/\/+$/, "");

  if (publicBaseUrl) {
    return `${publicBaseUrl}/${encodeStorageKey(storageKey)}`;
  }

  const endpoint = requiredEnv("R2_ENDPOINT").replace(/\/+$/, "");
  const bucketName = requiredEnv("R2_BUCKET_NAME");

  return `${endpoint}/${encodeURIComponent(bucketName)}/${encodeStorageKey(storageKey)}`;
}

function validatePayload(payload: UploadRequest) {
  const { eventSlug, filename, mimeType, sizeBytes } = payload;

  if (typeof eventSlug !== "string" || eventSlug.trim() === "") {
    return { error: "eventSlug is required." };
  }

  if (typeof filename !== "string" || filename.trim() === "") {
    return { error: "filename is required." };
  }

  if (typeof mimeType !== "string" || mimeType.trim() === "") {
    return { error: "mimeType is required." };
  }

  if (typeof sizeBytes !== "number" || !Number.isInteger(sizeBytes) || sizeBytes <= 0) {
    return { error: "sizeBytes is required and must be a positive integer." };
  }

  const normalizedMimeType = mimeType.toLowerCase();
  const isImage = IMAGE_MIME_TYPES.has(normalizedMimeType);
  const isVideo = VIDEO_MIME_TYPES.has(normalizedMimeType);

  if (!isImage && !isVideo) {
    return { error: "Unsupported MIME type." };
  }

  if (isImage && sizeBytes > MAX_IMAGE_SIZE_BYTES) {
    return { error: "Image exceeds the 25 MB size limit." };
  }

  if (isVideo && sizeBytes > MAX_VIDEO_SIZE_BYTES) {
    return { error: "Video exceeds the 300 MB size limit." };
  }

  return {
    data: {
      eventSlug: eventSlug.trim(),
      filename: filename.trim(),
      mimeType: normalizedMimeType,
      mediaType: isImage ? "image" : "video",
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

  let payload: UploadRequest;

  try {
    payload = await req.json();
  } catch {
    return errorResponse("Request body must be valid JSON.");
  }

  const validation = validatePayload(payload);

  if ("error" in validation) {
    return errorResponse(validation.error);
  }

  const { eventSlug, filename, mimeType, mediaType } = validation.data;

  try {
    const secretKeysEnv = Deno.env.get("SUPABASE_SECRET_KEYS");
    const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    const defaultSecretKey = secretKeys.default;
    const secretKey = defaultSecretKey ?? (!secretKeysEnv ? Deno.env.get("SERVICE_ROLE_KEY") : undefined);

    console.log("Supabase admin key diagnostics", {
      hasSupabaseSecretKeys: Boolean(secretKeysEnv),
      availableSecretKeyNames: Object.keys(secretKeys),
      selectedSecretKeyPrefix: secretKey?.slice(0, 12),
    });
    console.log("Looking up event by slug", { eventSlug });

    if (!secretKey) {
      return errorResponse("Missing Supabase secret key.", 500);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
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

    const { data: event, error } = await supabase
      .from("events")
      .select("id")
      .eq("slug", eventSlug)
      .maybeSingle();

    if (error) {
      console.error("Failed to look up event", {
        message: error.message,
        code: error.code,
        details: error.details,
      });
      return errorResponse(`Failed to look up event: ${error.message}`, 500);
    }

    if (!event) {
      return errorResponse("Event not found.", 404);
    }

    const storageKey = `events/${eventSlug}/originals/${crypto.randomUUID()}-${sanitizeFilename(filename)}`;

    const r2 = new S3Client({
      region: "auto",
      endpoint: requiredEnv("R2_ENDPOINT"),
      credentials: {
        accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
        secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
      },
    });

    const command = new PutObjectCommand({
      Bucket: requiredEnv("R2_BUCKET_NAME"),
      Key: storageKey,
      ContentType: mimeType,
    });

    const uploadUrl = await getSignedUrl(r2, command, {
      expiresIn: UPLOAD_URL_EXPIRES_IN_SECONDS,
    });

    return jsonResponse({
      success: true,
      data: {
        uploadUrl,
        storageKey,
        eventId: event.id,
        mediaType,
        publicUrl: buildPublicUrl(storageKey),
      },
    });
  } catch (error) {
    console.error("Failed to create upload URL", error);
    return errorResponse("Failed to create upload URL.", 500);
  }
});
