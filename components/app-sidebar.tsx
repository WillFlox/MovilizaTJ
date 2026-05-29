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
  onReportSelect: (report: ReportWithDistance) => void;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onModeChange: (mode: RouteMode) => void;
  onClearRoute: () => void;
};

export function AppSidebar({
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
  onReportSelect,
  filters,
  onFiltersChange,
  onModeChange,
  onClearRoute
}: AppSidebarProps) {
  const [nearbyExpanded, setNearbyExpanded] = useState(false);

  return (
    <aside className="sidebar sidebar--gmaps">
      <div className="sb-top sb-top--sticky">
        {/* ── Perfil de movilidad ───────────────────── */}
        <ProfileSelector value={profile} onChange={onProfileChange} />

        {/* ── Búsqueda de destino ───────────────────── */}
        <div className="sb-search">
          <PlacesSearch
            userLat={userLat}
            userLng={userLng}
            onSelect={onPlaceSelect}
          />
        </div>

        {/* ── Panel de ruta ─────────────────────────── */}
        <RoutePanel
          routeState={routeState}
          onModeChange={onModeChange}
          onClear={onClearRoute}
        />

        {/* ── Filtros ──────────────────────────────── */}
        <FilterBar filters={filters} onChange={onFiltersChange} />
      </div>

      {/* ── Incidencias cercanas (colapsable) ─────── */}
      <div
        className={`sb-nearby sb-nearby--gmaps${nearbyExpanded ? " sb-nearby--open" : ""}`}
      >
        <button
          type="button"
          className="sb-nearby-header sb-nearby-toggle"
          onClick={() => setNearbyExpanded((v) => !v)}
          aria-expanded={nearbyExpanded}
          aria-controls="sb-nearby-panel"
        >
          <div className="sb-nearby-toggle-text">
            <div className="sb-nearby-title">Incidencias cercanas</div>
            <div className="sb-nearby-subtitle">
              Solo en el mapa se muestran todas
            </div>
          </div>
          <div className="sb-nearby-toggle-meta">
            {nearbyReports.length > 0 && (
              <span className="sb-nearby-count">{nearbyReports.length}</span>
            )}
            <span
              className="sb-nearby-chevron"
              aria-hidden
            >
              {nearbyExpanded ? "▲" : "▼"}
            </span>
          </div>
        </button>

        {nearbyExpanded && (
          <div id="sb-nearby-panel" className="sb-nearby-panel">
            <div className="sb-radius-tabs">
              {NEARBY_RADII.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`sb-radius-tab${nearbyRadius === opt.value ? " active" : ""}`}
                  onClick={() => onRadiusChange(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>

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
                      type="button"
                      className="sb-report-item"
                      onClick={() => onReportSelect(report)}
                      style={{
                        borderLeftColor:
                          SEV_COLOR[report.severidad] ?? "#10b981"
                      }}
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
                        <span className="sb-ri-time">
                          {timeAgo(report.created_at)}
                        </span>
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
        )}
      </div>
    </aside>
  );
}
