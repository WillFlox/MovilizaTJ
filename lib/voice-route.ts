import type { VoiceRouteData, VoiceRouteObstacle } from "@/lib/types";

export type VoiceRouteContext = {
  latitude?: number;
  longitude?: number;
};

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asBool(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

/** Convierte reportes de Supabase / n8n en marcadores de obstáculos para el mapa. */
export function extractVoiceObstacles(
  data: Record<string, unknown>
): VoiceRouteObstacle[] | undefined {
  return (
    normalizeObstacles(data.obstaculos) ??
    normalizeObstacles(data.obstacles) ??
    normalizeObstacles(data.reportes_encontrados)
  );
}

function normalizeObstacles(raw: unknown): VoiceRouteObstacle[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const list = raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const latitude = asNumber(o.latitude ?? o.lat);
      const longitude = asNumber(o.longitude ?? o.lng ?? o.lon);
      if (latitude === null || longitude === null) return null;
      return {
        descripcion:
          typeof o.descripcion === "string" ? o.descripcion : undefined,
        tipo: typeof o.tipo === "string" ? o.tipo : undefined,
        latitude,
        longitude,
        distancia_metros: asNumber(o.distancia_metros) ?? undefined,
      } satisfies VoiceRouteObstacle;
    })
    .filter((o): o is VoiceRouteObstacle => o !== null);
  return list.length > 0 ? list : undefined;
}

function pickDestination(data: Record<string, unknown>): string | null {
  const keys = [
    "destino_ruta",
    "destino",
    "destination",
    "nombre_destino",
    "destino_nombre",
  ];
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/**
 * Formato plano de n8n («Preparar respuesta»):
 * - ruta / pide_ruta: boolean (sí pidió ruta)
 * - destino_ruta: string con el lugar
 * - reportes_encontrados: array de reportes cercanos
 */
function buildRouteFromN8nFlags(
  data: Record<string, unknown>,
  context?: VoiceRouteContext
): VoiceRouteData | null {
  const wantsRoute =
    asBool(data.pide_ruta) || asBool(data.pideRuta) || asBool(data.ruta);

  if (!wantsRoute) return null;

  const destino = pickDestination(data);
  if (!destino) return null;

  const obstaculos = extractVoiceObstacles(data);

  return {
    destino,
    origen_lat: context?.latitude ?? 0,
    origen_lng: context?.longitude ?? 0,
    ...(obstaculos ? { obstaculos } : {}),
  };
}

/** Normaliza el objeto `ruta` cuando n8n envía un JSON anidado (formato documentado). */
export function normalizeVoiceRoute(raw: unknown): VoiceRouteData | null {
  if (raw == null || typeof raw === "boolean") return null;

  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  if (typeof obj !== "object" || obj === null) return null;
  const r = obj as Record<string, unknown>;

  const destino =
    (typeof r.destino === "string" && r.destino.trim()) ||
    (typeof r.destination === "string" && r.destination.trim()) ||
    (typeof r.nombre_destino === "string" && r.nombre_destino.trim()) ||
    null;

  if (!destino) return null;

  const origen_lat = asNumber(r.origen_lat ?? r.origenLat ?? r.origin_lat);
  const origen_lng = asNumber(r.origen_lng ?? r.origenLng ?? r.origin_lng);
  const destino_lat = asNumber(
    r.destino_lat ?? r.destinoLat ?? r.dest_lat ?? r.lat ?? r.latitude
  );
  const destino_lng = asNumber(
    r.destino_lng ?? r.destinoLng ?? r.dest_lng ?? r.lng ?? r.lon ?? r.longitude
  );

  const obstaculos =
    normalizeObstacles(r.obstaculos) ?? normalizeObstacles(r.obstacles);

  return {
    destino,
    origen_lat: origen_lat ?? 0,
    origen_lng: origen_lng ?? 0,
    ...(destino_lat !== null ? { destino_lat } : {}),
    ...(destino_lng !== null ? { destino_lng } : {}),
    ...(obstaculos ? { obstaculos } : {}),
  };
}

/** Arma la ruta a partir del payload de n8n (objeto anidado o flags planos). */
export function extractVoiceRoute(
  data: Record<string, unknown>,
  context?: VoiceRouteContext
): VoiceRouteData | null {
  const nestedCandidates = [data.ruta, data.route, data.ruta_segura, data.rutaSegura];

  for (const candidate of nestedCandidates) {
    if (typeof candidate === "boolean") continue;
    const normalized = normalizeVoiceRoute(candidate);
    if (normalized) {
      const obstaculos =
        normalized.obstaculos ?? extractVoiceObstacles(data);
      return {
        ...normalized,
        origen_lat: normalized.origen_lat || context?.latitude || 0,
        origen_lng: normalized.origen_lng || context?.longitude || 0,
        ...(obstaculos ? { obstaculos } : {}),
      };
    }
  }

  return buildRouteFromN8nFlags(data, context);
}
