import { createClient } from "@supabase/supabase-js";

let _client: ReturnType<typeof createClient> | null = null;

/** Server-only Supabase client using the service-role key — never expose this to the browser. */
function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to use file storage.");
  }
  if (!_client) {
    _client = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  }
  return _client;
}

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "uploads";

/**
 * Creates a one-time signed upload URL so the browser can PUT the file
 * bytes directly to Supabase Storage — file contents never transit our
 * API routes. Returns the upload URL/token for the client and the final
 * public URL to save once the upload succeeds.
 */
export async function createInsuranceDocUploadUrl(hostOrganizationId: string, fileName: string) {
  const supabase = getSupabaseAdmin();
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `insurance_docs/${hostOrganizationId}/${Date.now()}-${safeName}`;

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) throw error;

  const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return {
    path,
    token: data.token,
    signedUrl: data.signedUrl,
    publicUrl: publicUrlData.publicUrl,
  };
}
