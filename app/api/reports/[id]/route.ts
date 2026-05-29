import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { distanceMeters } from "@/lib/geo";

const REPORT_SELECT =
  "id, latitude, longitude, tipo, descripcion, foto_url, estado, severidad, created_at";

// Radio máximo en metros desde el que se puede cerrar un reporte
const MAX_PROXIMITY_METERS = 60;

const VALID_ESTADOS = new Set(["resuelto", "rechazado", "verificado", "pendiente"]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { status: "error", message: "ID de reporte requerido." },
      { status: 400 }
    );
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json(
      { status: "error", message: "Configura variables de entorno de Supabase." },
      { status: 500 }
    );
  }

  let body: {
    estado?: string;
    userLatitude?: number;
    userLongitude?: number;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { status: "error", message: "Body JSON inválido." },
      { status: 400 }
    );
  }

  const { estado, userLatitude, userLongitude } = body;

  if (!estado || !VALID_ESTADOS.has(estado)) {
    return NextResponse.json(
      { status: "error", message: "Estado inválido." },
      { status: 400 }
    );
  }

  // Obtener el reporte actual para validar proximidad
  const { data: existing, error: fetchError } = await supabase
    .from("reportes")
    .select("id, latitude, longitude, estado")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json(
      { status: "error", message: "Reporte no encontrado." },
      { status: 404 }
    );
  }

  // Validar proximidad en el servidor cuando se cierra un reporte
  if (estado === "resuelto" || estado === "verificado") {
    if (
      typeof userLatitude !== "number" ||
      typeof userLongitude !== "number" ||
      !Number.isFinite(userLatitude) ||
      !Number.isFinite(userLongitude)
    ) {
      return NextResponse.json(
        { status: "error", message: "Se requiere ubicación del usuario para cerrar el reporte." },
        { status: 400 }
      );
    }

    const dist = distanceMeters(
      userLatitude,
      userLongitude,
      existing.latitude,
      existing.longitude
    );

    if (dist > MAX_PROXIMITY_METERS) {
      return NextResponse.json(
        {
          status: "error",
          message: `Debes estar a menos de ${MAX_PROXIMITY_METERS} m del reporte para marcarlo como ${estado}. Distancia actual: ${Math.round(dist)} m.`
        },
        { status: 403 }
      );
    }
  }

  const { data, error } = await supabase
    .from("reportes")
    .update({
      estado,
      ...(estado === "resuelto" ? { resolved_at: new Date().toISOString(), resolved_via: "proximity_check" } : {})
    })
    .eq("id", id)
    .select(REPORT_SELECT)
    .single();

  if (error) {
    // Si las columnas de auditoría no existen aún, reintentamos sin ellas
    const { data: data2, error: error2 } = await supabase
      .from("reportes")
      .update({ estado })
      .eq("id", id)
      .select(REPORT_SELECT)
      .single();

    if (error2) {
      return NextResponse.json(
        { status: "error", message: "No fue posible actualizar el reporte." },
        { status: 500 }
      );
    }

    return NextResponse.json({ status: "success", data: data2 });
  }

  return NextResponse.json({ status: "success", data });
}
