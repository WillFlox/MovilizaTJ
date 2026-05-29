import { useCallback, useEffect, useRef, useState } from "react";
import { distanceMeters } from "@/lib/geo";
import type { ReportRecord } from "@/lib/types";

// Radio en metros para disparar el toast: "estás en el lugar"
const PROXIMITY_THRESHOLD = 40;

export type ProximityPrompt = {
  report: ReportRecord;
  distance_m: number;
};

/**
 * Detecta cuando el usuario cruza el umbral de proximidad de un reporte
 * (entra dentro de PROXIMITY_THRESHOLD metros) y devuelve el reporte más
 * cercano como "prompt" activo. Una vez respondido o descartado, ese
 * reporte queda silenciado en la sesión actual.
 */
export function useProximityPrompt(
  reports: ReportRecord[],
  userPosition: [number, number],
  gpsReady: boolean
) {
  const [activePrompt, setActivePrompt] = useState<ProximityPrompt | null>(null);

  // IDs ya mostrados / respondidos en esta sesión
  const silencedRef = useRef<Set<string>>(new Set());

  // Distancias previas para detectar cruce de umbral
  const prevDistancesRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!gpsReady) return;
    if (activePrompt) return; // no interrumpir un toast activo

    const [userLat, userLng] = userPosition;
    let candidateReport: ReportRecord | null = null;
    let candidateDistance = Infinity;

    for (const report of reports) {
      if (silencedRef.current.has(report.id)) continue;

      const dist = distanceMeters(userLat, userLng, report.latitude, report.longitude);
      const prevDist = prevDistancesRef.current.get(report.id) ?? Infinity;

      // Solo disparar cuando se cruza el umbral (no en cada tick)
      const justEntered = prevDist > PROXIMITY_THRESHOLD && dist <= PROXIMITY_THRESHOLD;

      prevDistancesRef.current.set(report.id, dist);

      if (justEntered && dist < candidateDistance) {
        candidateReport = report;
        candidateDistance = dist;
      }
    }

    if (candidateReport) {
      setActivePrompt({ report: candidateReport, distance_m: candidateDistance });
    }
  }, [userPosition, reports, gpsReady, activePrompt]);

  const dismiss = useCallback((reportId: string) => {
    silencedRef.current.add(reportId);
    setActivePrompt(null);
  }, []);

  const resolve = useCallback(
    async (
      reportId: string,
      userLat: number,
      userLng: number,
      onResolved: (id: string) => void
    ) => {
      silencedRef.current.add(reportId);
      setActivePrompt(null);

      try {
        const res = await fetch(`/api/reports/${reportId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            estado: "resuelto",
            userLatitude: userLat,
            userLongitude: userLng
          })
        });

        if (res.ok) {
          onResolved(reportId);
        }
      } catch {
        // silencioso — el reporte ya fue silenciado de la sesión
      }
    },
    []
  );

  const confirmPresent = useCallback((reportId: string) => {
    silencedRef.current.add(reportId);
    setActivePrompt(null);
  }, []);

  return { activePrompt, dismiss, resolve, confirmPresent };
}
