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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [addReport]);

  return { reports, loading, loadReports, addReport };
}
