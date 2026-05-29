"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { N8nVoiceResponse, VoiceRouteData, VoiceRouteObstacle } from "@/lib/types";
import { getMovilizaSessionId } from "@/lib/api-client";

type ChatState = "idle" | "recording" | "processing" | "speaking" | "error";

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type VoiceChatbotProps = {
  userLat: number;
  userLng: number;
  gpsReady: boolean;
  onRouteReceived?: (ruta: VoiceRouteData) => void;
  onObstaclesReceived?: (obstaculos: VoiceRouteObstacle[]) => void;
};

function formatTime(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function speakText(text: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "es-MX";
  utter.rate = 0.95;
  window.speechSynthesis.speak(utter);
}

export function VoiceChatbot({
  userLat,
  userLng,
  gpsReady,
  onRouteReceived,
  onObstaclesReceived,
}: VoiceChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [chatState, setChatState] = useState<ChatState>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [recordingTime, setRecordingTime] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const liveRegionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioRef.current) audioRef.current.pause();
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const announce = useCallback((text: string) => {
    if (liveRegionRef.current) liveRegionRef.current.textContent = text;
  }, []);

  const addMessage = useCallback((role: "user" | "assistant", text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random()}`, role, text },
    ]);
  }, []);

  const sendAudio = useCallback(
    async (blob: Blob, mimeType: string) => {
      setChatState("processing");
      announce("Procesando tu consulta…");

      const formData = new FormData();
      const ext = mimeType.includes("ogg") ? "ogg" : "webm";
      formData.append("audio", blob, `consulta.${ext}`);
      formData.append("latitude", String(userLat));
      formData.append("longitude", String(userLng));
      formData.append("session_id", getMovilizaSessionId());

      try {
        const res = await fetch("/api/voice-chat", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
        }

        const contentType = res.headers.get("content-type") ?? "";

        if (contentType.includes("audio/")) {
          const audioBlob = await res.blob();
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          audioRef.current = audio;

          setChatState("speaking");
          announce("Reproduciendo respuesta del asistente.");

          audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            audioRef.current = null;
            setChatState("idle");
          };
          audio.onerror = () => {
            URL.revokeObjectURL(audioUrl);
            audioRef.current = null;
            setChatState("idle");
          };

          addMessage(
            "assistant",
            "🔊 Respuesta de voz reproducida. (El servidor no envió datos de ruta para dibujar en el mapa.)"
          );
          await audio.play();
        } else {
          const data = await res.json() as N8nVoiceResponse;

          // ── LOGS DE DEPURACIÓN (visibles en DevTools del móvil) ──
          console.log("RESPUESTA N8N:", data);
          console.log("modo_consulta:", data.modo_consulta);
          console.log("ruta_generada:", data.ruta_generada);
          console.log("ruta:", data.ruta);
          console.log("debug_ruta_motivo:", data.debug_ruta_motivo);
          console.log("mantener_ruta_actual:", data.mantener_ruta_actual);
          console.log("last_transport_route_id:", data.last_transport_route_id);
          console.log("last_transport_route_name:", data.last_transport_route_name);
          console.log("last_transport_destino:", data.last_transport_destino);

          if (data.error) throw new Error(data.error);

          // Respuesta enriquecida con ruta y/o audio_base64
          if (data.ruta || data.obstaculos) {
            const text = data.respuesta_texto ?? data.text ?? "Ruta lista.";
            addMessage("assistant", text);

            // Dibujar ruta en el mapa
            if (data.ruta) {
              onRouteReceived?.(data.ruta);
            } else if (data.obstaculos) {
              onObstaclesReceived?.(data.obstaculos);
            }

            // Reproducir audio si viene en base64
            if (data.audio_base64) {
              try {
                const mime = data.mime_type ?? "audio/mpeg";
                const audioSrc = `data:${mime};base64,${data.audio_base64}`;
                const audio = new Audio(audioSrc);
                audioRef.current = audio;

                setChatState("speaking");
                announce("Reproduciendo respuesta del asistente.");

                audio.onended = () => {
                  audioRef.current = null;
                  setChatState("idle");
                };
                audio.onerror = () => {
                  audioRef.current = null;
                  setChatState("idle");
                };

                await audio.play();
              } catch {
                // Fallback TTS si el audio base64 falla
                setChatState("speaking");
                speakText(data.respuesta_texto ?? data.text ?? "");
                const duration = Math.max(2000, ((data.respuesta_texto ?? "").length / 15) * 1000);
                setTimeout(() => setChatState("idle"), duration);
              }
            } else {
              // Sin audio: TTS de navegador
              setChatState("speaking");
              announce("Reproduciendo respuesta del asistente.");
              speakText(text);
              const duration = Math.max(2000, (text.length / 15) * 1000);
              setTimeout(() => setChatState("idle"), duration);
            }
          } else {
            // Respuesta de texto simple (sin ruta)
            const text = data.text ?? data.respuesta_texto ?? "No se obtuvo respuesta.";
            addMessage(
              "assistant",
              `${text}\n\n(No se recibió el objeto «ruta» desde n8n; no se dibujó nada en el mapa.)`
            );

            setChatState("speaking");
            announce("Reproduciendo respuesta del asistente.");
            speakText(text);

            const duration = Math.max(2000, (text.length / 15) * 1000);
            setTimeout(() => setChatState("idle"), duration);
          }
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Error al contactar el asistente.";
        setErrorMsg(msg);
        setChatState("error");
        announce(`Error: ${msg}`);
      }
    },
    [userLat, userLng, addMessage, announce, onRouteReceived, onObstaclesReceived]
  );

  const startRecording = useCallback(async () => {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/ogg;codecs=opus";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          sendAudio(blob, mimeType);
        } else {
          setChatState("idle");
        }
      };

      recorder.start(250);
      setChatState("recording");
      setRecordingTime(0);
      announce("Grabando. Habla ahora. Presiona de nuevo para enviar.");

      timerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch {
      setErrorMsg("No se pudo acceder al micrófono. Verifica los permisos del navegador.");
      setChatState("error");
      announce("Error al acceder al micrófono.");
    }
  }, [sendAudio, announce]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    announce("Grabación finalizada. Enviando al asistente…");
  }, [announce]);

  const handleMicClick = useCallback(() => {
    if (chatState === "recording") {
      stopRecording();
    } else if (chatState === "idle" || chatState === "error") {
      // Agregar el mensaje del usuario antes de grabar para que se vea inmediatamente
      addMessage("user", `🎤 Consulta de voz — 📍 ${userLat.toFixed(4)}, ${userLng.toFixed(4)}`);
      startRecording();
    }
  }, [chatState, startRecording, stopRecording, addMessage, userLat, userLng]);

  const handleStopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    window.speechSynthesis?.cancel();
    setChatState("idle");
  }, []);

  const handleClearChat = useCallback(() => {
    setMessages([]);
    setErrorMsg(null);
    setChatState("idle");
  }, []);

  // Atajo de teclado: Espacio para grabar / Escape para cerrar
  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        handleMicClick();
      }
      if (e.code === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, handleMicClick]);

  const stateLabel = {
    idle: "Listo",
    recording: `Grabando ${formatTime(recordingTime)}`,
    processing: "Procesando…",
    speaking: "Reproduciendo…",
    error: "Error",
  }[chatState];

  return (
    <>
      {/* Región aria-live para lectores de pantalla */}
      <div
        ref={liveRegionRef}
        aria-live="assertive"
        aria-atomic="true"
        className="vchat-sr-only"
      />

      {/* Botón flotante para abrir */}
      {!isOpen && (
        <button
          className="vchat-fab"
          onClick={() => setIsOpen(true)}
          aria-label="Abrir asistente de voz para consultar barreras de accesibilidad"
          title="Asistente de voz accesible"
        >
          <span aria-hidden="true">🎙️</span>
          <span className="vchat-fab-label">Asistente</span>
        </button>
      )}

      {/* Panel del chatbot */}
      {isOpen && (
        <div
          className="vchat-panel"
          role="dialog"
          aria-label="Asistente de voz"
          aria-modal="false"
        >
          {/* Header */}
          <div className="vchat-header">
            <div className="vchat-header-left">
              <span className="vchat-header-avatar" aria-hidden="true">🎙️</span>
              <div>
                <div className="vchat-header-title">Asistente de voz</div>
                <div className="vchat-header-sub">
                  <span
                    className={`vchat-status-dot${chatState === "recording" ? " vchat-status-dot--rec" : chatState === "processing" ? " vchat-status-dot--proc" : chatState === "speaking" ? " vchat-status-dot--speak" : ""}`}
                    aria-hidden="true"
                  />
                  {stateLabel}
                  {gpsReady && (
                    <span className="vchat-gps-pill" title="Ubicación activa">
                      📍 GPS
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="vchat-header-actions">
              {messages.length > 0 && (
                <button
                  className="vchat-icon-btn"
                  onClick={handleClearChat}
                  aria-label="Limpiar conversación"
                  title="Limpiar"
                >
                  🗑️
                </button>
              )}
              <button
                className="vchat-icon-btn"
                onClick={() => setIsOpen(false)}
                aria-label="Cerrar asistente"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Mensajes */}
          <div
            className="vchat-messages"
            aria-live="polite"
            aria-label="Historial de conversación"
          >
            {messages.length === 0 && (
              <div className="vchat-empty">
                <div className="vchat-empty-icon" aria-hidden="true">🦮</div>
                <p>Haz una consulta de voz sobre barreras de accesibilidad en tu zona.</p>
                <p className="vchat-hint">
                  <kbd>Espacio</kbd> para grabar · <kbd>Esc</kbd> para cerrar
                </p>
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`vchat-msg vchat-msg--${msg.role}`}>
                <span className="vchat-msg-avatar" aria-hidden="true">
                  {msg.role === "user" ? "🎤" : "🤖"}
                </span>
                <p className="vchat-msg-text">{msg.text}</p>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Error */}
          {errorMsg && (
            <div className="vchat-error" role="alert">
              <span>{errorMsg}</span>
              <button
                onClick={() => { setErrorMsg(null); setChatState("idle"); }}
                aria-label="Cerrar error"
              >
                ✕
              </button>
            </div>
          )}

          {/* Controles */}
          <div className="vchat-controls">
            {chatState === "processing" ? (
              <div className="vchat-mic vchat-mic--processing" aria-busy="true">
                <span className="vchat-spinner" aria-hidden="true" />
                <span>Procesando consulta…</span>
              </div>
            ) : chatState === "speaking" ? (
              <button
                className="vchat-mic vchat-mic--speaking"
                onClick={handleStopSpeaking}
                aria-label="Detener reproducción de voz"
              >
                <span aria-hidden="true">🔊</span>
                <span>Reproduciendo — toca para parar</span>
              </button>
            ) : (
              <button
                className={`vchat-mic${chatState === "recording" ? " vchat-mic--recording" : ""}`}
                onClick={handleMicClick}
                aria-label={
                  chatState === "recording"
                    ? `Grabando ${formatTime(recordingTime)}. Toca para enviar.`
                    : "Toca para hablar con el asistente"
                }
                aria-pressed={chatState === "recording"}
              >
                {chatState === "recording" ? (
                  <>
                    <span className="vchat-rec-dot" aria-hidden="true" />
                    <span>{formatTime(recordingTime)} — Toca para enviar</span>
                  </>
                ) : (
                  <>
                    <span aria-hidden="true">🎤</span>
                    <span>Toca para hablar</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
