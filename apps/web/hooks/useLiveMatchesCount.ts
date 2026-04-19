"use client";
// useLiveMatchesCount — devuelve el número actual de partidos EN_VIVO
// con al menos un torneo no cancelado. Lo consume `LiveCountBadge`
// (usado por NavBar desktop y BottomNav mobile).
//
// Patrón: hidratación con `initialCount` del SSR para evitar flicker
// pre-hydration + polling cada 30s. No escuchamos el socket porque el
// badge es bajo-frecuencia (cambia cuando arranca o termina un partido)
// y no quiero otro canal de subscripción para los 5 iconos del header.
//
// Bug #12: antes el badge leía un `LIVE_COUNT_PLACEHOLDER = 2`
// hardcoded en NavBar.tsx. Ahora el NavBar llama `contarLiveMatches()`
// server-side y pasa `initialCount`; este hook refresca en background.

import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/api-client";

interface LiveCountResponse {
  data?: { count: number };
  error?: { code: string; message: string };
}

const POLL_INTERVAL_MS = 30_000;

export function useLiveMatchesCount(initialCount: number): number {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    let cancelled = false;

    async function fetchCount(): Promise<void> {
      try {
        const res = await authedFetch("/api/v1/live/count");
        if (!res.ok) return;
        const json = (await res.json()) as LiveCountResponse;
        if (!cancelled && json.data && typeof json.data.count === "number") {
          setCount(json.data.count);
        }
      } catch {
        // Red lenta o sin conexión: nos quedamos con el count previo.
      }
    }

    // Primer fetch 3s después del mount (evita race con el SSR que
    // acaba de traer el initialCount).
    const kickoff = setTimeout(fetchCount, 3_000);
    const interval = setInterval(fetchCount, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearTimeout(kickoff);
      clearInterval(interval);
    };
  }, []);

  return count;
}
