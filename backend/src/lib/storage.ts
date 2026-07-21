import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY is not set");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const PROJECT_IMAGES_BUCKET = "project-images";
const PAYMENT_SCREENSHOTS_BUCKET = "payment-screenshots";

async function uploadImage(
  bucket: string,
  buffer: Buffer,
  mimeType: string,
  originalName: string,
): Promise<string> {
  const ext = originalName.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, { contentType: mimeType, upsert: false });

  if (error) {
    throw new Error(`Image upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadProjectImage(
  buffer: Buffer,
  mimeType: string,
  originalName: string,
): Promise<string> {
  return uploadImage(PROJECT_IMAGES_BUCKET, buffer, mimeType, originalName);
}

export async function uploadPaymentScreenshot(
  buffer: Buffer,
  mimeType: string,
  originalName: string,
): Promise<string> {
  return uploadImage(PAYMENT_SCREENSHOTS_BUCKET, buffer, mimeType, originalName);
}
