// Scraper Stake.pe — Lote V fase V.2.
//
// Stake.pe es el sportsbook proprietario peruano "WebSBKT" (cache JSON
// estático servido por CDN). NO es el GraphQL público de stake.com.
//
// Endpoint clave (validado POC 03/05/2026 — sección 2.1):
//   GET https://pre-143o-sp.websbkt.com/cache/143/es/pe/{eventId}/single-pre-event.json
// donde:
//   - 143 = operator ID (Stake Perú)
//   - es/pe = lang/country
//   - eventId = ID numérico del partido (ej. 25792580)
//
// Estructura del JSON (POC):
//   {
//     info:    { id, country_id, sport_id, tournament_id, teams, ... },
//     odds:    { "<id>": { odd_code, odd_value, union_id, additional_value, ... } },
//     filters: [...]
//   }
//
// Mapeo de mercados (sección 6.3 del plan + POC):
//   - union_id 20001 = 1X2          → ODD_S1, ODD_SX, ODD_S2
//   - union_id 20002 = Doble Op     → ODD_D1X, ODD_D12, ODD_DX2
//   - union_id 20201 (additional_value=2.5) = ±2.5 goles
//                                    → ODD_TTL_1_OVR, ODD_TTL_1_UND
//   - union_id 21301 = BTTS         → ODD_FTB_BOTHTEAMSSCORE_YES/NO
//
// Discovery: el POC no logró identificar el endpoint de búsqueda público
// usado por la sidebar de stake.pe (la URL `/deportes/.../{slug}/event/{id}`
// se obtiene via autocomplete que parece consumir un endpoint backend
// no expuesto). Para V.2 dejamos `buscarEventIdExterno` devolviendo null
// — el admin vincula manualmente desde la UI de Lote V.5 pegando la URL
// del partido (regex `/event/(\d+)/`). Cuando V.5 identifique el endpoint
// público o agreguemos algún listing alternativo, el método se extiende
// sin tocar el resto.

import { logger } from "../logger";
import { httpFetchJson } from "./http";
import type { CuotasCapturadas, ResultadoScraper, Scraper } from "./types";

const OPERATOR_ID = "143";
const LANG = "es";
const COUNTRY = "pe";
const HOST = "pre-143o-sp.websbkt.com";

interface StakeOdd {
  odd_code?: string;
  odd_value?: number | string;
  union_id?: number | string;
  additional_value?: number | string;
  /** Algunos pares vienen con flag de suspensión. */
  is_suspended?: boolean | number;
}

interface StakeCachePayload {
  info?: Record<string, unknown>;
  odds?: Record<string, StakeOdd>;
  filters?: unknown[];
}

const UNION_1X2 = 20001;
const UNION_DOBLE = 20002;
const UNION_TOTALES = 20201;
const UNION_BTTS = 21301;
const LINEA_TOTALES = 2.5;

/** Convierte odd_value (number | string con coma/punto) → número positivo. */
function toCuota(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(",", ".").trim());
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

function eqUnion(a: unknown, target: number): boolean {
  if (a === undefined || a === null) return false;
  return Number(a) === target;
}

function eqLinea(a: unknown, target: number): boolean {
  if (a === undefined || a === null) return false;
  const n = typeof a === "string" ? Number(a.replace(",", ".")) : Number(a);
  return Number.isFinite(n) && Math.abs(n - target) < 1e-6;
}

function isSuspendido(o: StakeOdd): boolean {
  if (o.is_suspended === true) return true;
  if (typeof o.is_suspended === "number" && o.is_suspended !== 0) return true;
  return false;
}

/**
 * Convierte el `odds` map de Stake en `CuotasCapturadas`. Recorre todas las
 * selecciones; para cada `union_id` conocido, mapea por `odd_code` al
 * outcome correspondiente.
 *
 * Si una selección está suspendida (`is_suspended=true`) la skipea — el
 * resultado puede quedar parcial; el caller decide si igual la persiste.
 */
function mapearCuotasStake(payload: StakeCachePayload): CuotasCapturadas {
  const out: CuotasCapturadas = {};
  const odds = payload.odds ?? {};

  let s1: number | undefined;
  let sx: number | undefined;
  let s2: number | undefined;

  let d1x: number | undefined;
  let d12: number | undefined;
  let dx2: number | undefined;

  let over: number | undefined;
  let under: number | undefined;

  let bttsYes: number | undefined;
  let bttsNo: number | undefined;

  for (const o of Object.values(odds)) {
    if (!o || typeof o !== "object" || isSuspendido(o)) continue;
    const code = (o.odd_code ?? "").toString().toUpperCase();
    const cuota = toCuota(o.odd_value);
    if (!code || cuota === undefined) continue;

    if (eqUnion(o.union_id, UNION_1X2)) {
      if (code === "ODD_S1") s1 = cuota;
      else if (code === "ODD_SX") sx = cuota;
      else if (code === "ODD_S2") s2 = cuota;
      continue;
    }
    if (eqUnion(o.union_id, UNION_DOBLE)) {
      if (code === "ODD_D1X") d1x = cuota;
      else if (code === "ODD_D12") d12 = cuota;
      else if (code === "ODD_DX2") dx2 = cuota;
      continue;
    }
    if (eqUnion(o.union_id, UNION_TOTALES) && eqLinea(o.additional_value, LINEA_TOTALES)) {
      if (code === "ODD_TTL_1_OVR") over = cuota;
      else if (code === "ODD_TTL_1_UND") under = cuota;
      continue;
    }
    if (eqUnion(o.union_id, UNION_BTTS)) {
      if (code === "ODD_FTB_BOTHTEAMSSCORE_YES") bttsYes = cuota;
      else if (code === "ODD_FTB_BOTHTEAMSSCORE_NO") bttsNo = cuota;
      continue;
    }
  }

  if (s1 !== undefined && sx !== undefined && s2 !== undefined) {
    out["1x2"] = { local: s1, empate: sx, visita: s2 };
  }
  if (d1x !== undefined && d12 !== undefined && dx2 !== undefined) {
    out.doble_op = { x1: d1x, x12: d12, xx2: dx2 };
  }
  if (over !== undefined && under !== undefined) {
    out.mas_menos_25 = { over, under };
  }
  if (bttsYes !== undefined && bttsNo !== undefined) {
    out.btts = { si: bttsYes, no: bttsNo };
  }

  return out;
}

function buildUrl(eventId: string): string {
  return `https://${HOST}/cache/${OPERATOR_ID}/${LANG}/${COUNTRY}/${eventId}/single-pre-event.json`;
}

const stakeScraper: Scraper = {
  nombre: "stake",

  async buscarEventIdExterno(): Promise<string | null> {
    // POC no documentó endpoint de búsqueda público. Fallback manual del
    // Lote V.5 cubre este caso (admin pega URL del partido y el regex
    // `/event/(\d+)/` extrae el id). El logger.debug deja traza para
    // poder cuantificar cuántas veces el discovery quedó pendiente.
    logger.debug(
      { source: "scrapers:stake" },
      "discovery automático no disponible — vincular manualmente",
    );
    return null;
  },

  async capturarCuotas(eventIdExterno: string): Promise<ResultadoScraper> {
    if (!/^\d+$/.test(eventIdExterno)) {
      throw new Error(
        `Stake: eventId inválido "${eventIdExterno}" — se esperaba número entero`,
      );
    }
    const url = buildUrl(eventIdExterno);
    const payload = await httpFetchJson<StakeCachePayload>(url, {
      source: "scrapers:stake",
      headers: {
        Origin: "https://stake.pe",
        Referer: `https://stake.pe/deportes/event/${eventIdExterno}`,
      },
    });

    if (!payload || typeof payload !== "object") {
      throw new Error(`Stake: respuesta vacía o malformada para ${eventIdExterno}`);
    }

    const cuotas = mapearCuotasStake(payload);
    if (Object.keys(cuotas).length === 0) {
      throw new Error(
        `Stake: el partido ${eventIdExterno} no expuso ningún mercado conocido (1X2/DobleOp/Totales 2.5/BTTS)`,
      );
    }

    return {
      cuotas,
      fuente: { url, capturadoEn: new Date() },
    };
  },
};

export default stakeScraper;
