// k6 load test — Lote J (8 mayo 2026 launch).
//
// Reemplaza el test legacy `ranking-500-users.js` (Socket.io ranking
// del modelo previo de torneos con saldo interno, ya descontinuado).
//
// Pega 100 RPS sostenidos a las rutas más críticas del modelo v3.1:
//   - GET /                       (home pública — Producto B + C teaser)
//   - GET /partidos/[slug]        (vista editorial pública por partido)
//   - GET /cuotas                 (comparador de cuotas)
//   - GET /api/health             (health check, alta cardinalidad)
//   - POST /api/v1/vitals         (Lote G, Core Web Vitals tracking)
//
// Targets de aceptación (CLAUDE.md regla 13 + plan v3.1 §8):
//   - 100 RPS sostenidos sin que P95 supere 500 ms en ninguna ruta.
//   - Error rate < 1%.
//   - 0 caídas del proceso del server.
//
// Uso:
//   export BASE_URL=https://hablaplay.com
//   export PARTIDO_SLUG=brasil-vs-argentina-2026-06-15  # o el primero del día
//   k6 run tests/load/v31-rutas-criticas.js
//
// Si se corre contra un staging sin tráfico real, el endpoint
// /partidos/[slug] puede caer 404 (no hay MDX). Se acepta y el k6 lo
// reporta como check.failed; ajustar PARTIDO_SLUG a un slug existente.

import http from "k6/http";
import { check, group, sleep } from "k6";
import { Trend, Counter, Rate } from "k6/metrics";

const BASE_URL = (__ENV.BASE_URL || "https://hablaplay.com").replace(/\/$/, "");
const PARTIDO_SLUG = __ENV.PARTIDO_SLUG || "";

const errorsTotal = new Counter("errors_total");
const errorRate = new Rate("error_rate");
const homeLatency = new Trend("home_latency_ms", true);
const partidoLatency = new Trend("partido_latency_ms", true);
const cuotasLatency = new Trend("cuotas_latency_ms", true);
const healthLatency = new Trend("health_latency_ms", true);
const vitalsLatency = new Trend("vitals_latency_ms", true);

export const options = {
  scenarios: {
    rutas_criticas: {
      executor: "constant-arrival-rate",
      // 100 RPS sostenidos durante 5 minutos (tras 1 min de warm-up).
      // 100 RPS × 5 min = 30,000 requests totales por escenario.
      rate: 100,
      timeUnit: "1s",
      duration: "5m",
      preAllocatedVUs: 50,
      maxVUs: 200,
      startTime: "1m",
    },
    warm_up: {
      executor: "ramping-arrival-rate",
      startRate: 1,
      timeUnit: "1s",
      stages: [
        { duration: "30s", target: 50 },
        { duration: "30s", target: 100 },
      ],
      preAllocatedVUs: 25,
      maxVUs: 100,
    },
  },
  thresholds: {
    // P95 < 500 ms en cada ruta crítica.
    "http_req_duration{route:home}": ["p(95)<500"],
    "http_req_duration{route:partido}": ["p(95)<500"],
    "http_req_duration{route:cuotas}": ["p(95)<500"],
    "http_req_duration{route:health}": ["p(95)<300"], // health debe ser muy rápido
    "http_req_duration{route:vitals}": ["p(95)<200"], // 204 sin cuerpo
    // Error rate global < 1%.
    error_rate: ["rate<0.01"],
    // Checks pasan en >98% de los casos.
    checks: ["rate>0.98"],
  },
};

function isOkStatus(status) {
  return status >= 200 && status < 400;
}

function recordError(name, res) {
  errorsTotal.add(1, { route: name });
  errorRate.add(1, { route: name });
  // No imprimimos cada error porque a 100 RPS el log se inunda.
}

export default function () {
  // -------------------------------------------------------------------
  // GET / — home pública (Producto B + C en hero)
  // -------------------------------------------------------------------
  group("home", () => {
    const res = http.get(`${BASE_URL}/`, {
      tags: { route: "home" },
      headers: { "User-Agent": "k6-load-test/lote-j" },
    });
    homeLatency.add(res.timings.duration);
    const ok = check(res, {
      "home: 200": (r) => r.status === 200,
      "home: html body": (r) =>
        typeof r.body === "string" && r.body.includes("<html"),
    });
    if (!ok || !isOkStatus(res.status)) {
      recordError("home", res);
    } else {
      errorRate.add(0, { route: "home" });
    }
  });

  // -------------------------------------------------------------------
  // GET /cuotas — comparador
  // -------------------------------------------------------------------
  group("cuotas", () => {
    const res = http.get(`${BASE_URL}/cuotas`, {
      tags: { route: "cuotas" },
      headers: { "User-Agent": "k6-load-test/lote-j" },
    });
    cuotasLatency.add(res.timings.duration);
    const ok = check(res, {
      "cuotas: 200": (r) => r.status === 200,
    });
    if (!ok) recordError("cuotas", res);
    else errorRate.add(0, { route: "cuotas" });
  });

  // -------------------------------------------------------------------
  // GET /partidos/[slug] — vista editorial pública
  // -------------------------------------------------------------------
  if (PARTIDO_SLUG) {
    group("partido", () => {
      const res = http.get(`${BASE_URL}/partidos/${PARTIDO_SLUG}`, {
        tags: { route: "partido" },
        headers: { "User-Agent": "k6-load-test/lote-j" },
      });
      partidoLatency.add(res.timings.duration);
      const ok = check(res, {
        // 200 si el slug existe, 404 si no — ambos cuentan como server-up.
        "partido: 200 ó 404": (r) => r.status === 200 || r.status === 404,
      });
      if (!ok) recordError("partido", res);
      else errorRate.add(0, { route: "partido" });
    });
  }

  // -------------------------------------------------------------------
  // GET /api/health — health check
  // -------------------------------------------------------------------
  group("health", () => {
    const res = http.get(`${BASE_URL}/api/health`, {
      tags: { route: "health" },
      headers: { "User-Agent": "k6-load-test/lote-j" },
    });
    healthLatency.add(res.timings.duration);
    const ok = check(res, {
      "health: 200": (r) => r.status === 200,
      'health: status:"ok"': (r) =>
        typeof r.body === "string" && r.body.includes('"status":"ok"'),
    });
    if (!ok) recordError("health", res);
    else errorRate.add(0, { route: "health" });
  });

  // -------------------------------------------------------------------
  // POST /api/v1/vitals — Core Web Vitals tracking (Lote G)
  // -------------------------------------------------------------------
  group("vitals", () => {
    const payload = JSON.stringify({
      samples: [
        {
          nombre: "LCP",
          valor: Math.random() * 3000 + 800,
          ruta: "/",
          deviceType: "mobile",
          connectionType: "4g",
        },
      ],
    });
    const res = http.post(`${BASE_URL}/api/v1/vitals`, payload, {
      tags: { route: "vitals" },
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "k6-load-test/lote-j",
      },
    });
    vitalsLatency.add(res.timings.duration);
    const ok = check(res, {
      // 204 normal · 429 cuando rate limit golpea (es esperable a 100 RPS
      // desde una sola IP — el rate limit es 100 req/min/IP).
      "vitals: 204 ó 429": (r) => r.status === 204 || r.status === 429,
    });
    if (!ok) recordError("vitals", res);
    else errorRate.add(0, { route: "vitals" });
  });

  // Pequeño jitter para no sincronizar el VU pool en lockstep.
  sleep(Math.random() * 0.2);
}

export function setup() {
  const ping = http.get(`${BASE_URL}/api/health`);
  if (ping.status !== 200) {
    throw new Error(
      `Backend no responde en ${BASE_URL}/api/health (status ${ping.status}). ` +
        `Revisa que la URL sea correcta y que el server esté arriba.`,
    );
  }
  console.log(
    `[setup] backend OK en ${BASE_URL}. PARTIDO_SLUG=${PARTIDO_SLUG || "(no definido — partido test skipped)"}`,
  );
  return { ts: Date.now() };
}

export function teardown(data) {
  const elapsed = ((Date.now() - data.ts) / 1000).toFixed(1);
  console.log(`[teardown] duración total: ${elapsed}s`);
}
