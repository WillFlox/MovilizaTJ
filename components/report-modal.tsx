"use client";

import { useState } from "react";
import { BARRIER_TYPES, type BarrierType } from "@/lib/constants";
import type { ReportSubmitPayload } from "@/lib/types";

type ReportModalProps = {
  pending: { latitude: number; longitude: number };
  onClose: () => void;
  onSubmit: (payload: ReportSubmitPayload) => Promise<void>;
};

export function ReportModal({ pending, onClose, onSubmit }: ReportModalProps) {
  const [tipo, setTipo] = useState<BarrierType>(BARRIER_TYPES[0].value);
  const [descripcion, setDescripcion] = useState("");
  const [severidad, setSeveridad] = useState<ReportSubmitPayload["severidad"]>("media");
  const [photo, setPhoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({ tipo, descripcion, severidad, photo });
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>Reportar barrera</h3>
        <p className="modal-coords">
          Lat: {pending.latitude.toFixed(5)} · Lng: {pending.longitude.toFixed(5)}
        </p>

        <form onSubmit={handleSubmit} className="report-form">
          <label>
            Tipo de barrera
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as BarrierType)}
            >
              {BARRIER_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.icon} {item.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Severidad
            <select
              value={severidad}
              onChange={(e) =>
                setSeveridad(e.target.value as ReportSubmitPayload["severidad"])
              }
            >
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
            </select>
          </label>

          <label>
            Descripción (opcional)
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej. banqueta destruida sin rampa alternativa"
              rows={3}
            />
          </label>

          <label>
            Foto (opcional)
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            />
          </label>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? "Enviando..." : "Enviar reporte"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
