// Cliente Socket.io — singleton por tab.
//
// Antes de conectar, pedimos al backend un JWT corto (GET
// /api/v1/realtime/token) y lo pasamos como `auth.token` del handshake.
// Si el usuario no está logueado, conectamos sin token (socket.data
// .usuarioId = null en el server). Eso permite ver ranking en vivo
// sin sesión.

import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "./events";
import { SOCKET_PATH } from "./events";
import { authedFetch } from "@/lib/api-client";

export type HablaSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface SocketContainer {
  socket: HablaSocket;
  joinedTorneos: Set<string>;
  refCounts: Map<string, number>;
}

let container: SocketContainer | null = null;

async function fetchToken(): Promise<string | null> {
  try {
    const res = await authedFetch("/api/v1/realtime/token");
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: { token?: string };
    };
    return json.data?.token ?? null;
  } catch {
    return null;
  }
}

async function createSocket(): Promise<HablaSocket> {
  const token = await fetchToken();
  const socket: HablaSocket = io({
    path: SOCKET_PATH,
    // Reconexión automática con backoff
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
    auth: token ? { token } : {},
    autoConnect: true,
    transports: ["websocket", "polling"],
  });
  return socket;
}

export async function getSocket(): Promise<HablaSocket> {
  if (container) return container.socket;
  const socket = await createSocket();
  container = {
    socket,
    joinedTorneos: new Set(),
    refCounts: new Map(),
  };
  return socket;
}

/**
 * Se une al room de un torneo con ref-counting: varios componentes
 * pueden "pedir" el mismo torneoId sin que se haga `leave` hasta que
 * el último lo suelte. Devuelve una función de cleanup.
 */
export async function joinTorneo(torneoId: string): Promise<() => void> {
  const socket = await getSocket();
  if (!container) throw new Error("socket container ausente");

  const current = container.refCounts.get(torneoId) ?? 0;
  container.refCounts.set(torneoId, current + 1);
  if (current === 0) {
    socket.emit("join:torneo", { torneoId });
    container.joinedTorneos.add(torneoId);
  }

  return () => {
    if (!container) return;
    const newCount = (container.refCounts.get(torneoId) ?? 1) - 1;
    if (newCount <= 0) {
      socket.emit("leave:torneo", { torneoId });
      container.refCounts.delete(torneoId);
      container.joinedTorneos.delete(torneoId);
    } else {
      container.refCounts.set(torneoId, newCount);
    }
  };
}

/** Cierra la conexión completamente (uso para testing / signOut). */
export function disconnect(): void {
  if (!container) return;
  container.socket.disconnect();
  container = null;
}
