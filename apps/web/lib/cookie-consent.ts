// cookie-consent.ts — single source of truth para el consentimiento
// de cookies. Persiste en localStorage + dispatchea evento custom para
// que componentes y analytics se enteren del cambio en tiempo real.
//
// El estado de consentimiento tiene 3 categorías:
//   - necessary: siempre true, no se puede desactivar.
//   - preferences: idioma, tema, etc.
//   - analytics: PostHog y similares.
//
// Y un campo `status`:
//   - "accepted"   → todas las opcionales en true
//   - "rejected"   → todas las opcionales en false (solo necessary)
//   - "customized" → mix elegido por el usuario
//
// Si la clave no existe en localStorage, el banner se muestra. Una vez
// el usuario decide, no se vuelve a mostrar (pero el modal de config
// permite cambiar la decisión).

export const CONSENT_STORAGE_KEY = "habla_cookie_consent_v1";
export const CONSENT_EVENT = "habla:cookie-consent-change";

export type ConsentStatus = "accepted" | "rejected" | "customized";

export interface ConsentState {
  status: ConsentStatus;
  preferences: boolean;
  analytics: boolean;
  decidedAt: string;
}

export function getConsent(): ConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentState;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.preferences === "boolean" &&
      typeof parsed.analytics === "boolean"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function setConsent(
  partial: Pick<ConsentState, "status" | "preferences" | "analytics">,
): ConsentState {
  const state: ConsentState = {
    ...partial,
    decidedAt: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(state));
      window.dispatchEvent(
        new CustomEvent(CONSENT_EVENT, { detail: state }),
      );
    } catch {
      /* storage bloqueado */
    }
  }
  return state;
}

export function acceptAll(): ConsentState {
  return setConsent({
    status: "accepted",
    preferences: true,
    analytics: true,
  });
}

export function rejectOptional(): ConsentState {
  return setConsent({
    status: "rejected",
    preferences: false,
    analytics: false,
  });
}

/** Devuelve true si analytics está permitido. No-decididos = false. */
export function hasAnalyticsConsent(): boolean {
  const c = getConsent();
  if (!c) return false;
  return c.analytics === true;
}

/**
 * Subscribe a cambios de consent. Devuelve unsubscribe fn.
 * Útil en `analytics.ts` y `PostHogProvider`.
 */
export function listenConsent(
  callback: (state: ConsentState) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<ConsentState>).detail;
    if (detail) callback(detail);
  };
  window.addEventListener(CONSENT_EVENT, handler);
  return () => window.removeEventListener(CONSENT_EVENT, handler);
}
