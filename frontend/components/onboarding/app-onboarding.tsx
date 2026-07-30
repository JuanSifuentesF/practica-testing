"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ONBOARDING_STEPS,
  isOnboardingCompleted,
  markOnboardingCompleted,
  resetOnboardingState,
} from "@/lib/onboarding";
import { OnboardingCard } from "./onboarding-card";

export function AppOnboarding() {
  const [isActive, setIsActive] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [cardStyle, setCardStyle] = useState<React.CSSProperties>({});

  // 1. Iniciar onboarding si no se ha completado
  const startTour = useCallback(() => {
    resetOnboardingState();
    setCurrentIndex(0);
    setIsActive(true);
  }, []);

  useEffect(() => {
    // Escuchar eventos globales de reinicio (desde el botón de ayuda ?)
    const handleRestart = () => startTour();
    window.addEventListener("istqb-restart-onboarding", handleRestart);

    if (!isOnboardingCompleted()) {
      // Pequeño timeout para asegurar que el DOM inicial esté renderizado
      const timer = setTimeout(() => {
        setIsActive(true);
      }, 800);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("istqb-restart-onboarding", handleRestart);
      };
    }

    return () => window.removeEventListener("istqb-restart-onboarding", handleRestart);
  }, [startTour]);

  // 2. Calcular posicionamiento del elemento activo
  const updateTargetPosition = useCallback(() => {
    if (!isActive) return;
    const step = ONBOARDING_STEPS[currentIndex];
    if (!step) return;

    const el = document.querySelector(`[data-tour="${step.targetSelector}"]`);
    if (!el) {
      setTargetRect(null);
      // Fallback posición al centro
      setCardStyle({
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      });
      return;
    }

    const rect = el.getBoundingClientRect();
    setTargetRect(rect);

    // Calcular posición de la tarjeta según el viewport
    const cardWidth = Math.min(window.innerWidth - 32, 380);
    const padding = 16;
    let top = rect.bottom + padding;
    let left = rect.left + rect.width / 2 - cardWidth / 2;

    // Asegurar límites horizontales dentro de pantalla
    if (left < 16) left = 16;
    if (left + cardWidth > window.innerWidth - 16) {
      left = window.innerWidth - cardWidth - 16;
    }

    // Si sobresale verticalmente por abajo, posicionar arriba
    if (top + 220 > window.innerHeight && rect.top - 240 > 0) {
      top = rect.top - 230;
    }

    setCardStyle({
      top: `${Math.max(16, top)}px`,
      left: `${left}px`,
    });
  }, [isActive, currentIndex]);

  useEffect(() => {
    const handle = requestAnimationFrame(() => {
      updateTargetPosition();
    });
    window.addEventListener("resize", updateTargetPosition);
    window.addEventListener("scroll", updateTargetPosition);
    return () => {
      cancelAnimationFrame(handle);
      window.removeEventListener("resize", updateTargetPosition);
      window.removeEventListener("scroll", updateTargetPosition);
    };
  }, [updateTargetPosition]);

  // 3. Cerrar con tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isActive) {
        handleSkip();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive]);

  function handleNext() {
    if (currentIndex < ONBOARDING_STEPS.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      handleFinish();
    }
  }

  function handlePrev() {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  }

  function handleSkip() {
    markOnboardingCompleted();
    setIsActive(false);
  }

  function handleFinish() {
    markOnboardingCompleted();
    setIsActive(false);
  }

  if (!isActive) return null;

  const currentStep = ONBOARDING_STEPS[currentIndex];

  return (
    <div className="fixed inset-0 z-[9990] pointer-events-auto">
      {/* ── Overlay Fondo Oscuro Transparente ── */}
      <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-[2px] transition-opacity duration-300" />

      {/* ── Halo Resaltador sobre el Elemento Target ── */}
      {targetRect && (
        <div
          style={{
            top: `${targetRect.top - 6}px`,
            left: `${targetRect.left - 6}px`,
            width: `${targetRect.width + 12}px`,
            height: `${targetRect.height + 12}px`,
          }}
          className="absolute rounded-xl border-2 border-emerald-400 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all duration-300 pointer-events-none"
        />
      )}

      {/* ── Tarjeta Flotante del Paso Actual ── */}
      <OnboardingCard
        step={currentStep}
        currentIndex={currentIndex}
        totalSteps={ONBOARDING_STEPS.length}
        onNext={handleNext}
        onPrev={handlePrev}
        onSkip={handleSkip}
        onFinish={handleFinish}
        positionStyle={cardStyle}
      />
    </div>
  );
}
