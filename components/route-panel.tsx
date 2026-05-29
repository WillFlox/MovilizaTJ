"use client";

import { BARRIER_ICONS } from "@/lib/constants";
import type { RouteMode, RouteState } from "@/lib/types";

type RoutePanelProps = {
  routeState: RouteState;
  onModeChange: (mode: RouteMode) => void;
  onClear: () => void;
};

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `~${mins} min caminando`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}min caminando`;
}

export function RoutePanel({ routeState, onModeChange, onClear }: RoutePanelProps) {
  if (!routeState.destination) return null;

  const { destination, distance, duration, barriersOnRoute, mode, warning } =
    routeState;

  const bufferLabel = mode === "safest" ? "150 m" : "80 m";
  const hasBarriers = barriersOnRoute.length > 0;

  const altaCount = barriersOnRoute.filter((b) => b.severidad === "alta").length;

  return (
    <div className="route-panel">
      <div className="route-panel-header">
        <div className="route-destination">
          <span className="route-dest-icon">📍</span>
          <span className="route-dest-name">{destination}</span>
        </div>
        <button
          className="route-clear-btn"
          onClick={onClear}
          title="Limpiar ruta"
        >
          ✕
        </button>
      </div>

      {distance === null && duration === null && (
        <p className="route-loading">Calculando ruta peatonal…</p>
      )}

      {(distance !== null || duration !== null) && (
        <div className="route-stats-row">
          {distance !== null && (
            <div className="route-stat">
              <span>📏</span>
              <span>{formatDistance(distance)}</span>
            </div>
          )}
          {duration !== null && (
            <div className="route-stat">
              <span>⏱️</span>
              <span>{formatDuration(duration)}</span>
            </div>
          )}
          <div className={`route-stat${hasBarriers ? " route-stat--warn" : ""}`}>
            <span>🚧</span>
            <span>
              {barriersOnRoute.length} barrera
              {barriersOnRoute.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      )}

      <div className="route-mode-toggle">
        <button
          className={`route-mode-btn${mode === "fastest" ? " active" : ""}`}
          onClick={() => onModeChange("fastest")}
        >
          ⚡ Más corta
        </button>
        <button
          className={`route-mode-btn${mode === "safest" ? " active safest" : ""}`}
          onClick={() => onModeChange("safest")}
        >
          🛡️ Más segura
        </button>
      </div>

      {warning && <div className="route-warning">{warning}</div>}

      {hasBarriers ? (
        <div className="route-barriers">
          <div className="route-barriers-title">
            Barreras en tu trayecto
            {altaCount > 0 && (
              <span className="route-barriers-alert">
                {altaCount} crítica{altaCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="route-barriers-list">
            {barriersOnRoute.map((b) => (
              <div
                key={b.id}
                className={`route-barrier-item route-barrier--${b.severidad}`}
              >
                <span className="route-barrier-icon">
                  {BARRIER_ICONS[b.tipo] ?? "📍"}
                </span>
                <span className="route-barrier-label">
                  {b.tipo.replace(/_/g, " ")}
                </span>
                <span className={`route-barrier-sev sev--${b.severidad}`}>
                  {b.severidad}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        distance !== null && (
          <div className="route-clear-path">
            ✅ Sin barreras en {bufferLabel} del trayecto
          </div>
        )
      )}
    </div>
  );
}
