// analytics.ts — capa única de abstracción sobre PostHog.
//
// Regla de oro: ningún archivo del app importa `posthog-js` directo. Todo
// pasa por `track`, `identify`, `reset`, `capturePageview`. Si mañana
// cambiamos a Mixpanel o añadimos un segundo sink (GA4, Meta Pixel), solo
// se edita este archivo.
//
// Reglas operacionales (Lote 2):
//  - `NODE_ENV !== "production"` → no-op. No queremos ensuciar el dashboard
//    con eventos de dev/CI.
//  - `NEXT_PUBLIC_POSTHOG_KEY` ausente → no-op. Permite builds sin las env
//    vars (Railway previews, local preview).
//  - Si la ruta actual empieza con `/legal/`, no capturamos nada. Privacy.
//  - `person_profiles: "identified_only"` — configurado en el provider.
//    No creamos perfiles de anónimos (ahorra cuota).
//  - Pageview manual en cambios de ruta — en el provider, no acá.

import type { PostHog } from "posthog-js";

/** Eventos canónicos. Agregar acá antes de llamar a `track`. */
export type EventName =
  | "signup_started"
  | "signup_completed"
  | "email_verified"
  | "profile_completed"
  | "lukas_purchase_started"
  | "lukas_purchase_completed"
  | "lukas_purchase_failed"
  | "torneo_viewed"
  | "torneo_inscripto"
  | "ticket_submitted"
  | "premio_ganado"
  | "canje_solicitado"
  | "tienda_viewed";

type EventProps = Record<string, string | number | boolean | null | undefined>;

interface IdentifyTraits {
  email?: string;
  nombre?: string;
  fechaRegistro?: string;
  /** Otros traits que queramos setear con $set. */
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * Devuelve la instancia de posthog si está cargada y habilitada, o `null`
 * si hay que no-opear. Importación dinámica — evita cargar el SDK en el
 * bundle del server ni en builds de prod sin la env var.
 */
declare global {
  interface Window {
    __posthog?: PostHog;
  }
}

function getClient(): PostHog | null {
  if (typeof window === "undefined") return null;
  const ph = window.__posthog;
  return ph ?? null;
}

function estaHabilitado(): boolean {
  if (typeof window === "undefined") return false;
  // Respetar ruta privada — /legal/* no captura nada.
  if (window.location.pathname.startsWith("/legal/")) return false;
  return true;
}

export function track(event: EventName, props: EventProps = {}): void {
  if (!estaHabilitado()) return;
  const ph = getClient();
  if (!ph) return;
  // Filtrar undefined/null para no ensuciar el payload.
  const clean: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(props)) {
    if (v !== undefined && v !== null) clean[k] = v;
  }
  try {
    ph.capture(event, clean);
  } catch {
    // Silencioso — no queremos que analytics rompa la UX.
  }
}

/**
 * Asocia los eventos anónimos previos con un userId real + setea traits.
 * Llamar tras login exitoso. Es idempotente: PostHog linkea al mismo
 * usuario si lo volvemos a llamar.
 */
export function identify(userId: string, traits: IdentifyTraits = {}): void {
  if (!estaHabilitado()) return;
  const ph = getClient();
  if (!ph) return;
  try {
    ph.identify(userId, traits);
  } catch {
    /* noop */
  }
}

/** Setea traits del usuario identificado (via $set). No crea evento. */
export function setUserProps(traits: IdentifyTraits): void {
  if (!estaHabilitado()) return;
  const ph = getClient();
  if (!ph) return;
  try {
    ph.setPersonProperties(traits);
  } catch {
    /* noop */
  }
}

/** Llamar al logout. Desliga el anonId del userId anterior. */
export function reset(): void {
  const ph = getClient();
  if (!ph) return;
  try {
    ph.reset();
  } catch {
    /* noop */
  }
}

/** Pageview manual. El provider llama esto en cambios de ruta. */
export function capturePageview(path: string): void {
  if (!estaHabilitado()) return;
  const ph = getClient();
  if (!ph) return;
  try {
    ph.capture("$pageview", { $current_url: path });
  } catch {
    /* noop */
  }
}
