"use client";
// Hook que mantiene el ranking de un torneo actualizado en vivo. Hace
// fetch inicial al GET /api/v1/torneos/:id/ranking y se suscribe al
// room del torneo para recibir `ranking:update` por Socket.io.
//
// Hotfix #6 Ítem 3: agregamos polling de fallback cada 45s — si el WS
// se desconectó silenciosamente (proxy cierra la conexión, reconnect
// loop largo), seguimos refrescando el minuto del partido y el ranking.
// Con WS alive el polling es redundante pero cheap.

import { useEffect, useRef, useState } from "react";
import { joinTorneo, getSocket } from "@/lib/realtime/socket-client";
import { authedFetch } from "@/lib/api-client";
import type {
  RankingRowPayload,
  RankingUpdatePayload,
} from "@/lib/realtime/events";

/** Hotfix #6 Ítem 3: intervalo del polling de fallback. Si no pasan
 *  WS en este lapso, asumimos que el ranking podría estar stale y
 *  refrescamos via REST. */
const FALLBACK_POLL_MS = 45_000;

export interface MiPosicion {
  posicion: number;
  ticketId: string;
  puntosTotal: number;
}

export interface RankingSnapshot {
  torneoId: string;
  ranking: RankingRowPayload[];
  totalInscritos: number;
  minutoPartido: number | null;
  /** Minutos de descuento/añadido (1H/2H). Null/0 fuera de injury time. */
  minutoExtra: number | null;
  /** Label renderizable del minuto (ej. "23'", "45+3'", "Medio tiempo",
   *  "Final"). Null hasta que el primer WS llegue — la UI muestra "—"
   *  mientras. */
  minutoLabel: string | null;
  /** Hotfix #8 Bug #22: `fixture.status.short` del snapshot del server.
   *  Consumido por `useMinutoEnVivo` para decidir qué fase del partido
   *  está en curso (1H/2H/HT/FT/...). */
  statusShort: string | null;
  /** Hotfix #8 Ítem 4: edad del snapshot al momento en que el server
   *  armó el último payload (WS o REST). Refresca en cada update.
   *  El hook `useMinutoEnVivo` usa `Date.now() - elapsedAgeMs` para
   *  anclar el reloj al momento REAL de captura del server — evita el
   *  desfase que aparecía al abrir la pestaña con cache stale. */
  elapsedAgeMs: number | null;
  miPosicion: MiPosicion | null;
  isLoading: boolean;
  isConnected: boolean;
  lastUpdate: number | null;
}

export function useRankingEnVivo(
  torneoId: string | null,
  opts: { initialLimit?: number } = {},
): RankingSnapshot {
  const [state, setState] = useState<RankingSnapshot>({
    torneoId: torneoId ?? "",
    ranking: [],
    totalInscritos: 0,
    minutoPartido: null,
    minutoExtra: null,
    minutoLabel: null,
    statusShort: null,
    elapsedAgeMs: null,
    miPosicion: null,
    isLoading: true,
    isConnected: false,
    lastUpdate: null,
  });
  const limit = opts.initialLimit ?? 100;
  const cleanupRef = useRef<(() => void) | null>(null);
  const lastUpdateRef = useRef<number | null>(null);

  useEffect(() => {
    if (!torneoId) return;
    let cancelled = false;

    // Helper para aplicar un snapshot del REST al state. También lo usa
    // el polling de fallback del Hotfix #6 Ítem 3.
    const applySnapshot = (d: {
      ranking: RankingRowPayload[];
      totalInscritos: number;
      minutoLabel?: string | null;
      minutoPartido?: number | null;
      minutoExtra?: number | null;
      statusShort?: string | null;
      elapsedAgeMs?: number | null;
      miPosicion?: {
        posicion: number;
        ticketId: string;
        puntosTotal: number;
      } | null;
    }) => {
      const now = Date.now();
      lastUpdateRef.current = now;
      setState((s) => ({
        ...s,
        torneoId,
        ranking: d.ranking,
        totalInscritos: d.totalInscritos,
        minutoLabel: d.minutoLabel ?? s.minutoLabel,
        minutoPartido: d.minutoPartido ?? s.minutoPartido,
        minutoExtra: d.minutoExtra ?? s.minutoExtra,
        statusShort: d.statusShort ?? s.statusShort,
        elapsedAgeMs:
          d.elapsedAgeMs !== undefined ? d.elapsedAgeMs : s.elapsedAgeMs,
        miPosicion: d.miPosicion
          ? {
              posicion: d.miPosicion.posicion,
              ticketId: d.miPosicion.ticketId,
              puntosTotal: d.miPosicion.puntosTotal,
            }
          : null,
        isLoading: false,
        lastUpdate: now,
      }));
    };

    const fetchRanking = (reason: "initial" | "fallback") =>
      authedFetch(`/api/v1/torneos/${torneoId}/ranking?limit=${limit}`)
        .then((r) => r.json())
        .then((json) => {
          if (cancelled) return;
          const d = json.data;
          if (!d) return;
          applySnapshot(d);
          void reason;
        })
        .catch(() => {
          if (!cancelled && reason === "initial") {
            setState((s) => ({ ...s, isLoading: false }));
          }
        });

    // 1. Fetch inicial — `authedFetch` envía la cookie de NextAuth para
    // que el backend pueda derivar `miPosicion` cuando hay sesión.
    void fetchRanking("initial");

    // 2. Polling de fallback (Hotfix #6 Ítem 3): cada 45s refrescamos
    // vía REST. Si el WS sigue alive, el polling es redundante pero
    // mantiene el minuto fresco aunque el WS se silencie.
    const pollTimer = setInterval(() => {
      if (cancelled) return;
      const last = lastUpdateRef.current;
      if (last && Date.now() - last < FALLBACK_POLL_MS) return;
      void fetchRanking("fallback");
    }, FALLBACK_POLL_MS);

    // 2. Suscripción WS
    let leaveFn: (() => void) | null = null;
    void (async () => {
      const socket = await getSocket();
      const onUpdate = (payload: RankingUpdatePayload) => {
        if (payload.torneoId !== torneoId) return;
        lastUpdateRef.current = payload.timestamp;
        setState((s) => ({
          ...s,
          ranking: payload.ranking,
          totalInscritos: payload.totalInscritos,
          minutoPartido: payload.minutoPartido,
          minutoExtra: payload.minutoExtra,
          minutoLabel: payload.minutoLabel,
          statusShort: payload.statusShort,
          elapsedAgeMs: payload.elapsedAgeMs,
          lastUpdate: payload.timestamp,
        }));
      };
      const onConnect = () =>
        setState((s) => ({ ...s, isConnected: true }));
      const onDisconnect = () =>
        setState((s) => ({ ...s, isConnected: false }));

      socket.on("ranking:update", onUpdate);
      socket.on("connect", onConnect);
      socket.on("disconnect", onDisconnect);
      if (socket.connected) onConnect();

      leaveFn = await joinTorneo(torneoId);
      cleanupRef.current = () => {
        socket.off("ranking:update", onUpdate);
        socket.off("connect", onConnect);
        socket.off("disconnect", onDisconnect);
        leaveFn?.();
      };
    })();

    return () => {
      cancelled = true;
      clearInterval(pollTimer);
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [torneoId, limit]);

  return state;
}
