"use client";

// PickBloqueadoTeaser — pick Premium con paywall (Lote D).
// Spec: docs/ux-spec/04-pista-usuario-premium/pick-bloqueado.spec.md.
//
// Componente reusable que se renderiza para usuarios NO Premium. Tiene 2
// modos:
//
// - `card`: card compacta tipo teaser de home / lista de blog. Border
//   premium + título Premium + preview blureado + CTA.
// - `section`: sección full prominente para vistas de partido / torneo.
//   Más espacio, badge superior, razonamiento blureado visible debajo.
//
// Copy adaptativo según estado del usuario (anónimo/free/ftd) — diferentes
// CTAs y subtítulos para optimizar conversión.
//
// Caso `pick === null`: muestra fallback "Próximamente" con CTA al
// landing /premium. NO se rompe.
//
// Tracking: dispara `pick_premium_blocked_visto` cuando entra al viewport
// (1 vez por mount usando IntersectionObserver) y `pick_premium_blocked_clickeado`
// en click del CTA principal.

import Link from "next/link";
import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics";
import type {
  PickCopyVariant,
  PickWrapperData,
  PickWrapperMode,
} from "./types";

interface Props {
  pick: PickWrapperData | null;
  mode: PickWrapperMode;
  copyVariant: PickCopyVariant;
  utmSource: string;
}

interface CopyConfig {
  badgeLabel: string;
  ctaLabel: string;
  ctaHref: string;
  subCta: string;
}

function buildCopy(
  copyVariant: PickCopyVariant,
  utmSource: string,
): CopyConfig {
  const utm = `?utm_source=${encodeURIComponent(utmSource)}`;
  if (copyVariant === "anonimo") {
    return {
      badgeLabel: "💎 Pick Premium del día",
      ctaLabel: "⚡ Crear cuenta y desbloquear",
      ctaHref: `/auth/signup?callbackUrl=${encodeURIComponent(
        `/premium${utm}`,
      )}`,
      subCta: "Picks por WhatsApp · 65% acierto último mes",
    };
  }
  if (copyVariant === "ftd") {
    return {
      badgeLabel: "💎 Tu acierto puede subir a 65%",
      ctaLabel: "⚡ Probar Premium 7 días",
      ctaHref: `/premium${utm}_ftd`,
      subCta: "65% acierto el último mes · sin compromiso",
    };
  }
  return {
    badgeLabel: "💎 Pick Premium del día",
    ctaLabel: "⚡ Probar Premium 7 días",
    ctaHref: `/premium${utm}`,
    subCta: "65% acierto el último mes · sin compromiso",
  };
}

export function PickBloqueadoTeaser({
  pick,
  mode,
  copyVariant,
  utmSource,
}: Props) {
  const rootRef = useRef<HTMLElement | null>(null);
  const copy = buildCopy(copyVariant, utmSource);

  // Tracking: 1 vez por mount cuando el componente entra al viewport. Si
  // IntersectionObserver no está disponible (SSR / browsers antiguos),
  // disparamos al mount como fallback.
  useEffect(() => {
    let alreadyFired = false;
    const fire = () => {
      if (alreadyFired) return;
      alreadyFired = true;
      track("pick_premium_blocked_visto", {
        utmSource,
        mode,
        copyVariant,
        pickId: pick?.id ?? null,
      });
    };
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      fire();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            fire();
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [utmSource, mode, copyVariant, pick?.id]);

  const handleClick = () => {
    track("pick_premium_blocked_clickeado", {
      utmSource,
      mode,
      copyVariant,
      pickId: pick?.id ?? null,
    });
  };

  // Caso 1: sin pick disponible → fallback "Próximamente".
  if (!pick) {
    return (
      <section
        ref={rootRef}
        aria-label="Pick Premium próximamente"
        className={
          mode === "card"
            ? "relative overflow-hidden rounded-md bg-premium-card-gradient p-5 shadow-premium-card"
            : "relative my-6 overflow-hidden rounded-md bg-premium-card-gradient p-5 shadow-premium-card md:p-7"
        }
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gold-soft-glow opacity-30"
        />
        <div className="relative">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-gold px-2.5 py-0.5 text-label-sm text-black">
              💎 Premium
            </span>
            <span className="text-body-xs text-premium-text-soft-on-dark">
              Próximamente
            </span>
          </div>
          <p className="mb-2 text-display-md text-premium-text-on-dark">
            Picks de valor por WhatsApp
          </p>
          <p className="mb-4 text-body-sm leading-[1.55] text-premium-text-muted-on-dark">
            2-4 picks/día con razonamiento estadístico. Llegan directo a tu
            canal privado.
          </p>
          <Link
            href={copy.ctaHref}
            onClick={handleClick}
            className="touch-target inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-gold px-5 py-3.5 font-display text-[14px] font-extrabold uppercase tracking-[0.04em] text-black shadow-premium-cta transition-all hover:-translate-y-px hover:bg-brand-gold-light"
          >
            {copy.ctaLabel}
          </Link>
          <p className="mt-3 text-center text-body-xs text-premium-text-soft-on-dark">
            {copy.subCta}
          </p>
        </div>
      </section>
    );
  }

  // Caso 2: card compacta (mode = card).
  if (mode === "card") {
    return (
      <section
        ref={rootRef}
        aria-label={copy.badgeLabel}
        className="relative overflow-hidden rounded-md bg-premium-card-gradient p-5 shadow-premium-card"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gold-soft-glow opacity-50"
        />
        <div className="relative">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-gold px-2.5 py-0.5 text-label-sm text-black">
              💎 Premium
            </span>
            <span className="text-body-xs text-premium-text-soft-on-dark">
              Pick del día
            </span>
          </div>
          <p className="mb-1 text-display-sm text-premium-text-on-dark">
            {pick.partido.local} vs {pick.partido.visitante}
          </p>
          <p className="mb-3 text-body-sm text-premium-text-muted-on-dark">
            {pick.mercadoLabel} ·{" "}
            <span className="text-premium-text-soft-on-dark">
              cuota oculta
            </span>
          </p>
          <div className="relative mb-4 rounded-md bg-premium-blur-content p-4">
            <p className="select-none text-body-sm leading-[1.55] text-premium-text-soft-on-dark blur-[3px]">
              {pick.razonamiento.slice(0, 120)}…
            </p>
            <div className="absolute inset-0 flex items-center justify-center">
              <span aria-hidden className="text-3xl">
                🔒
              </span>
            </div>
          </div>
          <Link
            href={copy.ctaHref}
            onClick={handleClick}
            className="touch-target inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-gold px-5 py-3.5 font-display text-[14px] font-extrabold uppercase tracking-[0.04em] text-black shadow-premium-cta transition-all hover:-translate-y-px hover:bg-brand-gold-light"
          >
            {copy.ctaLabel}
          </Link>
          <p className="mt-3 text-center text-body-xs text-premium-text-soft-on-dark">
            {copy.subCta}
          </p>
        </div>
      </section>
    );
  }

  // Caso 3: section full (mode = section).
  return (
    <section
      ref={rootRef}
      aria-label={copy.badgeLabel}
      className="relative my-6 overflow-hidden rounded-md bg-premium-card-gradient p-5 shadow-premium-card md:p-7"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gold-soft-glow opacity-50"
      />
      <div className="relative">
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-gold px-2.5 py-0.5 text-label-sm text-black">
            💎 Premium
          </span>
          <span className="text-body-xs text-premium-text-soft-on-dark">
            Pick del editor
          </span>
        </div>

        <p className="mb-2 text-display-md text-premium-text-on-dark">
          {pick.recomendacion}
        </p>
        <p className="mb-3 text-body-sm text-premium-text-muted-on-dark">
          {pick.mercadoLabel} ·{" "}
          <span className="text-premium-text-soft-on-dark">
            cuota recomendada y casa ocultas
          </span>
        </p>

        <div className="relative mb-4 rounded-md bg-premium-blur-content p-4">
          <p className="select-none text-body-sm leading-[1.55] text-premium-text-soft-on-dark blur-[3px]">
            {pick.razonamiento}
          </p>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <span aria-hidden className="text-3xl">
              🔒
            </span>
            <span className="text-label-md text-premium-text-muted-on-dark">
              Solo para suscriptores Premium
            </span>
          </div>
        </div>

        <Link
          href={copy.ctaHref}
          onClick={handleClick}
          className="touch-target inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-gold px-5 py-3.5 font-display text-[14px] font-extrabold uppercase tracking-[0.04em] text-black shadow-premium-cta transition-all hover:-translate-y-px hover:bg-brand-gold-light"
        >
          {copy.ctaLabel}
        </Link>
        <p className="mt-3 text-center text-body-xs text-premium-text-soft-on-dark">
          {copy.subCta}
        </p>
      </div>
    </section>
  );
}
