import { PlacesSearch } from "@/components/places-search";
import { BARRIER_ICONS } from "@/lib/constants";
import type { PlaceResult, ReportRecord, RouteState } from "@/lib/types";

type AppSidebarProps = {
  reports: ReportRecord[];
  reportsLoading: boolean;
  userLat: number;
  userLng: number;
  routeState: RouteState;
  onPlaceSelect: (place: PlaceResult) => void;
  onReportHint: () => void;
};

export function AppSidebar({
  reports,
  reportsLoading,
  userLat,
  userLng,
  routeState,
  onPlaceSelect,
  onReportHint
}: AppSidebarProps) {
  return (
    <aside className="sidebar">
      <div>
        <div className="section-title">Accesibilidad multimodal</div>
        <div className="headline">Ruteo accesible en tiempo real</div>
        <p className="subtitle">
          Reporta barreras con foto y GPS. Busca servicios públicos con Google
          Places y traza rutas con Leaflet evitando zonas críticas.
        </p>
      </div>

      <PlacesSearch
        userLat={userLat}
        userLng={userLng}
        onSelect={onPlaceSelect}
      />

      {routeState.warning && (
        <div className="route-warning">{routeState.warning}</div>
      )}
      {routeState.destination && (
        <div className="destination-chip">Destino: {routeState.destination}</div>
      )}

      <button className="btn-report" onClick={onReportHint}>
        📍 Reportar barrera en el mapa
      </button>

      <div className="stats-grid">
        <div className="stat-box">
          <div className="stat-number">
            {reportsLoading ? "…" : reports.length}
          </div>
          <div className="stat-label">Barreras activas</div>
        </div>
        <div className="stat-box">
          <div className="stat-number">TJ</div>
          <div className="stat-label">Zona activa</div>
        </div>
      </div>

      <div className="report-list-container">
        <div className="section-title">Mapa vivo de reportes</div>
        <div id="log-reportes">
          {reports.length === 0 ? (
            <p className="empty-report">
              {reportsLoading
                ? "Cargando reportes..."
                : "Sin reportes aún. Haz clic en el mapa para reportar una barrera."}
            </p>
          ) : (
            reports.map((report) => (
              <div className="report-item" key={report.id}>
                <span className="tag">
                  {BARRIER_ICONS[report.tipo]}{" "}
                  {report.tipo.replace(/_/g, " ")}
                </span>
                <span style={{ fontWeight: 800, fontSize: "14px" }}>
                  {report.descripcion ?? "Reporte ciudadano"}
                </span>
                <span
                  style={{ color: "var(--text-muted)", fontSize: "12px" }}
                >
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
