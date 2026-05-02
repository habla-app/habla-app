"use client";

// ServiceWorkerRegistrar — Lote I v3.1.
//
// Registra el service worker `/sw.js` (público) en producción.
// Decisión: solo registramos en `NODE_ENV === "production"` para evitar
// que el SW interfiera con HMR de `pnpm dev` o con builds de QA. La
// app degrada gracefully si no hay SW activo (per regla del Lote I:
// "PWA debe funcionar sin Service Worker activo").
//
// Patrón:
//  - Espera al evento `load` para no bloquear paint inicial.
//  - Registra silenciosamente — cualquier fallo se ignora (el cliente
//    seguirá funcionando con red directa).
//  - Detecta SWs de versiones anteriores y los desregistra si NODE_ENV
//    no es prod (cambio de env entre deploys).

import { useEffect } from "react";

declare global {
  interface Window {
    __hablaSwInit?: boolean;
  }
}

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.__hablaSwInit) return;
    window.__hablaSwInit = true;

    if (!("serviceWorker" in navigator)) return;

    // En desarrollo / preview interno: limpiar SWs vivos para no
    // interferir con HMR ni con tests.
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {});
      return;
    }

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => {
          // Silent fail — la app sigue funcionando sin PWA.
        });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }
  }, []);

  return null;
}
