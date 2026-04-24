"use client";
// PostHogProvider — monta PostHog client-side con la config para App Router.
//
// Decisiones (Lote 2):
//  - Init solo si NODE_ENV === "production" y NEXT_PUBLIC_POSTHOG_KEY está.
//    En dev/preview sin key, no-op total (no crea cookie, no hace fetch).
//  - `person_profiles: "identified_only"` — no creamos perfil de anónimos.
//  - `capture_pageview: false` + pageview manual en cambios de ruta (Next
//    App Router no dispara navegación completa, usePathname + useSearchParams).
//  - Exponemos la instancia via `window.__posthog` — `lib/analytics.ts` la
//    lee sin importar el SDK directamente.
//  - identify() cuando la session pasa a autenticada. reset() cuando se
//    cierra (status vuelve a "unauthenticated" después de haber estado
//    "authenticated"). Idempotente — múltiples renders no duplican.
//  - Ruta /legal/* — check adicional en `analytics.ts` (no capturamos ni
//    pageviews ahí).

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { capturePageview, identify, reset, track } from "@/lib/analytics";

let initPromise: Promise<void> | null = null;

async function initPostHog(): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.__posthog) return;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host =
    process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
  if (!key) return;
  if (process.env.NODE_ENV !== "production") return;

  const { default: posthog } = await import("posthog-js");
  posthog.init(key, {
    api_host: host,
    person_profiles: "identified_only",
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: false,
    disable_session_recording: true,
    // `/legal/*` se chequea en el helper `track` — acá no podemos configurar
    // un hard opt-out por ruta sin reimplementar capture.
  });
  window.__posthog = posthog;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastIdentifiedRef = useRef<string | null>(null);
  const wasAuthenticatedRef = useRef<boolean>(false);

  // Init una sola vez. initPromise evita doble init si el efecto corre 2x
  // en dev/strict mode.
  useEffect(() => {
    if (!initPromise) initPromise = initPostHog();
  }, []);

  // Pageview en cada cambio de ruta. `pathname` + `searchParams` cubre
  // tanto navegación hard como soft (Link sin refresh).
  useEffect(() => {
    if (!pathname) return;
    const query = searchParams?.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    void initPromise?.then(() => capturePageview(url));
  }, [pathname, searchParams]);

  // identify / reset según estado de sesión.
  useEffect(() => {
    if (status === "loading") return;

    if (status === "authenticated" && session?.user?.id) {
      const userId = session.user.id;
      wasAuthenticatedRef.current = true;
      if (lastIdentifiedRef.current === userId) return;
      lastIdentifiedRef.current = userId;
      void initPromise?.then(() => {
        identify(userId, {
          email: session.user?.email ?? undefined,
          nombre: session.user?.name ?? undefined,
          username: session.user?.username ?? undefined,
        });
        // Si venimos de un signup email flow (flag en localStorage), el
        // usuario acaba de verificar clickeando el magic link.
        try {
          const pending = window.localStorage.getItem(
            "habla:pending_email_verification",
          );
          if (pending && pending === session.user?.email?.toLowerCase()) {
            track("email_verified", {});
            window.localStorage.removeItem("habla:pending_email_verification");
          }
        } catch {
          /* storage bloqueado */
        }
      });
      return;
    }

    // Transición authenticated → unauthenticated → reset.
    if (status === "unauthenticated" && wasAuthenticatedRef.current) {
      wasAuthenticatedRef.current = false;
      lastIdentifiedRef.current = null;
      void initPromise?.then(() => reset());
    }
  }, [status, session?.user?.id, session?.user?.email, session?.user?.name, session?.user?.username]);

  return <>{children}</>;
}
