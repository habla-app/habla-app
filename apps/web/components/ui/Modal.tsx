"use client";

// Modal — traducido de `.combo-overlay` / `.combo-panel` del mockup.
// Overlay con blur + panel centrado con animate-scale-in + shadow-xl.
// API: controlado por el padre via `isOpen` + `onClose`. Slots para el
// header (título con stripe dorado shimmer), body, y footer opcional.
import { useEffect } from "react";
import type { ReactNode } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** aria-label del panel. Requerido para accesibilidad. */
  label: string;
  /** Máximo ancho del panel. Default 640px según mockup. */
  maxWidth?: string;
  children: ReactNode;
  /** Si true, renderiza un header azul gradient con stripe dorado. */
  variant?: "light" | "hero-blue";
  className?: string;
}

export function Modal({
  isOpen,
  onClose,
  label,
  maxWidth = "640px",
  children,
  className,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onEsc);
    // Lock background scroll mientras el modal está abierto
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-brand-blue-dark/65 p-5 backdrop-blur-md"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth }}
        className={`flex max-h-[92vh] w-full animate-scale-in flex-col overflow-hidden rounded-xl bg-app shadow-xl ${className ?? ""}`}
      >
        {children}
      </div>
    </div>
  );
}

interface ModalHeaderProps {
  children: ReactNode;
  onClose: () => void;
  /** Eyebrow pequeño sobre el título (ej. "Crear combinada"). */
  eyebrow?: string;
  /** Stripe dorado animado arriba (como el combo-panel-head del mockup). */
  shimmer?: boolean;
  /** Patrón de fondo — por defecto el hero-blue del mockup. */
  tone?: "hero-blue" | "plain";
  className?: string;
}

export function ModalHeader({
  children,
  onClose,
  eyebrow,
  shimmer = true,
  tone = "hero-blue",
  className,
}: ModalHeaderProps) {
  const toneCls =
    tone === "hero-blue" ? "bg-hero-blue text-white" : "bg-card text-dark";
  return (
    <div className={`relative px-7 pb-5 pt-6 ${toneCls} ${className ?? ""}`}>
      {shimmer && (
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-1 animate-shimmer bg-gold-shimmer bg-[length:200%_100%]"
        />
      )}
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-[18px] text-white transition-colors hover:bg-white/30"
      >
        <span aria-hidden>✕</span>
      </button>
      {eyebrow && (
        <div className="mb-1.5 flex items-center gap-2 font-display text-[12px] font-extrabold uppercase tracking-[0.1em] text-white/70">
          {eyebrow}
        </div>
      )}
      {children}
    </div>
  );
}

export function ModalBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex-1 overflow-y-auto bg-page px-7 py-6 ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

export function ModalFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`border-t border-light bg-card px-7 py-5 ${className ?? ""}`}
    >
      {children}
    </div>
  );
}
