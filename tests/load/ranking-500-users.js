// k6 load test — Sub-Sprint 5 (LEGACY, modelo previo al pivot v3.1).
//
// DEPRECADO desde Lote J (1 may 2026). El modelo v3.1 ya no tiene
// torneos con saldo interno ni ranking en tiempo real vía Socket.io
// para usuarios anónimos: la Liga Habla! comunitaria muestra ranking
// vía SSR + revalidate, no broadcast WS para anónimos.
//
// Para load testing de las rutas críticas v3.1 usar:
//   tests/load/v31-rutas-criticas.js
//
// Este archivo se mantiene como referencia histórica del comportamiento
// de Socket.io del Sub-Sprint 5, por si vuelve a levantarse el stress
// test del namespace `/torneo` para staff admin/live-match (Lote 0).

import { check, sleep } from "k6";
import ws from "k6/ws";
import http from "k6/http";
import { Counter, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const TORNEO_ID = __ENV.TORNEO_ID || "replace-me";

export const options = {
  scenarios: {
    ranking_stress: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 100 }, /* warm-up */
        { duration: "2m", target: 500 }, /* ramp-up */
        { duration: "10m", target: 500 }, /* steady state */
        { duration: "1m", target: 0 }, /* cool-down */
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    ws_update_latency: ["p(95)<500"], /* ms */
    ws_errors: ["count<50"],
    "checks": ["rate>0.98"],
  },
};

const wsUpdatesReceived = new Counter("ws_updates_total");
const wsErrors = new Counter("ws_errors");
const wsUpdateLatency = new Trend("ws_update_latency");

export default function () {
  // Paso 1: pedir el token HS256 (el token lo recibirías después de
  // autenticar en el webapp; en un test de carga anónimo lo saltamos
  // y conectamos sin token — el server permite conexiones anónimas
  // de sólo-lectura).
  const url = `${BASE_URL.replace("http", "ws")}/socket.io/?EIO=4&transport=websocket`;

  const res = ws.connect(url, {}, (socket) => {
    socket.on("open", () => {
      // Socket.io namespace + join al room del torneo
      socket.send("40"); /* CONNECT del Engine.IO + namespace "/" */
      socket.send(
        `42["join:torneo",${JSON.stringify({ torneoId: TORNEO_ID })}]`,
      );
    });

    socket.on("message", (msg) => {
      // socket.io v4 con EIO=4 encapsula mensajes como:
      // "42/[event_name, payload]"
      if (typeof msg !== "string") return;
      if (!msg.startsWith("42")) return;
      try {
        const body = JSON.parse(msg.slice(2));
        if (Array.isArray(body) && body[0] === "ranking:update") {
          wsUpdatesReceived.add(1);
          const payload = body[1];
          if (payload?.timestamp) {
            const latency = Date.now() - payload.timestamp;
            wsUpdateLatency.add(latency);
          }
        }
      } catch {
        wsErrors.add(1);
      }
    });

    socket.on("error", () => {
      wsErrors.add(1);
    });

    socket.setTimeout(() => {
      socket.send(
        `42["leave:torneo",${JSON.stringify({ torneoId: TORNEO_ID })}]`,
      );
      socket.close();
    }, 9 * 60 * 1000);
  });

  check(res, { "ws handshake 101": (r) => r && r.status === 101 });
}

// Helper opcional: cuando tengas un usuario de test con JWT, ejecutar
// este setup antes del default fn para probar el flujo autenticado.
export function setup() {
  const ping = http.get(`${BASE_URL}/api/v1/torneos?limit=1`);
  check(ping, {
    "backend disponible": (r) => r.status === 200,
  });
  if (ping.status !== 200) {
    throw new Error(
      `Backend no responde en ${BASE_URL}. Arranca el server antes de correr k6.`,
    );
  }
  return {};
}
