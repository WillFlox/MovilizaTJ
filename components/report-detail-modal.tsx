"use client";

import { BARRIER_ICONS, BARRIER_TYPES } from "@/lib/constants";
import type { ReportRecord } from "@/lib/types";

type Props = {
  report: ReportRecord & { distance_m?: number };
  onClose: () => void;
};

const SEV_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  alta:  { bg: "#fee2e2", text: "#991b1b", label: "Alta" },
  media: { bg: "#fef3c7", text: "#92400e", label: "Media" },
  baja:  { bg: "#d1fae5", text: "#065f46", label: "Baja" }
};

const STATUS_LABELS: Record<string, string> = {
  pendiente: "Pendiente de revisión",
  verificado: "Verificado",
  resuelto: "Resuelto",
  rechazado: "Rechazado"
};

export function ReportDetailModal({ report, onClose }: Props) {
  const icon = BARRIER_ICONS[report.tipo] ?? "📍";
  const barrierType = BARRIER_TYPES.find((t) => t.value === report.tipo);
  const sev = SEV_STYLES[report.severidad] ?? SEV_STYLES.baja;
  const statusLabel = STATUS_LABELS[report.estado] ?? report.estado;

  const date = new Date(report.created_at);
  const formattedDate = date.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
  const formattedTime = date.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit"
  });

  const distanceStr =
    report.distance_m != null
      ? report.distance_m < 1000
        ? `${Math.round(report.distance_m)} m`
        : `${(report.distance_m / 1000).toFixed(1)} km`
      : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="rd-card" onClick={(e) => e.stopPropagation()}>
        {/* Photo banner */}
        {report.foto_url && (
          <div className="rd-photo-banner">
            <img src={report.foto_url} alt="Foto del reporte" className="rd-photo" />
            <div className="rd-photo-gradient" />
            <span className="rd-photo-label">
              {icon} {barrierType?.label ?? report.tipo.replace(/_/g, " ")}
            </span>
          </div>
        )}

        {/* Header (sin foto) */}
        {!report.foto_url && (
          <div className="rd-header-no-photo">
            <div className="rd-icon-circle">{icon}</div>
            <div className="rd-header-text">
              <h2 className="rd-title">
                {barrierType?.label ?? report.tipo.replace(/_/g, " ")}
              </h2>
              <span
                className="rd-sev-badge"
                style={{ background: sev.bg, color: sev.text }}
              >
                Severidad {sev.label}
              </span>
            </div>
            <button className="rd-close-btn" onClick={onClose} aria-label="Cerrar">
              ✕
            </button>
          </div>
        )}

        <div className="rd-body">
          {/* Severity badge (when there is a photo) */}
          {report.foto_url && (
            <div className="rd-top-row">
              <span
                className="rd-sev-badge"
                style={{ background: sev.bg, color: sev.text }}
              >
                Severidad {sev.label}
              </span>
              <button className="rd-close-btn-inline" onClick={onClose} aria-label="Cerrar">
                ✕
              </button>
            </div>
          )}

          {/* Description */}
          {report.descripcion ? (
            <div className="rd-section">
              <p className="rd-section-label">Descripción</p>
              <p className="rd-description">{report.descripcion}</p>
            </div>
          ) : (
            <p className="rd-description rd-no-desc">Sin descripción adicional.</p>
          )}

          {/* Meta grid */}
          <div className="rd-meta-grid">
            <div className="rd-meta-item">
              <span className="rd-meta-icon">📅</span>
              <div>
                <div className="rd-meta-label">Fecha y hora</div>
                <div className="rd-meta-value">{formattedDate}</div>
                <div className="rd-meta-sub">{formattedTime} h</div>
              </div>
            </div>

            {distanceStr && (
              <div className="rd-meta-item">
                <span className="rd-meta-icon">📏</span>
                <div>
                  <div className="rd-meta-label">Distancia</div>
                  <div className="rd-meta-value rd-meta-highlight">{distanceStr}</div>
                  <div className="rd-meta-sub">desde tu posición</div>
                </div>
              </div>
            )}

            <div className="rd-meta-item">
              <span className="rd-meta-icon">🔖</span>
              <div>
                <div className="rd-meta-label">Estado</div>
                <div className="rd-meta-value">{statusLabel}</div>
              </div>
            </div>

            <div className="rd-meta-item">
              <span className="rd-meta-icon">🗺️</span>
              <div>
                <div className="rd-meta-label">Coordenadas</div>
                <div className="rd-meta-value">{report.latitude.toFixed(5)}</div>
                <div className="rd-meta-sub">{report.longitude.toFixed(5)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="rd-footer">
          <button className="rd-close-full" onClick={onClose}>
            Cerrar detalle
          </button>
        </div>
      </div>
    </div>
  );
}
