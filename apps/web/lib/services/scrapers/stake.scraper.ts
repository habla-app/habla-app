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
// Discovery V.5 — Lote V fase V.5:
//   El cache CDN de Stake (`pre-143o-sp.websbkt.com`) expone también un
//   endpoint de listado por liga: `/cache/{operatorId}/{lang}/{country}/sportsbookcommon/upcoming-events.json`
//   y variantes por torneo. La estrategia es defensiva: probamos los
//   endpoints conocidos en orden hasta que uno responda con eventos.
//
//   Liga 1 Perú aparece en el listado upcoming con `tournament_id`
//   propio. El POC no documentó el ID exacto del torneo en Stake, así
//   que el discovery primero baja la lista upcoming completa y filtra
//   por equipo + fecha vía AliasEquipo.
//
//   Si el listado no devuelve nada (ej. liga no habilitada en Perú o
//   endpoint cambiado), retornamos null y queda al fallback manual.

import { logger } from "../logger";
import { httpFetchJson, httpProbeJson } from "./http";
import {
  fechasCercanas,
  matchearEquiposContraPartido,
} from "./alias-equipo";
import type { CuotasCapturadas, ResultadoScraper, Scraper } from "./types";

interface PartidoSlim {
  id: string;
  liga: string;
  equipoLocal: string;
  equipoVisita: string;
  fechaInicio: Date;
}

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

// Endpoints candidato de discovery (V.5). Probamos en orden hasta que uno
// devuelva eventos. Las rutas son las observadas en otras instalaciones
// WebSBKT — al ser misma plataforma, alta probabilidad de hit en Stake Perú.
const ENDPOINTS_DISCOVERY: Array<(qs: URLSearchParams) => string> = [
  () =>
    `https://${HOST}/cache/${OPERATOR_ID}/${LANG}/${COUNTRY}/sportsbookcommon/upcoming-events.json`,
  () =>
    `https://${HOST}/cache/${OPERATOR_ID}/${LANG}/${COUNTRY}/sportsbookcommon/pre-events.json`,
  (qs) =>
    `https://${HOST}/cache/${OPERATOR_ID}/${LANG}/${COUNTRY}/sportsbookcommon/events-by-sport.json?${qs.toString()}`,
];

const VENTANA_DISCOVERY_MIN = 60;

interface StakeEvento {
  id: string;
  homeName: string;
  awayName: string;
  kickoff: Date;
}

function leerNombreEquipoStake(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.name === "string") return o.name;
    if (typeof o.shortName === "string") return o.shortName;
  }
  return "";
}

function leerFechaStake(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === "number") {
    const ms = v < 1e12 ? v * 1000 : v;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function extraerEventosStake(payload: unknown): StakeEvento[] {
  function rec(node: unknown, depth = 0): unknown[] {
    if (depth > 6 || !node || typeof node !== "object") return [];
    if (Array.isArray(node)) {
      const sample = node.find((it) => it && typeof it === "object");
      if (
        sample &&
        typeof sample === "object" &&
        ("home_team" in (sample as object) ||
          "homeTeam" in (sample as object) ||
          "team_home" in (sample as object) ||
          "teams" in (sample as object) ||
          "h" in (sample as object))
      ) {
        return node;
      }
      for (const item of node) {
        const found = rec(item, depth + 1);
        if (found.length) return found;
      }
      return [];
    }
    const obj = node as Record<string, unknown>;
    for (const key of [
      "events",
      "matches",
      "items",
      "data",
      "list",
      "results",
      "fixtures",
    ]) {
      if (key in obj) {
        const found = rec(obj[key], depth + 1);
        if (found.length) return found;
      }
    }
    return [];
  }

  const arr = rec(payload);
  const out: StakeEvento[] = [];
  for (const node of arr) {
    if (!node || typeof node !== "object") continue;
    const m = node as Record<string, unknown>;
    const id = String(m.id ?? m.event_id ?? m.eventId ?? "");
    if (!id || !/^\d+$/.test(id)) continue;

    const homeName = leerNombreEquipoStake(
      m.home_team ?? m.homeTeam ?? m.team_home ?? m.h ?? m.home,
    );
    const awayName = leerNombreEquipoStake(
      m.away_team ?? m.awayTeam ?? m.team_away ?? m.a ?? m.away,
    );
    if (!homeName || !awayName) continue;

    const kickoff = leerFechaStake(
      m.start_time ?? m.startTime ?? m.kickoff ?? m.starts_at ?? m.date ?? m.timestamp,
    );
    if (!kickoff) continue;
    out.push({ id, homeName, awayName, kickoff });
  }
  return out;
}

const stakeScraper: Scraper = {
  nombre: "stake",

  async buscarEventIdExterno(partido: PartidoSlim): Promise<string | null> {
    // V.5: probamos los endpoints upcoming en orden hasta que uno responda
    // con eventos. Si NINGUNO devuelve match único, queda al fallback manual.
    let candidatos: StakeEvento[] = [];
    for (const builder of ENDPOINTS_DISCOVERY) {
      const qs = new URLSearchParams({ sport: "1" });
      const url = builder(qs);
      try {
        const probe = await httpProbeJson<unknown>(url, {
          source: "scrapers:stake:discovery",
          timeoutMs: 8_000,
          headers: {
            Origin: "https://stake.pe",
            Referer: "https://stake.pe/deportes/",
          },
        });
        if (probe.status !== 200 || probe.data === null) continue;
        const lista = extraerEventosStake(probe.data);
        if (lista.length === 0) continue;
        candidatos = lista;
        break;
      } catch {
        continue;
      }
    }

    if (candidatos.length === 0) {
      logger.debug(
        { partidoId: partido.id, source: "scrapers:stake:discovery" },
        "discovery — ningún endpoint upcoming devolvió eventos, vincular manualmente",
      );
      return null;
    }

    let match: StakeEvento | null = null;
    for (const cand of candidatos) {
      if (!fechasCercanas(cand.kickoff, partido.fechaInicio, VENTANA_DISCOVERY_MIN)) {
        continue;
      }
      const ok = await matchearEquiposContraPartido(
        partido,
        { local: cand.homeName, visita: cand.awayName },
        "stake",
      );
      if (ok) {
        if (match) {
          logger.warn(
            { partidoId: partido.id, source: "scrapers:stake:discovery" },
            "discovery ambiguo — varios matches por equipos+fecha",
          );
          return null;
        }
        match = cand;
      }
    }

    if (!match) {
      logger.debug(
        {
          partidoId: partido.id,
          equipoLocal: partido.equipoLocal,
          equipoVisita: partido.equipoVisita,
          source: "scrapers:stake:discovery",
        },
        "discovery sin match único — pendiente de vinculación manual",
      );
      return null;
    }
    return match.id;
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
