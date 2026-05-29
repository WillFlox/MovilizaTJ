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
