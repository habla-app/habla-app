"use client";
// CookieBanner — barra inferior fija con 3 botones (Aceptar, Rechazar
// opcionales, Configurar). Al "Configurar" abre un modal con switches
// por categoría. Persiste decisión en localStorage via cookie-consent.ts
// y dispatchea evento `habla:cookie-consent-change` que PostHogProvider
// y analytics.ts escuchan.
//
// Lote 3.

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  acceptAll,
  getConsent,
  rejectOptional,
  setConsent,
  type ConsentState,
} from "@/lib/cookie-consent";

export function CookieBanner() {
  const [mounted, setMounted] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  // Local form state para el modal de configuración.
  const [prefAnalytics, setPrefAnalytics] = useState(true);
  const [prefPreferences, setPrefPreferences] = useState(true);

  useEffect(() => {
    setMounted(true);
    const existing = getConsent();
    if (!existing) {
      setShowBanner(true);
    } else {
      setPrefAnalytics(existing.analytics);
      setPrefPreferences(existing.preferences);
    }
  }, []);

  if (!mounted || (!showBanner && !showSettings)) return null;

  function handleAcceptAll(): void {
    acceptAll();
    setShowBanner(false);
    setShowSettings(false);
  }

  function handleRejectOptional(): void {
    rejectOptional();
    setShowBanner(false);
    setShowSettings(false);
  }

  function handleSaveCustom(): void {
    const allOn = prefAnalytics && prefPreferences;
    const allOff = !prefAnalytics && !prefPreferences;
    const status: ConsentState["status"] = allOn
      ? "accepted"
      : allOff
        ? "rejected"
        : "customized";
    setConsent({
      status,
      analytics: prefAnalytics,
      preferences: prefPreferences,
    });
    setShowBanner(false);
    setShowSettings(false);
  }

  return (
    <>
      {/* Banner inferior */}
      {showBanner && !showSettings && (
        <div
          role="dialog"
          aria-label="Aviso de cookies"
          aria-describedby="cookie-banner-text"
          className="fixed inset-x-0 bottom-0 z-[200] bg-dark-surface text-white shadow-[0_-8px_24px_rgba(0,16,80,0.25)] md:inset-x-auto md:bottom-6 md:left-1/2 md:max-w-[900px] md:-translate-x-1/2 md:rounded-md"
        >
          <div className="flex flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between md:gap-6 md:px-6 md:py-5">
            <div className="flex-1 text-[14px] leading-[1.55]" id="cookie-banner-text">
              <p>
                Habla! usa cookies para mejorar tu experiencia y entender cómo
                se usa la plataforma. Podés aceptar todas, rechazar las
                opcionales, o configurar tus preferencias.{" "}
                <Link
                  href="/legal/cookies"
                  className="font-bold text-brand-gold underline-offset-2 hover:underline"
                >
                  Leer Política de Cookies
                </Link>
                .
              </p>
            </div>
            <div className="flex flex-wrap gap-2 md:flex-nowrap">
              <button
                type="button"
                onClick={handleRejectOptional}
                className="rounded-sm border border-white/30 px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-white/10"
              >
                Rechazar opcionales
              </button>
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="rounded-sm border border-white/30 px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-white/10"
              >
                Configurar
              </button>
              <button
                type="button"
                onClick={handleAcceptAll}
                className="rounded-sm bg-brand-gold px-4 py-2 text-[13px] font-bold text-black shadow-gold-btn transition-all hover:-translate-y-px hover:bg-brand-gold-light"
              >
                Aceptar todas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de configuración */}
      {showSettings && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Configuración de cookies"
          className="fixed inset-0 z-[210] flex items-end justify-center bg-black/60 p-4 md:items-center"
        >
          <div className="w-full max-w-[560px] rounded-md bg-card text-dark shadow-xl">
            <div className="border-b border-light px-6 py-5">
              <h2 className="font-display text-[22px] font-bold">
                Configuración de cookies
              </h2>
              <p className="mt-1 text-[13.5px] text-muted-d">
                Elegí qué cookies querés permitir. Podés cambiar esto en
                cualquier momento.
              </p>
            </div>

            <div className="space-y-4 px-6 py-5">
              <CategoryRow
                title="Necesarias"
                description="Indispensables para autenticarte, mantener tu sesión y proteger formularios. No se pueden desactivar."
                checked={true}
                disabled={true}
                onChange={() => {}}
              />
              <CategoryRow
                title="Preferencias"
                description="Recuerdan tu idioma, tema visual y otras configuraciones de visualización."
                checked={prefPreferences}
                disabled={false}
                onChange={setPrefPreferences}
              />
              <CategoryRow
                title="Analíticas"
                description="Mediciones agregadas y seudonimizadas (PostHog) que usamos para mejorar el producto."
                checked={prefAnalytics}
                disabled={false}
                onChange={setPrefAnalytics}
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-light bg-subtle px-6 py-4">
              <button
                type="button"
                onClick={handleRejectOptional}
                className="rounded-sm border border-light bg-card px-4 py-2 text-[13px] font-bold text-dark hover:bg-bg-hover"
              >
                Rechazar opcionales
              </button>
              <button
                type="button"
                onClick={handleSaveCustom}
                className="rounded-sm bg-brand-blue-main px-4 py-2 text-[13px] font-bold text-white hover:bg-brand-blue-mid"
              >
                Guardar elección
              </button>
              <button
                type="button"
                onClick={handleAcceptAll}
                className="rounded-sm bg-brand-gold px-4 py-2 text-[13px] font-bold text-black shadow-gold-btn hover:bg-brand-gold-light"
              >
                Aceptar todas
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CategoryRow({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start justify-between gap-4 rounded-md border border-light p-4 ${
        disabled ? "cursor-default opacity-90" : "hover:bg-bg-hover"
      }`}
    >
      <span className="flex-1">
        <span className="block font-display text-[15px] font-bold text-dark">
          {title}
        </span>
        <span className="mt-1 block text-[13px] leading-[1.55] text-body">
          {description}
        </span>
      </span>
      <span className="relative inline-flex h-6 w-11 flex-shrink-0 items-center">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className={`block h-6 w-11 rounded-full transition-colors ${
            checked ? "bg-brand-blue-main" : "bg-[rgba(0,16,80,0.18)]"
          } ${disabled ? "opacity-50" : ""}`}
        />
        <span
          aria-hidden="true"
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </label>
  );
}
