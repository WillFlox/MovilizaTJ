import { useState } from "react";
import { PlacesSearch } from "@/components/places-search";
import { ProfileSelector } from "@/components/profile-selector";
import { FilterBar, type FilterState } from "@/components/filter-bar";
import { RoutePanel } from "@/components/route-panel";
import { BARRIER_ICONS, BARRIER_TYPES, type AccessibilityProfileValue } from "@/lib/constants";
import type { PlaceResult, ReportRecord, RouteMode, RouteState } from "@/lib/types";

export type ReportWithDistance = ReportRecord & { distance_m: number };

const NEARBY_RADII = [
  { label: "500 m", value: 500 },
  { label: "1 km",  value: 1000 },
  { label: "2 km",  value: 2000 },
  { label: "5 km",  value: 5000 }
];

const SEV_COLOR: Record<string, string> = {
  alta:  "#ef4444",
  media: "#f59e0b",
  baja:  "#10b981"
};

const SEV_BG: Record<string, string> = {
  alta:  "#fee2e2",
  media: "#fef3c7",
  baja:  "#d1fae5"
};

const SEV_TEXT: Record<string, string> = {
  alta:  "#991b1b",
  media: "#92400e",
  baja:  "#065f46"
};

function formatDistance(meters: number): string {
  return meters < 1000
    ? `${Math.round(meters)} m`
    : `${(meters / 1000).toFixed(1)} km`;
}

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  return `hace ${Math.floor(hrs / 24)} d`;
}

type AppSidebarProps = {
  allReports: ReportRecord[];
  nearbyReports: ReportWithDistance[];
  reportsLoading: boolean;
  userLat: number;
  userLng: number;
  nearbyRadius: number;
  onRadiusChange: (r: number) => void;
  routeState: RouteState;
  profile: AccessibilityProfileValue;
  onProfileChange: (value: AccessibilityProfileValue) => void;
  onPlaceSelect: (place: PlaceResult) => void;
  onReportHint: () => void;
  onReportSelect: (report: ReportWithDistance) => void;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onModeChange: (mode: RouteMode) => void;
  onClearRoute: () => void;
};

export function AppSidebar({
  allReports,
  nearbyReports,
  reportsLoading,
  userLat,
  userLng,
  nearbyRadius,
  onRadiusChange,
  routeState,
  profile,
  onProfileChange,
  onPlaceSelect,
  onReportHint,
  onReportSelect,
  filters,
  onFiltersChange,
  onModeChange,
  onClearRoute
}: AppSidebarProps) {
  const [statsExpanded, setStatsExpanded] = useState(false);

  const alta  = allReports.filter((r) => r.severidad === "alta").length;
  const media = allReports.filter((r) => r.severidad === "media").length;
  const baja  = allReports.filter((r) => r.severidad === "baja").length;

  return (
    <aside className="sidebar">
      {/* ── Estadísticas globales (colapsable) ───── */}
      <div className="sb-stats-panel">
        <button
          className="sb-stats-toggle"
          onClick={() => setStatsExpanded((v) => !v)}
        >
          <span>
            <strong>{reportsLoading ? "…" : allReports.length}</strong> incidencias activas en el mapa
          </span>
          <span className="sb-toggle-arrow">{statsExpanded ? "▲" : "▼"}</span>
        </button>

        {statsExpanded && (
          <div className="sb-stats-grid">
            <div className="sb-stat" style={{ borderColor: SEV_COLOR.alta }}>
              <span className="sb-stat-num" style={{ color: SEV_COLOR.alta }}>
                {reportsLoading ? "…" : alta}
              </span>
              <span className="sb-stat-lbl">Alta</span>
            </div>
            <div className="sb-stat" style={{ borderColor: SEV_COLOR.media }}>
              <span className="sb-stat-num" style={{ color: SEV_COLOR.media }}>
                {reportsLoading ? "…" : media}
              </span>
              <span className="sb-stat-lbl">Media</span>
            </div>
            <div className="sb-stat" style={{ borderColor: SEV_COLOR.baja }}>
              <span className="sb-stat-num" style={{ color: SEV_COLOR.baja }}>
                {reportsLoading ? "…" : baja}
              </span>
              <span className="sb-stat-lbl">Baja</span>
            </div>
            <div className="sb-stat" style={{ borderColor: "#2563eb" }}>
              <span className="sb-stat-num" style={{ color: "#2563eb" }}>
                {reportsLoading ? "…" : allReports.length}
              </span>
              <span className="sb-stat-lbl">Total</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Perfil de movilidad ───────────────────── */}
      <ProfileSelector value={profile} onChange={onProfileChange} />

      {/* ── Búsqueda de destino ───────────────────── */}
      <PlacesSearch
        userLat={userLat}
        userLng={userLng}
        onSelect={onPlaceSelect}
      />

      {/* ── Panel de ruta ─────────────────────────── */}
      <RoutePanel
        routeState={routeState}
        onModeChange={onModeChange}
        onClear={onClearRoute}
      />

      {/* ── CTA reportar ─────────────────────────── */}
      <button className="btn-report" onClick={onReportHint}>
        📍 Reportar barrera en el mapa
      </button>

      {/* ── Filtros ──────────────────────────────── */}
      <FilterBar filters={filters} onChange={onFiltersChange} />

      {/* ── Incidencias cercanas ──────────────────── */}
      <div className="sb-nearby">
        <div className="sb-nearby-header">
          <div>
            <div className="sb-nearby-title">Incidencias cercanas</div>
            <div className="sb-nearby-subtitle">
              Solo en el mapa se muestran todas
            </div>
          </div>
          {nearbyReports.length > 0 && (
            <span className="sb-nearby-count">{nearbyReports.length}</span>
          )}
        </div>

        {/* Selector de radio */}
        <div className="sb-radius-tabs">
          {NEARBY_RADII.map((opt) => (
            <button
              key={opt.value}
              className={`sb-radius-tab${nearbyRadius === opt.value ? " active" : ""}`}
              onClick={() => onRadiusChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div className="sb-report-list">
          {reportsLoading ? (
            <div className="sb-empty">Cargando reportes…</div>
          ) : nearbyReports.length === 0 ? (
            <div className="sb-empty">
              No hay incidencias dentro de{" "}
              {formatDistance(nearbyRadius)}.
            </div>
          ) : (
            nearbyReports.map((report) => {
              const icon = BARRIER_ICONS[report.tipo] ?? "📍";
              const barrierLabel =
                BARRIER_TYPES.find((t) => t.value === report.tipo)?.label ??
                report.tipo.replace(/_/g, " ");

              return (
                <button
                  key={report.id}
                  className="sb-report-item"
                  onClick={() => onReportSelect(report)}
                  style={{ borderLeftColor: SEV_COLOR[report.severidad] ?? "#10b981" }}
                >
                  <div className="sb-ri-top">
                    <span className="sb-ri-icon">{icon}</span>
                    <span className="sb-ri-type">{barrierLabel}</span>
                    <span
                      className="sb-ri-sev"
                      style={{
                        background: SEV_BG[report.severidad],
                        color: SEV_TEXT[report.severidad]
                      }}
                    >
                      {report.severidad}
                    </span>
                  </div>

                  {report.descripcion && (
                    <p className="sb-ri-desc">{report.descripcion}</p>
                  )}

                  <div className="sb-ri-footer">
                    <span className="sb-ri-dist">
                      📍 {formatDistance(report.distance_m)}
                    </span>
                    <span className="sb-ri-time">{timeAgo(report.created_at)}</span>
                    {report.foto_url && (
                      <span className="sb-ri-photo-badge">📷 foto</span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
}
