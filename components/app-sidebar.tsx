import { PlacesSearch } from "@/components/places-search";
import { ProfileSelector } from "@/components/profile-selector";
import { FilterBar, type FilterState } from "@/components/filter-bar";
import { BARRIER_ICONS, type AccessibilityProfileValue } from "@/lib/constants";
import type { PlaceResult, ReportRecord, RouteState } from "@/lib/types";

type AppSidebarProps = {
  reports: ReportRecord[];
  allReports: ReportRecord[];
  reportsLoading: boolean;
  userLat: number;
  userLng: number;
  routeState: RouteState;
  profile: AccessibilityProfileValue;
  onProfileChange: (value: AccessibilityProfileValue) => void;
  onPlaceSelect: (place: PlaceResult) => void;
  onReportHint: () => void;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
};

export function AppSidebar({
  reports,
  allReports,
  reportsLoading,
  userLat,
  userLng,
  routeState,
  profile,
  onProfileChange,
  onPlaceSelect,
  onReportHint,
  filters,
  onFiltersChange
}: AppSidebarProps) {
  const alta = allReports.filter((r) => r.severidad === "alta").length;
  const media = allReports.filter((r) => r.severidad === "media").length;
  const baja = allReports.filter((r) => r.severidad === "baja").length;

  return (
    <aside className="sidebar">
      <div>
        <div className="section-title">Plataforma ciudadana</div>
        <div className="headline">Tijuana Sin Barreras</div>
        <p className="subtitle">
          Reporta obstáculos con foto y GPS. Busca servicios públicos y traza
          rutas accesibles según tu perfil de movilidad.
        </p>
      </div>

      <ProfileSelector value={profile} onChange={onProfileChange} />

      <PlacesSearch
        userLat={userLat}
        userLng={userLng}
        onSelect={onPlaceSelect}
      />

      {routeState.warning && (
        <div className="route-warning">{routeState.warning}</div>
      )}
      {routeState.destination && !routeState.warning && (
        <div className="destination-chip">
          ✅ Ruta hacia: {routeState.destination}
        </div>
      )}

      <button className="btn-report" onClick={onReportHint}>
        📍 Reportar barrera en el mapa
      </button>

      <div className="stats-grid">
        <div className="stat-box">
          <div className="stat-number" style={{ color: "#ef4444" }}>
            {reportsLoading ? "…" : alta}
          </div>
          <div className="stat-label">Severidad alta</div>
        </div>
        <div className="stat-box">
          <div className="stat-number" style={{ color: "#f59e0b" }}>
            {reportsLoading ? "…" : media}
          </div>
          <div className="stat-label">Severidad media</div>
        </div>
        <div className="stat-box">
          <div className="stat-number" style={{ color: "#10b981" }}>
            {reportsLoading ? "…" : baja}
          </div>
          <div className="stat-label">Severidad baja</div>
        </div>
        <div className="stat-box">
          <div className="stat-number">{reportsLoading ? "…" : allReports.length}</div>
          <div className="stat-label">Total activas</div>
        </div>
      </div>

      <FilterBar filters={filters} onChange={onFiltersChange} />

      <div className="report-list-container">
        <div className="section-title">
          Mapa vivo
          {reports.length !== allReports.length && (
            <span style={{ fontWeight: 400, marginLeft: 6, color: "var(--text-muted)" }}>
              ({reports.length} de {allReports.length})
            </span>
          )}
        </div>
        <div id="log-reportes">
          {reports.length === 0 ? (
            <p className="empty-report">
              {reportsLoading
                ? "Cargando reportes..."
                : allReports.length > 0
                  ? "Ningún reporte coincide con los filtros activos."
                  : "Sin reportes aún. Haz clic en el mapa para reportar una barrera."}
            </p>
          ) : (
            reports.map((report) => (
              <div
                className={`report-item report-item--${report.severidad}`}
                key={report.id}
              >
                <span className="tag">
                  {BARRIER_ICONS[report.tipo]}{" "}
                  {report.tipo.replace(/_/g, " ")}
                </span>
                <span style={{ fontWeight: 800, fontSize: "14px" }}>
                  {report.descripcion ?? "Reporte ciudadano"}
                </span>
                <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                  {report.severidad} ·{" "}
                  {new Date(report.created_at).toLocaleString("es-MX")}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
