// Custom server para Next.js + Socket.io.
//
// Decisión arquitectónica (Sub-Sprint 5, CLAUDE.md §15):
//   Reemplazamos `next start` por este `server.ts` para montar Socket.io
//   sobre el mismo HTTP server que sirve Next. Mismo proceso, mismo
//   puerto, mismo balance de Railway: 0 servicios nuevos.
//
// El handshake WS autentica con un JWT HS256 de vida corta emitido por
// GET /api/v1/realtime/token (que sí puede leer la sesión NextAuth).
//
// Cuando el custom server no está disponible (ej. `next dev` legado) las
// funciones de emitters.ts degradan a no-op, por lo que el HTTP sigue
// funcionando igual — solo perdemos real-time.

import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from "./lib/realtime/events";
import { SOCKET_PATH } from "./lib/realtime/events";
import { verificarSocketToken } from "./lib/realtime/socket-auth";
import { setIO } from "./lib/realtime/emitters";
import { logger } from "./lib/services/logger";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = Number(process.env.PORT || 3000);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

async function main() {
  await app.prepare();

  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      logger.error({ err, url: req.url }, "HTTP handle error");
      res.statusCode = 500;
      res.end("internal error");
    }
  });

  const io = new SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    SocketData
  >(httpServer, {
    path: SOCKET_PATH,
    // CORS permisivo en dev; en prod el cliente vive en el mismo origin.
    cors: dev
      ? { origin: true, credentials: true }
      : { origin: false, credentials: true },
    // Transports por defecto (polling + websocket); en Railway
    // ambos funcionan.
    transports: ["websocket", "polling"],
    // Pings cortos para detectar sockets zombi rápido.
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  // Handshake auth — rechaza conexiones sin token válido pero permite
  // conexiones anónimas (socket.data.usuarioId = null) para que los
  // viewers no-logueados puedan ver el ranking en vivo.
  io.use(async (socket, nextFn) => {
    const token = socket.handshake.auth?.token;
    if (typeof token === "string" && token.length > 0) {
      const payload = await verificarSocketToken(token);
      if (payload) {
        socket.data.usuarioId = payload.usuarioId;
        return nextFn();
      }
      // Token presente pero inválido → rechazar.
      return nextFn(new Error("invalid_token"));
    }
    socket.data.usuarioId = null;
    return nextFn();
  });

  io.on("connection", (socket) => {
    logger.debug(
      { socketId: socket.id, usuarioId: socket.data.usuarioId },
      "WS conexión",
    );

    socket.on("join:torneo", ({ torneoId }) => {
      if (typeof torneoId !== "string" || torneoId.length === 0) return;
      socket.join(`torneo:${torneoId}`);
    });

    socket.on("leave:torneo", ({ torneoId }) => {
      if (typeof torneoId !== "string" || torneoId.length === 0) return;
      socket.leave(`torneo:${torneoId}`);
    });

    socket.on("disconnect", (reason) => {
      logger.debug({ socketId: socket.id, reason }, "WS desconexión");
    });
  });

  setIO(io);

  httpServer.listen(port, hostname, () => {
    logger.info(
      { port, hostname, dev, wsPath: SOCKET_PATH },
      "[server] listo — Next + Socket.io",
    );
  });
}

main().catch((err) => {
  logger.error({ err }, "[server] fallo catastrófico");
  process.exit(1);
});
