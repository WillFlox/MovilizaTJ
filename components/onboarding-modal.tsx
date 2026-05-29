"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const STORAGE_KEY = "movilizatj-onboarding-done";

const STEPS = [
  {
    emoji: "♿",
    title: "Bienvenido a MovilizaTJ",
    body: "Ayudamos a personas con movilidad reducida y discapacidad visual a navegar Tijuana de forma más segura e independiente.",
    cta: "Siguiente"
  },
  {
    emoji: "📸",
    title: "Reporta barreras",
    body: "¿Ves una banqueta rota, escalón sin rampa o semáforo sin señal sonora? Toca el botón de cámara para reportarlo desde tu ubicación actual.",
    cta: "Siguiente"
  },
  {
    emoji: "🗺️",
    title: "Rutas accesibles",
    body: "Busca tu destino y traza una ruta que evita automáticamente los obstáculos reportados por la comunidad. Si prefieres la ruta más corta, puedes cambiarla en el menú.",
    cta: "¡Comenzar!"
  }
];

type Props = {
  onDone: () => void;
};

export function OnboardingModal({ onDone }: Props) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const done = localStorage.getItem(STORAGE_KEY);
      if (!done) setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function advance() {
    if (isLast) {
      localStorage.setItem(STORAGE_KEY, "1");
      setVisible(false);
      onDone();
    } else {
      setStep((s) => s + 1);
    }
  }

  function skip() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
    onDone();
  }

  return (
    <div className="ob-overlay" role="dialog" aria-modal="true" aria-label="Introducción a MovilizaTJ">
      <div className="ob-card">
        {/* Dots de progreso */}
        <div className="ob-dots" aria-hidden>
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`ob-dot${i === step ? " ob-dot--active" : ""}`}
            />
          ))}
        </div>

        {step === 0 ? (
          <div className="ob-logo-wrapper">
            <Image
              src="/logo-full.png"
              alt="MovilizaTJ"
              width={200}
              height={72}
              className="ob-logo"
              priority
            />
          </div>
        ) : (
          <div className="ob-emoji" aria-hidden>{current.emoji}</div>
        )}
        <h2 className="ob-title">{current.title}</h2>
        <p className="ob-body">{current.body}</p>

        <button className="ob-btn-primary" onClick={advance}>
          {current.cta}
        </button>

        {!isLast && (
          <button className="ob-btn-skip" onClick={skip}>
            Saltar introducción
          </button>
        )}
      </div>
    </div>
  );
}
