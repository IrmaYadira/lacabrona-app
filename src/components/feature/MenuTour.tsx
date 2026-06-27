import { useState, useCallback, useEffect } from "react";

export interface TourStep {
  id: string;
  title: string;
  description: string;
  emoji: string;
  /** Target area description for the spotlight */
  spotlight?: Record<string, string>;
  /** Position of the tooltip card relative to the spotlight */
  tooltipPosition?: Record<string, string>;
}

interface MenuTourProps {
  steps: TourStep[];
  /** Called when the tour is completed or dismissed */
  onFinish: () => void;
  /** Whether the tour is visible */
  visible: boolean;
}

export default function MenuTour({ steps, onFinish, visible }: MenuTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [show, setShow] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);

  useEffect(() => {
    if (visible) {
      setShow(true);
      // Pequeño delay para que el overlay se monte antes del fade
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setFadeIn(true));
      });
    } else {
      setFadeIn(false);
      const t = setTimeout(() => setShow(false), 350);
      return () => clearTimeout(t);
    }
  }, [visible]);

  const goNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setFadeIn(false);
      setTimeout(() => {
        setCurrentStep((s) => s + 1);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setFadeIn(true));
        });
      }, 200);
    } else {
      onFinish();
    }
  }, [currentStep, steps.length, onFinish]);

  const goPrev = useCallback(() => {
    if (currentStep > 0) {
      setFadeIn(false);
      setTimeout(() => {
        setCurrentStep((s) => s - 1);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setFadeIn(true));
        });
      }, 200);
    }
  }, [currentStep]);

  const handleDismiss = useCallback(() => {
    onFinish();
  }, [onFinish]);

  if (!show) return null;

  const step = steps[currentStep];
  if (!step) return null;

  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        opacity: fadeIn ? 1 : 0,
        transition: "opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {/* Dark overlay with spotlight cutout */}
      <div
        className="absolute inset-0 bg-black/75"
        onClick={handleDismiss}
      />

      {/* Spotlight "hole" effect using a positioned div with massive box-shadow */}
      {step.spotlight && (
        <div
          className="absolute rounded-xl pointer-events-none"
          style={{
            top: step.spotlight.top,
            left: step.spotlight.left,
            width: step.spotlight.width,
            height: step.spotlight.height,
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.75)",
            background: "transparent",
            zIndex: 1,
            transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        className="absolute z-10 bg-gray-900 text-white rounded-2xl p-5 md:p-6 max-w-sm w-[90vw] sm:w-[380px]"
        style={{
          ...(step.tooltipPosition || {}),
          transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-3xl">{step.emoji}</span>
          <div className="flex-1" />
          <span className="text-xs font-medium text-gray-400">
            {currentStep + 1} de {steps.length}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-[Bebas_Neue] text-2xl md:text-3xl tracking-wide mb-2">
          {step.title}
        </h3>

        {/* Description */}
        <p className="text-sm md:text-base text-gray-300 leading-relaxed mb-5">
          {step.description}
        </p>

        {/* Dots indicator */}
        <div className="flex items-center justify-center gap-1.5 mb-4">
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={`rounded-full transition-all duration-300 ${
                idx === currentStep
                  ? "w-5 h-1.5 bg-amber-500"
                  : idx < currentStep
                    ? "w-1.5 h-1.5 bg-amber-500/50"
                    : "w-1.5 h-1.5 bg-gray-600"
              }`}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3">
          {!isFirst ? (
            <button
              onClick={goPrev}
              className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm font-medium cursor-pointer transition-colors whitespace-nowrap px-2 py-1.5"
            >
              <i className="ri-arrow-left-line text-sm" />
              Anterior
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={handleDismiss}
              className="text-gray-500 hover:text-gray-300 text-xs font-medium cursor-pointer transition-colors whitespace-nowrap px-2 py-1.5"
            >
              Saltar
            </button>
            <button
              onClick={goNext}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold px-4 py-2 rounded-full cursor-pointer transition-all active:scale-95 whitespace-nowrap"
            >
              {isLast ? "¡Listo!" : "Siguiente"}
              {!isLast && <i className="ri-arrow-right-line text-sm" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}