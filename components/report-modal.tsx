"use client";

import { useRef, useState } from "react";
import { BARRIER_TYPES, type BarrierType } from "@/lib/constants";
import type { ReportSubmitPayload } from "@/lib/types";

const MAX_PHOTO_MB = 4;

type ReportModalProps = {
  pending: { latitude: number; longitude: number };
  onClose: () => void;
  onSubmit: (payload: ReportSubmitPayload) => Promise<void>;
  initialPhoto?: File | null;
};

export function ReportModal({ pending, onClose, onSubmit, initialPhoto }: ReportModalProps) {
  const [tipo, setTipo] = useState<BarrierType | null>(null);
  const [descripcion, setDescripcion] = useState("");
  const [severidad, setSeveridad] =
    useState<ReportSubmitPayload["severidad"] | null>(null);
  const [photo, setPhoto] = useState<File | null>(initialPhoto ?? null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    initialPhoto ? URL.createObjectURL(initialPhoto) : null
  );
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPhotoError(null);

    if (!file) {
      setPhoto(null);
      setPhotoPreview(null);
      return;
    }

    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      setPhotoError(`La foto supera los ${MAX_PHOTO_MB} MB. Elige una más pequeña.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function removePhoto() {
    setPhoto(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        tipo: tipo ?? "obstaculo_general",
        descripcion,
        severidad: severidad ?? "media",
        photo
      });
      setSubmitted(true);
      setTimeout(onClose, 1800);
    } catch {
      setSubmitError("No se pudo enviar el reporte. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="modal-overlay">
        <div className="modal-card modal-card--success" role="status" aria-live="polite">
          <div className="report-success-icon" aria-hidden>✓</div>
          <p className="report-success-title">¡Reporte enviado!</p>
          <p className="report-success-sub">Gracias por contribuir a una ciudad más accesible.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Reportar barrera</h3>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <p className="modal-coords">
          📍 Lat: {pending.latitude.toFixed(5)} · Lng:{" "}
          {pending.longitude.toFixed(5)}
        </p>

        <form onSubmit={handleSubmit} className="report-form">
          <label>
            Tipo de barrera
            <div className="barrier-grid">
              {BARRIER_TYPES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`barrier-chip${tipo !== null && tipo === item.value ? " barrier-chip--active" : ""}`}
                  onClick={() => setTipo(item.value as BarrierType)}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </label>

          <label>
            Severidad
            <div className="severity-row">
              {(["baja", "media", "alta"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`severity-chip severity-chip--${s}${severidad !== null && severidad === s ? " severity-chip--active" : ""}`}
                  onClick={() => setSeveridad(s)}
                >
                  {s === "baja" ? "🟢 Baja" : s === "media" ? "🟡 Media" : "🔴 Alta"}
                </button>
              ))}
            </div>
          </label>

          <label>
            Descripción (opcional)
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej. banqueta destruida sin rampa alternativa"
              rows={2}
            />
          </label>

          <label>
            Foto (opcional)
            {photoPreview ? (
              <div className="photo-preview-wrapper">
                {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                  src={photoPreview}
                  alt="Vista previa"
                  className="photo-preview"
                />
                <button
                  type="button"
                  className="photo-remove"
                  onClick={removePhoto}
                >
                  ✕ Quitar foto
                </button>
              </div>
            ) : (
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoChange}
                className="file-input"
              />
            )}
            {photoError && <p className="field-error">{photoError}</p>}
          </label>

          {submitError && <p className="field-error">{submitError}</p>}

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
