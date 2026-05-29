import { NextResponse } from "next/server";
import { getMissingServerEnv, getServerEnvStatus } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const checks = getServerEnvStatus();
  const missing = getMissingServerEnv();

  let supabaseConnected = false;

  if (checks.supabase) {
    try {
      const supabase = getSupabaseAdmin();
      const { error } = await supabase.from("reportes").select("id").limit(1);
      supabaseConnected = !error;
    } catch {
      supabaseConnected = false;
    }
  }

  const requiredOk =
    checks.supabase && checks.supabasePublic && supabaseConnected;
  const status = requiredOk ? "ok" : "degraded";

  return NextResponse.json({
    status,
    phase: 0,
    checks: {
      ...checks,
      supabaseConnected
    },
    missing,
    optional: {
      googlePlaces: checks.googlePlaces
        ? "Configurado"
        : "Opcional — búsqueda de destinos deshabilitada",
      n8n: checks.n8n ? "Configurado" : "Opcional — webhooks deshabilitados"
    }
  });
}
