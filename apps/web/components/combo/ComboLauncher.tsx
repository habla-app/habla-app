"use client";
// ComboLauncher — botón que dispara el ComboModal con lazy-load del
// estado del torneo. Si el usuario no tiene sesión, lleva al login con
// callbackUrl al punto de entrada. Sub-Sprint 4.
//
// Usado desde:
//   - /torneo/:id           (CTA grande del detalle)
//   - /mis-combinadas       (botón "+ Otra combinada")
//   - /live-match           (si el torneo sigue abierto)
//
// MatchCard (`/matches`) NO usa este componente — tiene su propio CTA
// lateral con styling específico del card (ver MatchCardCTA.tsx), pero
// comparte el hook `useComboOpener` para mantener la lógica de apertura
// en un solo lugar.

import Link from "next/link";
import { ComboModal } from "./ComboModal";
import { useComboOpener } from "@/hooks/useComboOpener";

interface ComboLauncherProps {
  torneoId: string;
  hasSession: boolean;
  /** URL a la que volver tras login si no hay sesión. */
  callbackUrl: string;
  /** Etiqueta del botón. */
  label?: string;
  /** Override de className del botón. */
  className?: string;
  /** Styling variant. */
  variant?: "primary" | "ghost" | "urgent";
  /** Callback tras crear el ticket exitosamente. */
  onCreated?: (result: { ticketId: string }) => void;
}

export function ComboLauncher({
  torneoId,
  hasSession,
  callbackUrl,
  label = "🎯 Crear combinada",
  className,
  variant = "primary",
  onCreated,
}: ComboLauncherProps) {
  const { modalProps, openFor, loading, error } = useComboOpener();

  if (!hasSession) {
    return (
      <Link
        href={`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`}
        className={buttonCls(variant, className)}
      >
        {label}
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => openFor(torneoId)}
        disabled={loading}
        className={buttonCls(variant, className)}
      >
        {loading ? "Cargando..." : label}
      </button>
      {error && (
        <p className="mt-1 text-[11px] font-semibold text-danger">{error}</p>
      )}
      <ComboModal {...modalProps} onCreated={onCreated} />
    </>
  );
}

function buttonCls(variant: string, extra?: string): string {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-md px-6 py-4 font-display text-[15px] font-extrabold uppercase tracking-[0.04em] transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-70";
  const variants: Record<string, string> = {
    primary:
      "bg-brand-gold text-black shadow-gold-cta hover:-translate-y-px hover:bg-brand-gold-light hover:shadow-gold",
    urgent:
      "bg-urgent-critical text-white shadow-urgent-btn hover:-translate-y-px hover:bg-urgent-critical-hover",
    ghost:
      "border-[1.5px] border-strong bg-transparent text-body hover:border-brand-blue-main hover:text-brand-blue-main",
  };
  return [base, variants[variant] ?? variants.primary, extra]
    .filter(Boolean)
    .join(" ");
}
