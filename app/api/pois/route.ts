import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { countNearbyBarriers } from "@/lib/geo";
import type { PoiRecord } from "@/lib/types";

type RawPoi = {
  id: string;
  nombre: string;
  categoria: string;
  direccion: string | null;
  latitude: number;
  longitude: number;
  activo: boolean;
  created_at: string;
};

type RawReport = { latitude: number; longitude: number };

/**
 * GET /api/pois?lat=32.5&lng=-117.0&categoria=imss&radius=5000
 *
 * Devuelve POIs ordenados por "score accesible":
 *   score = distancia_m + (barrier_count × 150)
 * El que aparece primero es el más accesible (menos barreras + más cerca).
 */
export async function GET(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { status: "error", message: "Supabase no configurado." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  const categoria = searchParams.get("categoria") ?? undefined;
  const radius = Number(searchParams.get("radius") ?? "8000");

  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0;

  // Obtener POIs
  let query = supabase
    .from("puntos_interes")
    .select("id,nombre,categoria,direccion,latitude,longitude,activo,created_at")
    .eq("activo", true)
    .order("nombre");

  if (categoria) {
    query = query.eq("categoria", categoria);
  }

  const { data: pois, error: poisError } = await query;

  if (poisError) {
    return NextResponse.json(
      { status: "error", message: poisError.message },
      { status: 500 }
    );
  }

  if (!pois || pois.length === 0) {
    return NextResponse.json({ status: "success", data: [] });
  }

  // Obtener reportes activos para calcular el score
  const { data: reports } = await supabase
    .from("reportes")
    .select("latitude,longitude")
    .in("estado", ["pendiente", "verificado"]);

  const reportList: RawReport[] = reports ?? [];

  // Calcular distancia y barreras para cada POI
  const enriched = (pois as RawPoi[]).map((poi) => {
    const distM = hasCoords
      ? haversineMeters(lat, lng, poi.latitude, poi.longitude)
      : 0;

    const barrierCount = countNearbyBarriers(
      reportList,
      poi.latitude,
      poi.longitude,
      500
    );

    return {
      ...poi,
      barrier_count: barrierCount,
      distance_m: hasCoords ? Math.round(distM) : null
    } as PoiRecord & { distance_m: number | null };
  });

  // Filtrar por radio si se tienen coords
  const filtered = hasCoords
    ? enriched.filter((p) => p.distance_m !== null && p.distance_m <= radius)
    : enriched;

  // Ordenar por score accesible: menos barreras y más cerca primero
  filtered.sort((a, b) => {
    const scoreA = (a.distance_m ?? 0) + (a.barrier_count ?? 0) * 150;
    const scoreB = (b.distance_m ?? 0) + (b.barrier_count ?? 0) * 150;
    return scoreA - scoreB;
  });

  return NextResponse.json({ status: "success", data: filtered });
}

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
