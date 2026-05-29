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
 * Estrategia de "evitar cuadra":
 *  1. Detecta clusters de barreras sobre el trayecto.
 *  2. Por cada cluster genera DOS waypoints en la calle paralela:
 *     - Uno ANTES del cluster (para que OSRM tome la calle paralela anticipadamente).
 *     - Uno DESPUÉS del cluster (para retomar el trayecto sin pasar por la cuadra).
 *  3. El offset lateral es de ~110 m (≈ 1 cuadra en Tijuana) para asegurar
 *     que el waypoint quede sobre la siguiente calle real y OSRM lo snappee
 *     correctamente a la vialidad paralela.
 *  4. Máximo 1 cluster atendido (2 waypoints en total) para evitar zigzags.
 */
export function computeDetourWaypoints(
  startLat: number, startLng: number,
  destLat: number, destLng: number,
  barriers: { latitude: number; longitude: number }[],
  bufferMeters = 100,
  offsetMeters = 110
): [number, number][] {
  const mPerDegLat = 111_320;
  const cosLat = Math.cos(((startLat + destLat) / 2) * (Math.PI / 180));
  const mPerDegLng = 111_320 * cosLat;

  const dLatM = (destLat - startLat) * mPerDegLat;
  const dLngM = (destLng - startLng) * mPerDegLng;
  const lenM  = Math.sqrt(dLatM ** 2 + dLngM ** 2);
  if (lenM < 1) return [];

  // Dirección normalizada
  const ry = dLatM / lenM;
  const rx = dLngM / lenM;

  // Vector perpendicular (izquierda de la marcha)
  const perpLat = (-rx) / mPerDegLat;
  const perpLng = ( ry) / mPerDegLng;

  // Proyectar barreras sobre la línea directa
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

  // Agrupar en un único cluster (el de mayor concentración de barreras)
  candidates.sort((a, b) => a.t - b.t);

  const crossSum = candidates.reduce((s, c) => s + c.cross, 0);
  const side: 1 | -1 = crossSum > 0 ? -1 : 1;

  const tMin = candidates[0].t;
  const tMax = candidates[candidates.length - 1].t;

  // Margen de 0.08 (≈ 8% del trayecto) antes y después del cluster
  const MARGIN = 0.08;
  const tBefore = Math.max(0.05, tMin - MARGIN);
  const tAfter  = Math.min(0.95, tMax + MARGIN);

  const makePoint = (t: number): [number, number] => {
    const lat = startLat + t * (destLat - startLat) + side * offsetMeters * perpLat;
    const lng = startLng + t * (destLng - startLng) + side * offsetMeters * perpLng;
    return [lat, lng];
  };

  // Dos waypoints: entrada y salida de la cuadra alternativa
  return [makePoint(tBefore), makePoint(tAfter)];
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
