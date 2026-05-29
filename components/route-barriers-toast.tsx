"use client";

import { useState } from "react";
import { BARRIER_ICONS, BARRIER_TYPES } from "@/lib/constants";
import { distanceMeters } from "@/lib/geo";
import type { ReportRecord } from "@/lib/types";

type BarrierWithDist = ReportRecord & { dist_m: number };

type Props = {
  barriers: ReportRecord[];
  userLat: number;
  userLng: number;
  onDismiss: () => void;
};

function fmtDist(m: number) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

function barrierLabel(tipo: string) {
  return (
    BARRIER_TYPES.find((t) => t.value === tipo)?.label ??
    tipo.replace(/_/g, " ")
  );
}

export function RouteBarriersToast({ barriers, userLat, userLng, onDismiss }: Props) {
  const [expanded, setExpanded] = useState(false);

  const sorted: BarrierWithDist[] = barriers
    .map((b) => ({
      ...b,
      dist_m: distanceMeters(userLat, userLng, b.latitude, b.longitude)
    }))
    .sort((a, b) => a.dist_m - b.dist_m);

  const count = sorted.length;
  const nearest = sorted[0];

  // ── Pill colapsada ──────────────────────────────────────
  if (!expanded) {
    return (
      <button
        className="rb-pill"
        onClick={() => setExpanded(true)}
        aria-label={`${count} barrera${count > 1 ? "s" : ""} en tu trayecto. Toca para ver el listado.`}
      >
        <span className="rb-pill-icon">⚠️</span>
        <span className="rb-pill-text">
          <span className="rb-pill-label">
            {count} barrera{count > 1 ? "s" : ""} en tu trayecto
          </span>
          {nearest && (
            <span className="rb-pill-sub">
              La más cercana a {fmtDist(nearest.dist_m)}
            </span>
          )}
        </span>
        <span className="rb-pill-chevron" aria-hidden>▲</span>
      </button>
    );
  }

  // ── Card expandida ──────────────────────────────────────
  return (
    <div className="rb-toast" role="dialog" aria-label="Barreras en el trayecto">
      <div className="rb-toast-header">
        <span className="rb-toast-title">⚠️ Barreras en tu trayecto</span>
        <button
          className="rb-toast-close"
          onClick={onDismiss}
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>

      <ul className="rb-list" role="list">
        {sorted.map((b, i) => {
          const icon = BARRIER_ICONS[b.tipo] ?? "📍";
          const label = barrierLabel(b.tipo);
          return (
            <li key={b.id} className="rb-item">
              <span className="rb-item-rank">{i + 1}</span>
              <span className="rb-item-icon">{icon}</span>
              <span className="rb-item-info">
                <span className="rb-item-label">{label}</span>
                {b.descripcion && (
                  <span className="rb-item-desc">{b.descripcion}</span>
                )}
              </span>
              <span className="rb-item-dist">{fmtDist(b.dist_m)}</span>
            </li>
          );
        })}
      </ul>

      <button
        className="rb-collapse-btn"
        onClick={() => setExpanded(false)}
      >
        Colapsar ▼
      </button>
    </div>
  );
}
