"use client";
// Hook que trae la timeline de eventos de un partido y se actualiza en
// vivo con `partido:evento` (inserción) + `partido:evento-invalidado`
// (eliminación, Hotfix #6) por Socket.io. Se suscribe al mismo room
// del torneo (el poller emite al room del torneo, no al del partido),
// así que el caller pasa `torneoId` + `partidoId`.

import { useEffect, useRef, useState } from "react";
import { joinTorneo, getSocket } from "@/lib/realtime/socket-client";
import { authedFetch } from "@/lib/api-client";
import type {
  PartidoEventoPayload,
  PartidoEventoInvalidadoPayload,
} from "@/lib/realtime/events";

export interface EventoTimeline {
  id: string;
  tipo: string;
  minuto: number;
  equipo: string;
  jugador: string | null;
  detalle: string | null;
  marcadorLocal?: number;
  marcadorVisita?: number;
}

export function useEventosPartido(
  torneoId: string | null,
  partidoId: string | null,
): {
  eventos: EventoTimeline[];
  isLoading: boolean;
  marcadorLive: { local: number; visita: number } | null;
} {
  const [eventos, setEventos] = useState<EventoTimeline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [marcadorLive, setMarcadorLive] = useState<
    { local: number; visita: number } | null
  >(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!partidoId) return;
    let cancelled = false;

    authedFetch(`/api/v1/partidos/${partidoId}/eventos`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        setEventos(json.data?.eventos ?? []);
        setIsLoading(false);
      })
      .catch(() => !cancelled && setIsLoading(false));

    if (!torneoId) return;

    let leaveFn: (() => void) | null = null;
    void (async () => {
      const socket = await getSocket();
      const onEvento = (payload: PartidoEventoPayload) => {
        if (payload.torneoId !== torneoId) return;
        if (payload.partidoId !== partidoId) return;
        // Evitar duplicados en el cliente (el server ya protege pero
        // en transit podría llegar un evento idéntico por reconexión).
        setEventos((prev) => {
          const key = `${payload.tipo}|${payload.minuto}|${payload.equipo}|${payload.jugador ?? ""}`;
          if (
            prev.some(
              (e) =>
                `${e.tipo}|${e.minuto}|${e.equipo}|${e.jugador ?? ""}` === key,
            )
          ) {
            return prev;
          }
          return [
            ...prev,
            {
              id: `live-${Date.now()}-${key}`,
              tipo: payload.tipo,
              minuto: payload.minuto,
              equipo: payload.equipo,
              jugador: payload.jugador,
              detalle: payload.detalle,
              marcadorLocal: payload.marcadorLocal,
              marcadorVisita: payload.marcadorVisita,
            },
          ].sort((a, b) => a.minuto - b.minuto);
        });
        setMarcadorLive({
          local: payload.marcadorLocal,
          visita: payload.marcadorVisita,
        });
      };
      // Hotfix #6 Ítem 2: evento invalidado (VAR anula gol, roja revocada).
      // El cliente remueve la fila de la timeline al recibirlo.
      const onInvalidado = (payload: PartidoEventoInvalidadoPayload) => {
        if (payload.torneoId !== torneoId) return;
        if (payload.partidoId !== partidoId) return;
        setEventos((prev) =>
          prev.filter(
            (e) =>
              `${e.tipo}|${e.minuto}|${e.equipo}|${e.jugador ?? ""}` !==
              payload.naturalKey,
          ),
        );
      };
      socket.on("partido:evento", onEvento);
      socket.on("partido:evento-invalidado", onInvalidado);
      leaveFn = await joinTorneo(torneoId);
      cleanupRef.current = () => {
        socket.off("partido:evento", onEvento);
        socket.off("partido:evento-invalidado", onInvalidado);
        leaveFn?.();
      };
    })();

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [torneoId, partidoId]);

  return { eventos, isLoading, marcadorLive };
}
