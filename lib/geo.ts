export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function countNearbyBarriers(
  reports: { latitude: number; longitude: number }[],
  lat: number,
  lng: number,
  radiusMeters = 300
): number {
  return reports.filter(
    (r) => distanceMeters(r.latitude, r.longitude, lat, lng) <= radiusMeters
  ).length;
}

/**
 * Distancia mínima en metros desde el punto (pLat, pLng) al segmento
 * (aLat, aLng) → (bLat, bLng), usando proyección sobre el segmento.
 *
 * Proyectamos todo a un plano local (coordenadas en metros) centrado en 'a',
 * lo que es preciso para segmentos cortos (< 1 km, típico en OSRM).
 */
function pointToSegmentMeters(
  pLat: number, pLng: number,
  aLat: number, aLng: number,
  bLat: number, bLng: number
): number {
  const cosLat = Math.cos((aLat * Math.PI) / 180);
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * cosLat;

  // Coordenadas locales en metros (origen = a)
  const px = (pLng - aLng) * mPerDegLng;
  const py = (pLat - aLat) * mPerDegLat;
  const bx = (bLng - aLng) * mPerDegLng;
  const by = (bLat - aLat) * mPerDegLat;

  const segLenSq = bx * bx + by * by;

  if (segLenSq === 0) {
    // Segmento degenerado (a === b)
    return Math.sqrt(px * px + py * py);
  }

  // Parámetro t de la proyección sobre el segmento, clampeado a [0, 1]
  const t = Math.max(0, Math.min(1, (px * bx + py * by) / segLenSq));

  const dx = px - t * bx;
  const dy = py - t * by;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Devuelve los reportes cuya distancia mínima a cualquier SEGMENTO
 * de la polyline de la ruta sea ≤ bufferMeters.
 *
 * Usa distancia punto-a-segmento (no punto-a-punto), lo que evita
 * falsos positivos de barreras en calles paralelas y falsos negativos
 * entre vértices distantes de la polyline.
 *
 * Buffer recomendado: 30 m (ancho de acera + carril) para "Más corta",
 * 50 m para "Más segura".
 */
/**
 * Calcula waypoints de desvío para la ruta "más segura".
 *
 * Estrategia: para cada cluster de barreras sobre el trayecto, genera UN
 * único waypoint desplazado ~150 m perpendicular a la línea directa
 * (suficiente para alcanzar la calle paralela siguiente en Tijuana).
 * Se elige el lado con menos barreras totales para minimizar interferencias.
 *
 * Limitaciones deliberadas que evitan rutas erráticas:
 *  - Solo se desvía por barreras a ≤ 80 m de la línea directa.
 *  - Un solo desvío por cada tramo de 250 m (no se acumulan zigzags).
 *  - Máximo 4 waypoints de desvío en total.
 */
export function computeDetourWaypoints(
  startLat: number, startLng: number,
  destLat: number, destLng: number,
  barriers: { latitude: number; longitude: number }[],
  bufferMeters = 80,
  offsetMeters = 150
): [number, number][] {
  const MAX_WAYPOINTS = 4;
  const DEDUP_METERS  = 250;

  const mPerDegLat = 111_320;
  const cosLat = Math.cos(((startLat + destLat) / 2) * (Math.PI / 180));
  const mPerDegLng = 111_320 * cosLat;

  const dLatM = (destLat - startLat) * mPerDegLat;
  const dLngM = (destLng - startLng) * mPerDegLng;
  const lenM  = Math.sqrt(dLatM ** 2 + dLngM ** 2);
  if (lenM < 1) return [];

  // Dirección normalizada (metros)
  const ry = dLatM / lenM;
  const rx = dLngM / lenM;

  // Vector perpendicular (rotación 90° CCW: izquierda de la marcha)
  const perpLat = (-rx) / mPerDegLat;
  const perpLng = ( ry) / mPerDegLng;

  // --- Proyectar barreras sobre la línea directa ---
  const candidates: { t: number; cross: number }[] = [];

  for (const b of barriers) {
    const bxM = (b.longitude - startLng) * mPerDegLng;
    const byM = (b.latitude  - startLat) * mPerDegLat;

    const t = (bxM * rx + byM * ry) / lenM;
    if (t < 0.05 || t > 0.95) continue;

    const projXm = t * lenM * rx;
    const projYm = t * lenM * ry;
    const dist   = Math.sqrt((bxM - projXm) ** 2 + (byM - projYm) ** 2);
    if (dist > bufferMeters) continue;

    const cross = rx * (byM - projYm) - ry * (bxM - projXm);
    candidates.push({ t, cross });
  }

  if (candidates.length === 0) return [];

  candidates.sort((a, b) => a.t - b.t);

  // --- Deduplicar en clusters de DEDUP_METERS ---
  const clusters: { t: number; cross: number }[] = [];
  for (const c of candidates) {
    const last = clusters[clusters.length - 1];
    if (!last || (c.t - last.t) * lenM > DEDUP_METERS) {
      clusters.push(c);
    } else {
      // Acumular el cross product para elegir lado mayoritario
      last.cross += c.cross;
    }
  }

  // --- Generar waypoints (máx MAX_WAYPOINTS) ---
  return clusters.slice(0, MAX_WAYPOINTS).map(({ t, cross }) => {
    // Desviar al lado contrario donde está la mayoría de barreras
    const side: 1 | -1 = cross > 0 ? -1 : 1;
    const lat = startLat + t * (destLat - startLat) + side * offsetMeters * perpLat;
    const lng = startLng + t * (destLng - startLng) + side * offsetMeters * perpLng;
    return [lat, lng] as [number, number];
  });
}

export function getBarriersOnRoute<T extends { latitude: number; longitude: number }>(
  reports: T[],
  routePoints: [number, number][],
  bufferMeters = 30
): T[] {
  if (routePoints.length < 2) {
    // Con un solo punto, caemos al caso puntual
    if (routePoints.length === 1) {
      const [lat, lng] = routePoints[0];
      return reports.filter(
        (r) => distanceMeters(r.latitude, r.longitude, lat, lng) <= bufferMeters
      );
    }
    return [];
  }

  return reports.filter((r) => {
    for (let i = 0; i < routePoints.length - 1; i++) {
      const [aLat, aLng] = routePoints[i];
      const [bLat, bLng] = routePoints[i + 1];
      const d = pointToSegmentMeters(
        r.latitude, r.longitude,
        aLat, aLng,
        bLat, bLng
      );
      if (d <= bufferMeters) return true;
    }
    return false;
  });
}
