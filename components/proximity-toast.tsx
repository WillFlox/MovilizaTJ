"use client";

import { useState } from "react";
import { BARRIER_ICONS, BARRIER_TYPES } from "@/lib/constants";
import type { ProximityPrompt } from "@/hooks/use-proximity-prompt";

type Props = {
  prompt: ProximityPrompt;
  onResolved: () => void;
  onStillPresent: () => void;
  onDismiss: () => void;
  resolving?: boolean;
};

export function ProximityToast({
  prompt,
  onResolved,
  onStillPresent,
  onDismiss,
  resolving = false
}: Props) {
  const { report, distance_m } = prompt;
  const icon = BARRIER_ICONS[report.tipo] ?? "📍";
  const barrierLabel =
    BARRIER_TYPES.find((t) => t.value === report.tipo)?.label ??
    report.tipo.replace(/_/g, " ");

  const distLabel =
    distance_m < 1000
      ? `${Math.round(distance_m)} m`
      : `${(distance_m / 1000).toFixed(1)} km`;

  return (
    <div className="prox-toast" role="alert" aria-live="polite">
      <button
        className="prox-toast-close"
        onClick={onDismiss}
        aria-label="Ignorar"
        disabled={resolving}
      >
        ✕
      </button>

      <div className="prox-toast-header">
        <span className="prox-toast-icon">{icon}</span>
        <div>
          <p className="prox-toast-type">{barrierLabel}</p>
          <p className="prox-toast-dist">A {distLabel} de tu posición</p>
        </div>
      </div>

      <p className="prox-toast-question">
        ¿La barrera ya <strong>no impide el paso</strong>?
      </p>

      <div className="prox-toast-actions">
        <button
          className="prox-btn prox-btn--present"
          onClick={onStillPresent}
          disabled={resolving}
        >
          Sigue presente
        </button>
        <button
          className="prox-btn prox-btn--resolved"
          onClick={onResolved}
          disabled={resolving}
        >
          {resolving ? "Guardando…" : "Ya está resuelto ✓"}
        </button>
      </div>
    </div>
  );
}
