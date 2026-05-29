import { useCallback, useEffect, useState } from "react";
import { REPORT_LIMIT } from "@/lib/constants";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import type { ReportRecord } from "@/lib/types";

export function useReports() {
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadReports = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/reports");

    if (response.ok) {
      const payload = (await response.json()) as { data?: ReportRecord[] };
      setReports(payload.data ?? []);
    }

    setLoading(false);
  }, []);

  const addReport = useCallback((report: ReportRecord) => {
    setReports((current) =>
      [report, ...current.filter((item) => item.id !== report.id)].slice(
        0,
        REPORT_LIMIT
      )
    );
  }, []);

  // Elimina un reporte del estado local (cuando pasa a resuelto/rechazado)
  const removeReport = useCallback((id: string) => {
    setReports((current) => current.filter((r) => r.id !== id));
  }, []);

  useEffect(() => {
    loadReports().catch(() => setLoading(false));
  }, [loadReports]);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;

    const channel = supabase
      .channel("reportes-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "reportes" },
        (payload) => {
          addReport(payload.new as ReportRecord);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "reportes" },
        (payload) => {
          const updated = payload.new as ReportRecord;
          // Si el nuevo estado ya no es visible (resuelto/rechazado), quitar del mapa
          if (updated.estado === "resuelto" || updated.estado === "rechazado") {
            removeReport(updated.id);
          } else {
            // Actualizar en la lista (p. ej. pendiente → verificado)
            setReports((current) =>
              current.map((r) => (r.id === updated.id ? updated : r))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [addReport, removeReport]);

  return { reports, loading, loadReports, addReport, removeReport };
}
