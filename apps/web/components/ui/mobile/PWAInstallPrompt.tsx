"use client";

// PWAInstallPrompt — Lote I v3.1.
// Spec: docs/ux-spec/00-design-system/componentes-mobile.md §15.
//
// Banner mobile que aparece sobre el `<BottomNav>` cuando el browser
// dispara `beforeinstallprompt` (Chrome / Edge / Samsung Internet en
// Android, Chrome desktop con flag PWA).
//
// Reglas:
//  - Solo visible en mobile (ancho viewport < md = 768px).
//  - Se oculta si el usuario lo dismissó (localStorage 30 días).
//  - Se oculta si la app ya está instalada (display-mode: standalone).
//  - Si el browser no dispara beforeinstallprompt: el componente no se
//    muestra (Safari iOS no soporta prompt programático — el usuario
//    tiene que usar "Compartir → Agregar a inicio" manualmente).
//
// Eventos analíticos:
//  - `pwa_install_prompt_visto` cuando aparece (1 vez por sesión).
//  - `pwa_install_prompt_aceptado` cuando user click "Instalar".
//  - `pwa_install_prompt_dismiss` cuando user click "Ahora no".

import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";

const STORAGE_KEY = "habla:pwa-prompt-dismissed-at";
const DISMISS_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Si ya está instalada como PWA, no mostrar.
    if (
      window.matchMedia &&
      window.matchMedia("(display-mode: standalone)").matches
    ) {
      return;
    }

    // Si fue dismissed recientemente, no mostrar.
    try {
      const dismissedAt = window.localStorage.getItem(STORAGE_KEY);
      if (dismissedAt) {
        const ts = Number.parseInt(dismissedAt, 10);
        if (
          Number.isFinite(ts) &&
          Date.now() - ts < DISMISS_DURATION_MS
        ) {
          return;
        }
      }
    } catch {
      // localStorage bloqueado — seguimos sin restricción.
    }

    function onBeforeInstallPrompt(event: Event) {
      // Bloquear el prompt nativo del browser para mostrar el nuestro.
      event.preventDefault();
      const promptEvent = event as BeforeInstallPromptEvent;
      setDeferred(promptEvent);
      setVisible(true);
      track("pwa_install_prompt_visto", {});
    }

    function onAppInstalled() {
      // El usuario completó la instalación — ocultar y limpiar.
      setVisible(false);
      setDeferred(null);
      track("pwa_install_completed", {});
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  if (!visible || !deferred) return null;

  async function handleInstall() {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      track("pwa_install_prompt_aceptado", { outcome: choice.outcome });
    } catch {
      // Silent — algunos browsers throwean si ya se llamó prompt() antes.
    }
    setDeferred(null);
    setVisible(false);
  }

  function handleDismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      // Si localStorage falla, igual ocultamos el banner en esta sesión.
    }
    track("pwa_install_prompt_dismiss", {});
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Instalar Habla! como aplicación"
      // md:hidden → solo visible en mobile (<768px).
      // bottom-[80px] (en iPhone) deja espacio sobre el BottomNav (64px)
      // + safe-area inferior. animate-slide-down baja el banner desde
      // arriba con animación discreta del Lote A.
      className="fixed inset-x-3 bottom-[calc(80px+env(safe-area-inset-bottom,0px))] z-sticky animate-slide-down rounded-md border border-light bg-card p-3 shadow-lg md:hidden"
    >
      <div className="flex items-start gap-3">
        <div
          aria-hidden
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-brand-blue-dark font-display text-display-sm font-black text-brand-gold"
        >
          H!
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-display-sm text-dark">
            Instala Habla!
          </p>
          <p className="mt-0.5 text-body-xs leading-snug text-muted-d">
            Acceso rápido + notificaciones del partido en vivo.
          </p>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={handleInstall}
              className="touch-target inline-flex items-center justify-center rounded-sm bg-brand-gold px-3 py-2 font-display text-label-md text-black shadow-gold-btn transition-all hover:-translate-y-px hover:bg-brand-gold-light"
            >
              Instalar
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="touch-target inline-flex items-center justify-center rounded-sm border border-light bg-card px-3 py-2 text-body-sm font-bold text-body transition-colors hover:border-strong"
            >
              Ahora no
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Cerrar"
          className="touch-target -m-2 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-muted-d hover:bg-subtle hover:text-dark"
        >
          <span aria-hidden>×</span>
        </button>
      </div>
    </div>
  );
}
