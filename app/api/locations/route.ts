import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { ActiveUserRecord } from "@/lib/types";

type UpdateLocationPayload = {
  latitude?: number;
  longitude?: number;
  usuario_id?: string;
};

export async function POST(request: Request) {
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch {
    return NextResponse.json(
      { status: "error", message: "Configura variables de entorno de Supabase." },
      { status: 500 }
    );
  }

  let body: UpdateLocationPayload;

  try {
    body = (await request.json()) as UpdateLocationPayload;
  } catch {
    return NextResponse.json(
      { status: "error", message: "JSON inválido." },
      { status: 400 }
    );
  }

  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const usuarioId = body.usuario_id?.trim() || "anonimo_tj";

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json(
      { status: "error", message: "Coordenadas inválidas." },
      { status: 400 }
    );
  }

  const payload = {
    usuario_id: usuarioId,
    latitud: latitude,
    longitud: longitude,
    ultima_actualizacion: new Date().toISOString()
  };

  const { data, error } = await supabaseAdmin
    .from("usuarios_activos")
    .upsert(payload, { onConflict: "usuario_id" })
    .select("usuario_id, latitud, longitud, ultima_actualizacion")
    .single();

  if (error) {
    return NextResponse.json(
      { status: "error", message: "No fue posible actualizar ubicación." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    status: "success",
    message: "Ubicación actualizada en Supabase.",
    data: data as ActiveUserRecord
  });
}
