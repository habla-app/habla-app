// Helper cliente de analytics in-house — Lote 6 (May 2026).
//
// Reemplaza al viejo `apps/web/lib/analytics.ts` que cableaba a PostHog
// (eliminado en Lote 1). API similar para minimizar diff en los call
// sites:
//
//   import { track, capturePageview, identify, reset } from "@/lib/analytics";
//   useEffect(() => { track("signup_started", { source: "google_btn" }); }, []);
//
// Reglas:
//   - `track()` y `capturePageview()` consultan `analyticsHabilitado()`
//     antes de hacer el POST. Sin consent del usuario, no-op silencioso.
//     El POST nunca sale del cliente; ni siquiera aparece en Network.
//   - `identify()` y `reset()` SÓLO tocan localStorage; no envían nada al
//     server (no tenemos terceros que registrar). `identify()` se llama
//     post-login para persistir el sessionId si todavía no existía;
//     `reset()` se llama en logout.
//   - El sessionId vive en localStorage y persiste entre cargas. Si el
//     usuario rechaza analytics, NO se genera (no necesitamos identificar
//     a alguien que pidió no ser trackeado).
//
// El `analyticsHabilitado()` de `lib/cookie-consent.ts` es el toggle
// "Analíticas" del cookie banner.

"use client";

import { authedFetch } from "@/lib/api-client";
import { hasAnalyticsConsent } from "@/lib/cookie-consent";

const SESSION_STORAGE_KEY = "habla_analytics_session_v1";

// ---------------------------------------------------------------------------
// Session ID
// ---------------------------------------------------------------------------

function generateSessionId(): string {
  // crypto.randomUUID() está disponible en todos los navegadores modernos.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback ultra-conservador: timestamp + random.
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function readSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeSessionId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, id);
  } catch {
    /* storage bloqueado */
  }
}

function clearSessionId(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    /* storage bloqueado */
  }
}

/**
 * Devuelve un sessionId estable para esta pestaña. Si no existe Y hay
 * consent, lo genera y persiste. Sin consent: no genera nada (devuelve
 * null) — un usuario que rechazó analytics no debe quedar identificable
 * por un cookie/storage que sobrevive al banner.
 */
function ensureSessionId(): string | null {
  if (!hasAnalyticsConsent()) return null;
  const existing = readSessionId();
  if (existing) return existing;
  const fresh = generateSessionId();
  writeSessionId(fresh);
  return fresh;
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

export interface TrackOptions {
  /** Pathname/URL actual. Si no se pasa, se infiere de window.location. */
  pagina?: string;
}

/**
 * Trackea un evento. NO espera el resultado — el caller no se bloquea.
 * Usá `void track(...)` o simplemente `track(...)` (el return es void).
 *
 * Si no hay consent del usuario, esta función es no-op silencioso (no
 * sale request, no se loggea nada).
 */
export function track(
  evento: string,
  props?: Record<string, unknown>,
  opts: TrackOptions = {},
): void {
  if (typeof window === "undefined") return;
  if (!hasAnalyticsConsent()) return;

  const sessionId = ensureSessionId();
  const pagina =
    opts.pagina ?? `${window.location.pathname}${window.location.search}`;

  const body = JSON.stringify({ evento, props, sessionId, pagina });

  // Página descargándose (tab cerrándose, navigate fuera): preferimos
  // sendBeacon porque sobrevive a la descarga del documento. fetch con
  // keepalive también puede, pero sendBeacon es la API recomendada para
  // ese caso específico.
  const docHidden =
    typeof document !== "undefined" && document.visibilityState === "hidden";
  if (
    docHidden &&
    typeof navigator !== "undefined" &&
    typeof navigator.sendBeacon === "function" &&
    body.length < 60_000
  ) {
    try {
      const blob = new Blob([body], { type: "application/json" });
      const ok = navigator.sendBeacon("/api/v1/analytics/track", blob);
      if (ok) return;
    } catch {
      /* fall back a fetch */
    }
  }

  // Caso normal: fetch con keepalive. Visible en el panel Network del
  // browser (Firefox no muestra sendBeacon ahí por default), lo cual es
  // esencial para diagnosticar si analytics está disparando o no. El
  // `keepalive: true` permite sobrevivir a navegaciones rápidas.
  // authedFetch envía cookies (credentials: include) — el endpoint las
  // necesita para identificar al user vía sesión NextAuth. No await: si
  // la red falla, el caller no se entera (es analytics, no es crítico).
  void authedFetch("/api/v1/analytics/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    /* swallow — analytics no debe romper UX */
  });
}

/**
 * Atajo para `$pageview` con el path actual. Llamar desde un
 * `useEffect(() => capturePageview(), [pathname])` en un wrapper de App
 * Router (App Router no dispara $pageview automático).
 */
export function capturePageview(path?: string): void {
  if (typeof window === "undefined") return;
  const pagina = path ?? `${window.location.pathname}${window.location.search}`;
  track("$pageview", { path: pagina }, { pagina });
}

/**
 * Vincula un userId con el sessionId actual. Como no hay third-party,
 * acá sólo aseguramos que el sessionId existe (si no, lo creamos para
 * que los siguientes track() lo lleven). El backend ya identifica al
 * user por la sesión NextAuth en la cookie — no necesita el id en el
 * body.
 *
 * `traits` se ignora intencionalmente — no enviamos traits porque no hay
 * adónde mandarlos. Mantenemos el parámetro por compatibilidad de API
 * con el viejo wrapper de PostHog.
 */
export function identify(_userId: string, _traits?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  ensureSessionId();
}

/**
 * Limpia el sessionId. Llamar en logout.
 */
export function reset(): void {
  clearSessionId();
}

// ---------------------------------------------------------------------------
// Lista canónica de eventos (referencia, no whitelist)
// ---------------------------------------------------------------------------
//
// Esta lista es la fuente de verdad de qué evento se dispara desde dónde.
// Si agregás un evento nuevo, anotalo acá. Para los eventos cuyo emisor
// todavía no existe en el repo, dejá el TODO con el lote esperado para
// que cuando se construya esa pieza, alguien recuerde recablear.
//
// EVENTOS YA INSTRUMENTADOS (Lote 6 + Lote 7 + Lote 8 + Lote 9):
//   signup_started               apps/web/app/auth/signup/page.tsx (mount)
//   signup_completed             POST /api/v1/auth/signup ok (server-side track)
//                                + apps/web/app/auth/completar-perfil/page.tsx (mount, Google)
//   email_verified               apps/web/app/auth/verificar/page.tsx (mount)
//                                + apps/web/app/auth/completar-perfil/page.tsx (mount, Google)
//   profile_completed            POST /api/v1/auth/completar-perfil ok (server-side track)
//                                + signup_completed para email (en el handler)
//   match_viewed                 apps/web/app/(main)/torneo/[id]/page.tsx (mount via TrackOnMount)
//   prediccion_enviada           POST /api/v1/tickets ok (server-side track)
//   comunidad_leaderboard_visto  apps/web/app/(main)/comunidad/page.tsx (mount via TrackOnMount)
//   casa_click_afiliado          GET /go/[casa] route handler (server-side track antes del redirect)
//   articulo_visto               apps/web/app/(public)/{blog,casas,guias,pronosticos,partidos}/[slug]/page.tsx (mount via TrackOnMount con props { slug, categoria, titulo, ... })
//   cuotas_comparator_visto      apps/web/components/mdx/CuotasComparator.tsx (mount via TrackOnMount con props { partidoId, hit })
//
// EVENTOS PENDIENTES — instrumentar cuando se construya el emisor:
//   newsletter_suscripcion       // LOTE_EDITORIAL/AFILIACION: instrumentar `newsletter_suscripcion` en POST /api/v1/suscribir ok (server-side track)
//   referido_invitacion_compartida  // LOTE_11: instrumentar `referido_invitacion_compartida` en click del botón "compartir mi link" (client-side track con props { canal })
