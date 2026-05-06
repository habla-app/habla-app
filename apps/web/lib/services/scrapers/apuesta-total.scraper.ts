// Scraper Apuesta Total via Playwright + XHR intercept (Lote V.12 — May 2026).
//
// Apuesta Total embebe Kambi (`prod20392.kmianko.com`). El listing dispara
// un snapshot con fixtures (sin todas las cuotas — el ML0/1X2 trae solo
// 1 selection). Para los 4 mercados completos hay que hacer doble nav a
// la URL detalle del SPA (`?fpath=/es-pe/spbkv3/{Sport}/{Region}/{League}/
// {slug}/{eventId}`), donde el fixture expone SportName/RegionName/
// LeagueName que permiten construir el path dinámicamente.
//
// El detalle dispara `/eventpage/events/{id}` con shape minificado
// posicional (arrays anidados con índices) — el parser tiene helpers
// específicos para ML0 (1X2) y QA61 (Doble Op).

import { logger } from "../logger";
import { similitudEquipos, UMBRAL_FUZZY_DEFAULT } from "./fuzzy-match";
import {
  recolectarJsons,
  priceOk,
  norm,
  type JsonCapturado,
  type DobleNavCtx,
} from "./playwright-runner";
import {
  mercadosFaltantes,
  CapturaSinDatosError,
  type CuotasCapturadas,
  type ResultadoScraper,
  type Scraper,
} from "./types";

// Lote V.13.1: subido de 8s a 15s — paridad con script lean exitoso.
const TIEMPO_ESPERA_MS = 15_000;
const UMBRAL_FUZZY = UMBRAL_FUZZY_DEFAULT * 0.7;

const apuestaTotalScraper: Scraper = {
  nombre: "apuesta_total",

  async capturarConPlaywright(partido, ligaCanonica) {
    // Doble nav requiere el fixture matched para construir URL — guardamos
    // el resultado del primer parse en una closure y la usamos en dobleNav.
    let fixtureMatched: any = null;
    let eventIdMatched: string | null = null;

    const recolectado = await recolectarJsons({
      casa: "apuesta_total",
      ligaCanonica,
      partido,
      dobleNav: async (ctx) => {
        // Pre-parse para encontrar fixture
        for (const j of ctx.todosJsons) {
          if (
            !Array.isArray(j.body) ||
            !j.body.length ||
            !(j.body as any[])[0]?.Participants
          ) {
            continue;
          }
          const fixtures = j.body as any[];
          let mejor: any = null;
          let mejorScore = 0;
          for (const f of fixtures) {
            const home = f.Participants?.find(
              (p: any) => p.VenueRole === "Home",
            )?.Name;
            const away = f.Participants?.find(
              (p: any) => p.VenueRole === "Away",
            )?.Name;
            if (!home || !away) continue;
            const score = Math.min(
              similitudEquipos(home, partido.equipoLocal),
              similitudEquipos(away, partido.equipoVisita),
            );
            if (score > mejorScore) {
              mejorScore = score;
              mejor = f;
            }
          }
          if (mejor && mejorScore >= UMBRAL_FUZZY) {
            fixtureMatched = mejor;
            eventIdMatched = String(mejor._id);
            break;
          }
        }
        if (!fixtureMatched || !eventIdMatched) return;
        await dobleNavApuestaTotal(ctx, fixtureMatched, eventIdMatched);
      },
    });

    if (!recolectado) return null;

    const r = parsearApuestaTotal(
      recolectado.jsons,
      partido.equipoLocal,
      partido.equipoVisita,
    );
    if (!r) {
      logger.info(
        {
          partidoId: partido.id,
          ligaCanonica,
          jsonsCapturados: recolectado.jsons.length,
          source: "scrapers:apuesta-total",
        },
        `apuesta-total: parser no encontró el partido`,
      );
      return null;
    }

    const faltan = mercadosFaltantes(r.cuotas);
    if (faltan.length > 0) {
      throw new CapturaSinDatosError(
        `apuesta-total: cuotas parciales (faltan ${faltan.join(",")})`,
      );
    }

    const result: ResultadoScraper = {
      cuotas: r.cuotas,
      fuente: { url: r.jsonUrl ?? recolectado.listingUrl, capturadoEn: new Date() },
      eventIdCasa: r.eventoId ? String(r.eventoId) : undefined,
      equipos: r.equipos,
    };
    return result;
  },
};

// ─── Doble nav: URL detalle derivada de SportName/RegionName/LeagueName ─

async function dobleNavApuestaTotal(
  ctx: DobleNavCtx,
  fixture: any,
  eventId: string,
): Promise<void> {
  const sportName: string | undefined =
    (typeof fixture.SportName === "string" && fixture.SportName) ||
    fixture.Sport?.Name;
  const regionName: string | undefined =
    (typeof fixture.RegionName === "string" && fixture.RegionName) ||
    fixture.Region?.Name;
  const leagueName: string | undefined =
    (typeof fixture.LeagueName === "string" && fixture.LeagueName) ||
    fixture.League?.Name;
  if (!sportName || !regionName || !leagueName) return;

  const slugLocal = ctx.partido.equipoLocal.replace(/\s+/g, "-");
  const slugVisita = ctx.partido.equipoVisita.replace(/\s+/g, "-");
  const slugPartido = `${slugLocal}-vs-${slugVisita}`;
  const sport = sportName.replace(/\s+/g, "-");
  const region = regionName.replace(/\s+/g, "-");
  const league = leagueName.replace(/\s+/g, "-");
  const urlDetalle = `https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/${sport}/${region}/${league}/${slugPartido}/${eventId}`;

  try {
    await ctx.page.goto(urlDetalle, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await ctx.page.waitForTimeout(2000);
    await ctx.page.waitForTimeout(TIEMPO_ESPERA_MS);
  } catch {
    /* doble nav best-effort */
  }
}

// ─── Parser Kambi ───────────────────────────────────────────────────

interface ParserResult {
  cuotas: CuotasCapturadas;
  eventoId?: string | number;
  jsonUrl?: string;
  equipos?: { local: string; visita: string };
}

function parsearApuestaTotal(
  jsons: JsonCapturado[],
  equipoLocal: string,
  equipoVisita: string,
): ParserResult | null {
  // 1) Snapshot listing tiene fixtures con Participants
  const snapshot = jsons.find(
    (j) =>
      Array.isArray(j.body) &&
      (j.body as any[]).length > 0 &&
      (j.body as any[])[0]?.Participants,
  );
  if (!snapshot) return null;
  const fixtures = snapshot.body as any[];
  let mejorFix: any = null;
  let mejorScore = 0;
  for (const f of fixtures) {
    const home = f.Participants?.find((p: any) => p.VenueRole === "Home")?.Name;
    const away = f.Participants?.find((p: any) => p.VenueRole === "Away")?.Name;
    if (!home || !away) continue;
    const score = Math.min(
      similitudEquipos(home, equipoLocal),
      similitudEquipos(away, equipoVisita),
    );
    if (score > mejorScore) {
      mejorScore = score;
      mejorFix = f;
    }
  }
  if (!mejorFix || mejorScore < UMBRAL_FUZZY) return null;

  // 2) Recolectar markets de TODOS los JSONs (walk permisivo)
  const eventId = mejorFix._id;
  const markets: any[] = [];
  const seenMarketIds = new Set<string>();
  function walkMarketsKambi(node: any, depth = 0): void {
    if (depth > 30 || node === null || node === undefined) return;
    if (Array.isArray(node)) {
      for (const item of node) walkMarketsKambi(item, depth + 1);
      return;
    }
    if (typeof node === "object") {
      const isMarket =
        node?.MarketType &&
        typeof node.MarketType === "object" &&
        Array.isArray(node?.Selections) &&
        node.Selections.length > 0;
      if (isMarket) {
        if (
          node.EventId === undefined ||
          node.EventId === null ||
          node.EventId === eventId
        ) {
          const mid =
            node?._id ??
            `${node.MarketType?._id}-${node.Name ?? ""}-${node.Selections.length}`;
          if (!seenMarketIds.has(mid)) {
            seenMarketIds.add(mid);
            markets.push(node);
          }
        }
        return;
      }
      for (const k of Object.keys(node)) walkMarketsKambi(node[k], depth + 1);
    }
  }
  for (const j of jsons) {
    walkMarketsKambi(j.body);
  }

  const cuotas: CuotasCapturadas = {};
  for (const m of markets) {
    if (m.IsSuspended || m.IsRemoved) continue;
    const tipoId = m.MarketType?._id;
    const sels = (m.Selections ?? []).filter(
      (s: any) => !s.IsDisabled && !s.IsRemoved,
    );
    const sP = (s: any) => priceOk(s?.TrueOdds ?? Number(s?.DisplayOdds?.Decimal));

    if (tipoId === "ML0" && !cuotas["1x2"]) {
      const l = sP(
        sels.find((s: any) => s.OutcomeType === "Local" || s.Side === 1),
      );
      const e = sP(
        sels.find((s: any) => s.OutcomeType === "Empate" || s.Side === 2),
      );
      const v = sP(
        sels.find((s: any) => s.OutcomeType === "Visita" || s.Side === 3),
      );
      if (l && e && v) cuotas["1x2"] = { local: l, empate: e, visita: v };
    } else if (
      (tipoId === "DC" ||
        tipoId === "ML9" ||
        (typeof m.MarketType?.Name === "string" &&
          m.MarketType.Name.toLowerCase().includes("doble")) ||
        (typeof m.Name === "string" &&
          m.Name.toLowerCase().includes("doble"))) &&
      !cuotas.doble_op
    ) {
      const findByText = (target: string): any =>
        sels.find((s: any) => {
          const txt = `${norm(s.BetslipLine)} ${norm(s.Name)}`;
          return txt.includes(target);
        });
      const x1 =
        sP(sels.find((s: any) => norm(s.BetslipLine) === "1x")) ??
        sP(sels.find((s: any) => norm(s.OutcomeType) === "1x")) ??
        sP(findByText("local o empate"));
      const x12 =
        sP(sels.find((s: any) => norm(s.BetslipLine) === "12")) ??
        sP(sels.find((s: any) => norm(s.OutcomeType) === "12")) ??
        sP(findByText("local o visita")) ??
        sP(findByText("local o "));
      const xx2 =
        sP(sels.find((s: any) => norm(s.BetslipLine) === "x2")) ??
        sP(sels.find((s: any) => norm(s.OutcomeType) === "x2")) ??
        sP(findByText("empate o "));
      if (x1 && x12 && xx2) cuotas.doble_op = { x1, x12, xx2 };
    } else if (tipoId === "OU0" && !cuotas.mas_menos_25) {
      const over = sP(
        sels.find((s: any) => {
          const line = String(s.QAParam1 ?? "");
          return (
            (s.OutcomeType === "Más" || norm(s.BetslipLine).startsWith("mas")) &&
            (line === "2.5" || norm(s.BetslipLine).includes("2.5"))
          );
        }),
      );
      const under = sP(
        sels.find((s: any) => {
          const line = String(s.QAParam1 ?? "");
          return (
            (s.OutcomeType === "Menos" || norm(s.BetslipLine).startsWith("menos")) &&
            (line === "2.5" || norm(s.BetslipLine).includes("2.5"))
          );
        }),
      );
      if (over && under) cuotas.mas_menos_25 = { over, under };
    } else if (tipoId === "QA158" && !cuotas.btts) {
      const si = sP(
        sels.find(
          (s: any) =>
            s.OutcomeType === "Sí" ||
            norm(s.BetslipLine) === "si" ||
            norm(s.BetslipLine) === "sí",
        ),
      );
      const no = sP(
        sels.find(
          (s: any) =>
            s.OutcomeType === "No" || norm(s.BetslipLine) === "no",
        ),
      );
      if (si && no) cuotas.btts = { si, no };
    }
  }

  // Fallback Doble Op via formato minificado posicional (eventpage)
  if (!cuotas.doble_op) {
    const dc = extraerDobleOpKambiMinificado(jsons);
    if (dc) cuotas.doble_op = dc;
  }
  // Fallback 1X2 via formato minificado posicional
  if (!cuotas["1x2"]) {
    const r1x2 = extraer1X2KambiMinificado(jsons, equipoLocal, equipoVisita);
    if (r1x2) cuotas["1x2"] = r1x2;
  }

  const home = mejorFix.Participants?.find((p: any) => p.VenueRole === "Home")
    ?.Name;
  const away = mejorFix.Participants?.find((p: any) => p.VenueRole === "Away")
    ?.Name;
  return {
    cuotas,
    eventoId: eventId,
    jsonUrl: snapshot.url,
    equipos: home && away ? { local: home, visita: away } : undefined,
  };
}

// ─── Helpers formato minificado posicional Kambi ────────────────────

function extraerDobleOpKambiMinificado(
  jsons: JsonCapturado[],
): { x1: number; x12: number; xx2: number } | null {
  for (const j of jsons) {
    const found = walkBuscarMarketMinificado(
      j.body,
      "Doble Oportunidad",
      "Double Chance",
    );
    if (!found) continue;
    for (const item of found) {
      if (!Array.isArray(item) || item.length === 0) continue;
      if (Array.isArray(item[0]) && item[0].length > 6) {
        const cuotas = parsearSelectionsDobleOpMinificadas(item);
        if (cuotas) return cuotas;
      }
    }
  }
  return null;
}

function walkBuscarMarketMinificado(
  node: any,
  nameMarket: string,
  lineTypeName: string,
  depth = 0,
): any[] | null {
  if (depth > 50 || node === null || node === undefined) return null;
  if (!Array.isArray(node)) {
    if (typeof node === "object") {
      for (const k of Object.keys(node)) {
        const r = walkBuscarMarketMinificado(
          (node as any)[k],
          nameMarket,
          lineTypeName,
          depth + 1,
        );
        if (r) return r;
      }
    }
    return null;
  }
  if (
    node.length >= 7 &&
    node[1] === nameMarket &&
    Array.isArray(node[5]) &&
    node[5].some((x: any) => x === lineTypeName)
  ) {
    return node;
  }
  for (const item of node) {
    const r = walkBuscarMarketMinificado(
      item,
      nameMarket,
      lineTypeName,
      depth + 1,
    );
    if (r) return r;
  }
  return null;
}

function parsearSelectionsDobleOpMinificadas(
  selectionsArr: any[],
): { x1: number; x12: number; xx2: number } | null {
  let x1: number | undefined;
  let x12: number | undefined;
  let xx2: number | undefined;
  for (const sel of selectionsArr) {
    if (!Array.isArray(sel) || sel.length < 7) continue;
    const labelObj = sel[1];
    let label = "";
    if (labelObj && typeof labelObj === "object") {
      label = String(
        labelObj["ES-PE"] ??
          labelObj["es-pe"] ??
          Object.values(labelObj)[0] ??
          "",
      );
    } else if (typeof labelObj === "string") {
      label = labelObj;
    }
    if (!label) continue;
    const labelLower = label.toLowerCase();
    let price: number | undefined;
    for (let i = 5; i < Math.min(sel.length, 12); i++) {
      const v = sel[i];
      if (typeof v === "number" && v > 1 && v < 100) {
        price = v;
        break;
      }
    }
    if (!price) continue;
    if (labelLower.includes(" o empate")) {
      x1 = price;
    } else if (labelLower.startsWith("empate o ")) {
      xx2 = price;
    } else if (labelLower.includes(" o ") && !labelLower.includes("empate")) {
      x12 = price;
    }
  }
  if (x1 && x12 && xx2) return { x1, x12, xx2 };
  return null;
}

function walkBuscarMarketMinificadoPorId(
  node: any,
  marketTypeId: string,
  depth = 0,
): any[] | null {
  if (depth > 50 || node === null || node === undefined) return null;
  if (!Array.isArray(node)) {
    if (typeof node === "object") {
      for (const k of Object.keys(node)) {
        const r = walkBuscarMarketMinificadoPorId(
          (node as any)[k],
          marketTypeId,
          depth + 1,
        );
        if (r) return r;
      }
    }
    return null;
  }
  if (
    node.length >= 7 &&
    Array.isArray(node[5]) &&
    node[5][0] === marketTypeId
  ) {
    return node;
  }
  for (const item of node) {
    const r = walkBuscarMarketMinificadoPorId(item, marketTypeId, depth + 1);
    if (r) return r;
  }
  return null;
}

function extraer1X2KambiMinificado(
  jsons: JsonCapturado[],
  equipoLocal: string,
  equipoVisita: string,
): { local: number; empate: number; visita: number } | null {
  for (const j of jsons) {
    const found = walkBuscarMarketMinificadoPorId(j.body, "ML0");
    if (!found) continue;
    for (const item of found) {
      if (!Array.isArray(item) || item.length === 0) continue;
      if (Array.isArray(item[0]) && item[0].length > 6) {
        const cuotas = parsear1X2SelectionsMinificadas(
          item,
          equipoLocal,
          equipoVisita,
        );
        if (cuotas) return cuotas;
      }
    }
  }
  return null;
}

function parsear1X2SelectionsMinificadas(
  selectionsArr: any[],
  equipoLocal: string,
  equipoVisita: string,
): { local: number; empate: number; visita: number } | null {
  let local: number | undefined;
  let empate: number | undefined;
  let visita: number | undefined;
  for (const sel of selectionsArr) {
    if (!Array.isArray(sel) || sel.length < 7) continue;
    const labelObj = sel[1];
    let label = "";
    if (labelObj && typeof labelObj === "object") {
      label = String(
        labelObj["ES-PE"] ??
          labelObj["es-pe"] ??
          Object.values(labelObj)[0] ??
          "",
      );
    } else if (typeof labelObj === "string") {
      label = labelObj;
    }
    if (!label) continue;
    const labelNorm = norm(label);
    let price: number | undefined;
    for (let i = 5; i < Math.min(sel.length, 12); i++) {
      const v = sel[i];
      if (typeof v === "number" && v > 1 && v < 100) {
        price = v;
        break;
      }
    }
    if (!price) continue;
    if (
      labelNorm === "empate" ||
      labelNorm === "draw" ||
      labelNorm === "x"
    ) {
      empate = price;
    } else if (similitudEquipos(label, equipoLocal) >= UMBRAL_FUZZY) {
      local = price;
    } else if (similitudEquipos(label, equipoVisita) >= UMBRAL_FUZZY) {
      visita = price;
    }
  }
  if (local && empate && visita) return { local, empate, visita };
  return null;
}

export default apuestaTotalScraper;
