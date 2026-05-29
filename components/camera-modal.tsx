"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type CameraModalProps = {
  onCapture: (file: File) => void;
  onClose: () => void;
};

export function CameraModal({ onCapture, onClose }: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  const startCamera = useCallback(async (facing: "environment" | "user") => {
    setError(null);
    setReady(false);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setReady(true);
        };
      }
    } catch {
      setError(
        "No se pudo acceder a la cámara. Verifica que hayas dado permiso en el navegador."
      );
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [startCamera, facingMode]);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCaptured(dataUrl);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File(
          [blob],
          `incidente_${Date.now()}.jpg`,
          { type: "image/jpeg" }
        );
        setCapturedFile(file);
      },
      "image/jpeg",
      0.85
    );

    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const handleRetake = useCallback(() => {
    setCaptured(null);
    setCapturedFile(null);
    startCamera(facingMode);
  }, [startCamera, facingMode]);

  const handleUse = useCallback(() => {
    if (capturedFile) {
      onCapture(capturedFile);
    }
  }, [capturedFile, onCapture]);

  const handleFlip = useCallback(() => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    setCaptured(null);
    setCapturedFile(null);
  }, [facingMode]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="camera-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>📸 Fotografiar incidente</h3>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        {error ? (
          <div className="camera-error">
            <p>{error}</p>
            <button className="btn-primary" onClick={() => startCamera(facingMode)}>
              Reintentar
            </button>
          </div>
        ) : captured ? (
          <div className="camera-preview-section">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={captured} alt="Foto capturada" className="camera-snapshot" />
            <div className="camera-actions">
              <button className="btn-secondary" onClick={handleRetake}>
                Volver a tomar
              </button>
              <button
                className="btn-primary"
                onClick={handleUse}
                disabled={!capturedFile}
              >
                Usar esta foto
              </button>
            </div>
          </div>
        ) : (
          <div className="camera-live-section">
            <div className="camera-video-wrapper">
              {!ready && (
                <div className="camera-loading">
                  <span>Iniciando cámara…</span>
                </div>
              )}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="camera-video"
                style={{ opacity: ready ? 1 : 0 }}
              />
            </div>
            <div className="camera-actions">
              <button
                className="btn-secondary camera-flip-btn"
                onClick={handleFlip}
                title="Cambiar cámara"
              >
                🔄 Girar
              </button>
              <button
                className="btn-capture"
                onClick={handleCapture}
                disabled={!ready}
                aria-label="Capturar foto"
              >
                <span className="btn-capture-ring" />
              </button>
              <div style={{ width: 80 }} />
            </div>
          </div>
        )}

        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>
    </div>
  );
}
