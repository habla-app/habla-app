// Prototipo de extractor específico para Stake.
//
// Aprovecha que Stake expone TODO el dato relevante en atributos `data-*`
// estables del DOM. No hay parsing de texto frágil — leemos
// `data-odd-value="1.75"` directo del atributo.
//
// IDs de selección descubiertos via DevTools del listado real (admin
// validó con HTML pegado en chat el 2026-05-04):
//   - Mercado 1X2:        oddId 3=Local, 4=Empate, 5=Visita
//   - Mercado Doble Op:   oddId 6=1X, 7=12, 8=X2
//   - Mercado BTTS:       oddId 216=Sí, 217=No
//   - Mercado Más/Menos:  filtrado por data-additional-value="2.5"
//                         + data-odd-ttl="_OVR" o "_UND"
//
// Si Stake cambia esos IDs, los logs del prototipo lo van a evidenciar
// (los IDs vienen en `muestraOdds`) y se ajusta acá puntual.

import type { PlaywrightPage } from "../playwright-browser";
import { similitudEquipos } from "../fuzzy-match";

const URL_LISTADO_LIGA1 = "https://stake.pe/deportes/football/peru/primera-division";
const STAKE_BASE = "https://stake.pe";

/** Umbral mínimo del score Jaro-Winkler para aceptar un match en el listado. */
const UMBRAL_MATCH_PARTIDO = 0.85;

export interface CandidatoListado {
  equipoLocal: string;
  equipoVisita: string;
  hrefDetalle: string | null;
  fechaTexto: string;
  eventId: string | null;
}

export interface CandidatoElegido extends CandidatoListado {
  scoreLocal: number;
  scoreVisita: number;
  scoreMin: number;
}

export interface ResultadoBusqueda {
  urlListado: string;
  candidatosTotales: number;
  todosLosCandidatos: CandidatoListado[];
  candidatoElegido: CandidatoElegido | null;
  motivoNoElegido?: string;
}

export interface MercadosExtraidos {
  m1x2: { local: number; empate: number; visita: number } | null;
  mDoble: { x1: number; x12: number; xx2: number } | null;
  mMasMenos25: { over: number; under: number } | null;
  mBtts: { si: number; no: number } | null;
}

export interface OddDebug {
  oddValue: number | null;
  oddId: string | null;
  teamSide: string | null;
  additionalValue: string | null;
  ttl: string | null;
  info: string;
}

export interface ResultadoExtraccion {
  mercados: MercadosExtraidos;
  totalOddsEnDom: number;
  muestraOdds: OddDebug[];
}

/**
 * Navega al listado de Liga 1 en Stake, recorre todas las tarjetas de
 * partido (.wpt-table__row) y devuelve el mejor match contra los nombres
 * provistos según similitud Jaro-Winkler.
 */
export async function buscarPartidoEnListadoStake(
  page: PlaywrightPage,
  equipoLocal: string,
  equipoVisita: string,
): Promise<ResultadoBusqueda> {
  await page.goto(URL_LISTADO_LIGA1, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });

  // Esperar a que aparezca al menos una fila de partido.
  try {
    await page.waitForSelector(".wpt-table__row", { timeout: 15_000 });
  } catch {
    // Sin filas — devolvemos vacío.
  }

  // Pequeña espera adicional para que termine de hidratar (cuotas + links).
  await page.waitForTimeout(1500);

  const candidatosCrudos: CandidatoListado[] = await page.evaluate(() => {
    const rows = document.querySelectorAll(".wpt-table__row");
    const out: CandidatoListado[] = [];
    for (const row of Array.from(rows)) {
      if (!(row instanceof HTMLElement)) continue;
      const teamLinks = row.querySelectorAll(".wpt-teams__team a");
      if (teamLinks.length < 2) continue;
      const equipoLocal = teamLinks[0]!.textContent?.trim() ?? "";
      const equipoVisita = teamLinks[1]!.textContent?.trim() ?? "";
      const hrefRaw =
        (teamLinks[0] as HTMLAnchorElement).getAttribute("href") ?? null;
      const fechaSpans = row.querySelectorAll(".wpt-time span");
      const fechaTexto = Array.from(fechaSpans)
        .map((s) => s.textContent?.trim() ?? "")
        .filter((s) => s.length > 0)
        .join(" ");
      // event-id viene en cualquiera de las celdas .wpt-odd con data-event-id
      const oddCells = row.querySelectorAll("[data-event-id]");
      const eventId =
        oddCells.length > 0
          ? (oddCells[0] as HTMLElement).dataset.eventId ?? null
          : null;
      out.push({
        equipoLocal,
        equipoVisita,
        hrefDetalle: hrefRaw,
        fechaTexto,
        eventId,
      });
    }
    return out;
  });

  // Resolver href absoluto.
  const todosLosCandidatos: CandidatoListado[] = candidatosCrudos.map((c) => ({
    ...c,
    hrefDetalle:
      c.hrefDetalle && c.hrefDetalle.startsWith("/")
        ? `${STAKE_BASE}${c.hrefDetalle}`
        : c.hrefDetalle,
  }));

  // Buscar mejor match server-side con Jaro-Winkler.
  let mejor: CandidatoElegido | null = null;
  let mejorScore = 0;
  for (const c of todosLosCandidatos) {
    const sLocal = similitudEquipos(c.equipoLocal, equipoLocal);
    const sVisita = similitudEquipos(c.equipoVisita, equipoVisita);
    const score = Math.min(sLocal, sVisita);
    if (score > mejorScore) {
      mejorScore = score;
      mejor = {
        ...c,
        scoreLocal: sLocal,
        scoreVisita: sVisita,
        scoreMin: score,
      };
    }
  }

  if (mejorScore < UMBRAL_MATCH_PARTIDO) {
    return {
      urlListado: URL_LISTADO_LIGA1,
      candidatosTotales: todosLosCandidatos.length,
      todosLosCandidatos,
      candidatoElegido: null,
      motivoNoElegido:
        todosLosCandidatos.length === 0
          ? "no se encontraron tarjetas de partido en el listado"
          : `mejor score (${mejorScore.toFixed(3)}) por debajo del umbral ${UMBRAL_MATCH_PARTIDO}`,
    };
  }

  return {
    urlListado: URL_LISTADO_LIGA1,
    candidatosTotales: todosLosCandidatos.length,
    todosLosCandidatos,
    candidatoElegido: mejor,
  };
}

/**
 * Lee las cuotas de los 4 mercados desde la página de detalle del partido.
 * Asume que `page` ya está en la URL del detalle. Espera a que aparezcan
 * elementos `.wol-odd` antes de extraer.
 */
export async function extraerCuotasStake(
  page: PlaywrightPage,
): Promise<ResultadoExtraccion> {
  // Esperar a que carguen al menos algunas selecciones.
  try {
    await page.waitForSelector(".wol-odd", { timeout: 15_000 });
  } catch {
    // Sin .wol-odd — devolvemos vacío con totalOddsEnDom=0.
  }

  // Hidratación adicional para que aparezcan TODAS las wol-odd
  // (Stake renderiza progresivamente algunos mercados).
  await page.waitForTimeout(2000);

  return page.evaluate(() => {
    function norm(s: string): string {
      return s
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .trim();
    }
    function parseOdd(value: string | null | undefined): number | null {
      if (!value) return null;
      const v = parseFloat(value);
      if (!Number.isFinite(v) || v <= 1 || v > 100) return null;
      return v;
    }

    interface OddData {
      oddValue: number | null;
      oddId: string | null;
      teamSide: string | null;
      additionalValue: string | null;
      ttl: string | null;
      info: string;
      infoNorm: string;
    }

    const allOdds: OddData[] = [];
    const els = document.querySelectorAll(".wol-odd");
    for (const el of Array.from(els)) {
      if (!(el instanceof HTMLElement)) continue;
      // Ignorar locked (mercados suspendidos).
      if (el.classList.contains("locked")) continue;
      const infoEl = el.querySelector(".wol-odd__info");
      const infoText = infoEl?.textContent?.trim() ?? "";
      allOdds.push({
        oddValue: parseOdd(el.dataset.oddValue ?? null),
        oddId: el.dataset.oddId ?? null,
        teamSide: el.dataset.oddTeamSide ?? null,
        additionalValue: el.dataset.additionalValue ?? null,
        ttl: el.dataset.oddTtl ?? null,
        info: infoText,
        infoNorm: norm(infoText),
      });
    }

    // ─── 1X2: oddId 3/4/5 + teamSide 1/0/2 ───
    const local1x2 = allOdds.find((o) => o.oddId === "3" && o.teamSide === "1");
    const empate1x2 = allOdds.find((o) => o.oddId === "4" && o.teamSide === "0");
    const visita1x2 = allOdds.find((o) => o.oddId === "5" && o.teamSide === "2");
    const m1x2 =
      local1x2?.oddValue && empate1x2?.oddValue && visita1x2?.oddValue
        ? {
            local: local1x2.oddValue,
            empate: empate1x2.oddValue,
            visita: visita1x2.oddValue,
          }
        : null;

    // ─── Doble Oportunidad: oddId 6/7/8 ───
    const x1 = allOdds.find((o) => o.oddId === "6");
    const x12 = allOdds.find((o) => o.oddId === "7");
    const xx2 = allOdds.find((o) => o.oddId === "8");
    const mDoble =
      x1?.oddValue && x12?.oddValue && xx2?.oddValue
        ? { x1: x1.oddValue, x12: x12.oddValue, xx2: xx2.oddValue }
        : null;

    // ─── Más/Menos 2.5: data-additional-value + data-odd-ttl ───
    const over25 = allOdds.find(
      (o) => o.additionalValue === "2.5" && o.ttl === "_OVR",
    );
    const under25 = allOdds.find(
      (o) => o.additionalValue === "2.5" && o.ttl === "_UND",
    );
    const mMasMenos25 =
      over25?.oddValue && under25?.oddValue
        ? { over: over25.oddValue, under: under25.oddValue }
        : null;

    // ─── BTTS: oddId 216/217 con fallback por texto ───
    let bttsSi = allOdds.find((o) => o.oddId === "216");
    let bttsNo = allOdds.find((o) => o.oddId === "217");
    if (!bttsSi || !bttsNo) {
      // Fallback: textos "Ambos equipos marcan - SÍ" / "NO"
      bttsSi =
        bttsSi ??
        allOdds.find(
          (o) =>
            o.infoNorm.includes("ambos") &&
            (o.infoNorm.endsWith(" si") ||
              o.infoNorm.includes("- si") ||
              o.infoNorm.endsWith(" yes")),
        );
      bttsNo =
        bttsNo ??
        allOdds.find(
          (o) =>
            o.infoNorm.includes("ambos") &&
            (o.infoNorm.endsWith(" no") || o.infoNorm.includes("- no")),
        );
    }
    const mBtts =
      bttsSi?.oddValue && bttsNo?.oddValue
        ? { si: bttsSi.oddValue, no: bttsNo.oddValue }
        : null;

    return {
      mercados: { m1x2, mDoble, mMasMenos25, mBtts },
      totalOddsEnDom: allOdds.length,
      muestraOdds: allOdds.slice(0, 30).map((o) => ({
        oddValue: o.oddValue,
        oddId: o.oddId,
        teamSide: o.teamSide,
        additionalValue: o.additionalValue,
        ttl: o.ttl,
        info: o.info,
      })),
    };
  });
}
