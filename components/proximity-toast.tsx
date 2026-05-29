"use client";

import { useEffect, useRef, useState } from "react";
import { BARRIER_ICONS, BARRIER_TYPES } from "@/lib/constants";
import type { ProximityPrompt } from "@/hooks/use-proximity-prompt";

const AUTO_COLLAPSE_MS = 5000; // se contrae si no hay interacción
const AUTO_DISMISS_MS  = 60000; // desaparece silenciosamente si se ignora

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
  const [collapsed, setCollapsed] = useState(false);

  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const icon = BARRIER_ICONS[report.tipo] ?? "📍";
  const barrierLabel =
    BARRIER_TYPES.find((t) => t.value === report.tipo)?.label ??
    report.tipo.replace(/_/g, " ");

  const distLabel =
    distance_m < 1000
      ? `${Math.round(distance_m)} m`
      : `${(distance_m / 1000).toFixed(1)} km`;

  // Arranca temporizador de colapso al montar
  useEffect(() => {
    collapseTimerRef.current = setTimeout(() => setCollapsed(true), AUTO_COLLAPSE_MS);
    dismissTimerRef.current  = setTimeout(onDismiss, AUTO_DISMISS_MS);

    return () => {
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
      if (dismissTimerRef.current)  clearTimeout(dismissTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Al re-expandir, reinicia el temporizador de colapso
  function expand() {
    setCollapsed(false);
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    collapseTimerRef.current = setTimeout(() => setCollapsed(true), AUTO_COLLAPSE_MS);
  }

  // Pill colapsada
  if (collapsed) {
    return (
      <button
        className="prox-pill"
        onClick={expand}
        aria-label={`Barrera cercana: ${barrierLabel}. Toca para ver opciones.`}
      >
        <span className="prox-pill-icon">{icon}</span>
        <span className="prox-pill-text">
          <span className="prox-pill-label">{barrierLabel}</span>
          <span className="prox-pill-dist">{distLabel}</span>
        </span>
        <span className="prox-pill-chevron" aria-hidden>▲</span>
      </button>
    );
  }

  // Card expandida
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
