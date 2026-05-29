export type ServerEnvStatus = {
  supabase: boolean;
  supabasePublic: boolean;
  googlePlaces: boolean;
  n8n: boolean;
};

export function getServerEnvStatus(): ServerEnvStatus {
  return {
    supabase: Boolean(
      process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ),
    supabasePublic: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ),
    googlePlaces: Boolean(process.env.GOOGLE_MAPS_API_KEY),
    n8n: Boolean(process.env.N8N_WEBHOOK_URL)
  };
}

export function getMissingServerEnv(): string[] {
  const missing: string[] = [];

  if (!process.env.SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return missing;
}
