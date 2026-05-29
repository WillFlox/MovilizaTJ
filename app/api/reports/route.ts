import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { ReportRecord } from "@/lib/types";
import { BARRIER_TYPES, type BarrierType } from "@/lib/constants";

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
const REPORT_SELECT =
  "id, latitude, longitude, tipo, descripcion, foto_url, estado, severidad, created_at";

const VALID_TYPES = new Set<string>(BARRIER_TYPES.map((t) => t.value));
const VALID_SEVERITY = new Set(["baja", "media", "alta"]);

async function uploadPhoto(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  file: File
): Promise<string | null> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from("reportes-fotos")
    .upload(path, buffer, {
      contentType: file.type || "image/jpeg",
      upsert: false
    });

  if (error) {
    return null;
  }

  const { data } = supabase.storage.from("reportes-fotos").getPublicUrl(path);
  return data.publicUrl;
}

export async function GET() {
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch {
    return NextResponse.json(
      { status: "error", message: "Configura variables de entorno de Supabase." },
      { status: 500 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("reportes")
    .select(REPORT_SELECT)
    .in("estado", ["pendiente", "verificado"])
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json(
      { status: "error", message: "No fue posible cargar reportes." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    status: "success",
    data: (data ?? []) as ReportRecord[]
  });
}

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

  const contentType = request.headers.get("content-type") ?? "";
  let latitude: number;
  let longitude: number;
  let tipo: BarrierType = "obstaculo_general";
  let descripcion: string | null = null;
  let severidad = "media";
  let photoFile: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    latitude = Number(form.get("latitude"));
    longitude = Number(form.get("longitude"));
    tipo = (form.get("tipo") as BarrierType) ?? "obstaculo_general";
    descripcion = (form.get("descripcion") as string | null) ?? null;
    severidad = (form.get("severidad") as string) ?? "media";
    const file = form.get("photo");
    photoFile = file instanceof File && file.size > 0 ? file : null;
  } else {
    const body = (await request.json()) as {
      latitude?: number;
      longitude?: number;
      tipo?: BarrierType;
      descripcion?: string;
      severidad?: string;
    };
    latitude = Number(body.latitude);
    longitude = Number(body.longitude);
    tipo = body.tipo ?? "obstaculo_general";
    descripcion = body.descripcion ?? null;
    severidad = body.severidad ?? "media";
  }

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json(
      { status: "error", message: "Coordenadas inválidas." },
      { status: 400 }
    );
  }

  if (!VALID_TYPES.has(tipo)) {
    return NextResponse.json(
      { status: "error", message: "Tipo de barrera inválido." },
      { status: 400 }
    );
  }

  if (!VALID_SEVERITY.has(severidad)) {
    severidad = "media";
  }

  let fotoUrl: string | null = null;
  if (photoFile) {
    fotoUrl = await uploadPhoto(supabaseAdmin, photoFile);
  }

  const { data, error } = await supabaseAdmin
    .from("reportes")
    .insert({
      latitude,
      longitude,
      tipo,
      descripcion,
      severidad,
      foto_url: fotoUrl,
      estado: "pendiente"
    })
    .select(REPORT_SELECT)
    .single();

  if (error) {
    return NextResponse.json(
      { status: "error", message: "No fue posible guardar el reporte." },
      { status: 500 }
    );
  }

  if (N8N_WEBHOOK_URL) {
    await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Barrera reportada (${tipo}): Lat ${latitude}, Lng ${longitude}`,
        latitud: latitude,
        longitud: longitude,
        tipo,
        descripcion,
        severidad,
        foto_url: fotoUrl,
        fecha: new Date().toISOString()
      })
    }).catch(() => null);
  }

  return NextResponse.json({
    status: "success",
    message: "Reporte guardado en Supabase.",
    data
  });
}
