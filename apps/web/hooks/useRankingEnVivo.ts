"use client";
// Hook que mantiene el ranking de un torneo actualizado en vivo. Hace
// fetch inicial al GET /api/v1/torneos/:id/ranking y se suscribe al
// room del torneo para recibir `ranking:update` por Socket.io.

import { useEffect, useRef, useState } from "react";
import { joinTorneo, getSocket } from "@/lib/realtime/socket-client";
import type {
  RankingRowPayload,
  RankingUpdatePayload,
} from "@/lib/realtime/events";

export interface MiPosicion {
  posicion: number;
  ticketId: string;
  puntosTotal: number;
  premioEstimado: number;
}

export interface RankingSnapshot {
  torneoId: string;
  ranking: RankingRowPayload[];
  totalInscritos: number;
  pozoNeto: number;
  minutoPartido: number | null;
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
    pozoNeto: 0,
    minutoPartido: null,
    miPosicion: null,
    isLoading: true,
    isConnected: false,
    lastUpdate: null,
  });
  const limit = opts.initialLimit ?? 100;
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!torneoId) return;
    let cancelled = false;

    // 1. Fetch inicial
    fetch(`/api/v1/torneos/${torneoId}/ranking?limit=${limit}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const d = json.data;
        if (!d) return;
        setState((s) => ({
          ...s,
          torneoId,
          ranking: d.ranking,
          totalInscritos: d.totalInscritos,
          pozoNeto: d.pozoNeto,
          miPosicion: d.miPosicion
            ? {
                posicion: d.miPosicion.posicion,
                ticketId: d.miPosicion.ticketId,
                puntosTotal: d.miPosicion.puntosTotal,
                premioEstimado: d.miPosicion.premioEstimado,
              }
            : null,
          isLoading: false,
          lastUpdate: Date.now(),
        }));
      })
      .catch(() => {
        if (!cancelled) setState((s) => ({ ...s, isLoading: false }));
      });

    // 2. Suscripción WS
    let leaveFn: (() => void) | null = null;
    void (async () => {
      const socket = await getSocket();
      const onUpdate = (payload: RankingUpdatePayload) => {
        if (payload.torneoId !== torneoId) return;
        setState((s) => ({
          ...s,
          ranking: payload.ranking,
          totalInscritos: payload.totalInscritos,
          pozoNeto: payload.pozoNeto,
          minutoPartido: payload.minutoPartido,
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
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [torneoId, limit]);

  return state;
}
