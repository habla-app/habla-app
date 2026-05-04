// Orquestador del prototipo de scraper Playwright (Lote V — fase de
// validación de scrapers especializados por casa).
//
// Reusa el browser singleton ya configurado en `playwright-browser.ts` para
// no duplicar infra de Chromium-en-Alpine. Cada llamada al runner abre una
// page nueva, navega listado → busca partido → navega detalle → extrae
// cuotas → libera page.
//
// Cero contacto con Prisma o BullMQ — este prototipo NO escribe a BD.
// Devuelve TODO el detalle al caller (típicamente el endpoint admin
// `/api/v1/admin/prototipo-cuotas`) para que el operador pueda iterar
// rápido sobre selectores sin tocar el motor productivo.

import { logger } from "../../logger";
import {
  crearPagePlaywright,
  liberarPagePlaywright,
} from "../playwright-browser";
import {
  buscarPartidoEnListadoStake,
  extraerCuotasStake,
  type CandidatoElegido,
  type CandidatoListado,
  type DiagnosticoListado,
  type ResultadoExtraccion,
} from "./stake-extractor";

export type CasaPrototipo = "stake";

export interface InputPrototipo {
  casa: CasaPrototipo;
  equipoLocal: string;
  equipoVisita: string;
}

export interface ResultadoPrototipo {
  ok: boolean;
  casa: CasaPrototipo;
  input: { equipoLocal: string; equipoVisita: string };
  tiempos: {
    total: number;
    busquedaPartido?: number;
    navegacionDetalle?: number;
    extraccion?: number;
  };
  etapas: {
    listado?: {
      url: string;
      candidatosTotales: number;
      muestraCandidatos: CandidatoListado[];
      candidatoElegido: CandidatoElegido | null;
      motivoNoElegido?: string;
      diagnostico?: DiagnosticoListado;
    };
    detalle?: {
      url: string;
      eventId: string | null;
    };
    extraccion?: ResultadoExtraccion;
  };
  advertencias: string[];
  errores: string[];
  /** Screenshot del listado en base64 PNG (siempre se intenta capturar). */
  screenshotListadoBase64?: string | null;
  /** Screenshot del detalle del partido en base64 PNG (si llegamos al detalle). */
  screenshotDetalleBase64?: string | null;
}

export async function ejecutarPrototipoStake(
  input: InputPrototipo,
): Promise<ResultadoPrototipo> {
  const tInicio = Date.now();
  const advertencias: string[] = [];
  const errores: string[] = [];
  const tiempos: ResultadoPrototipo["tiempos"] = { total: 0 };
  const etapas: ResultadoPrototipo["etapas"] = {};
  let screenshotListadoBase64: string | null = null;
  let screenshotDetalleBase64: string | null = null;

  const page = await crearPagePlaywright();
  if (!page) {
    return {
      ok: false,
      casa: input.casa,
      input: {
        equipoLocal: input.equipoLocal,
        equipoVisita: input.equipoVisita,
      },
      tiempos: { total: Date.now() - tInicio },
      etapas: {},
      advertencias,
      errores: ["playwright no disponible (browser no se pudo lanzar)"],
    };
  }

  try {
    // ── Paso 1: buscar partido en listado ──
    const t1 = Date.now();
    const busqueda = await buscarPartidoEnListadoStake(
      page,
      input.equipoLocal,
      input.equipoVisita,
    );
    tiempos.busquedaPartido = Date.now() - t1;

    etapas.listado = {
      url: busqueda.urlListado,
      candidatosTotales: busqueda.candidatosTotales,
      muestraCandidatos: busqueda.todosLosCandidatos.slice(0, 10),
      candidatoElegido: busqueda.candidatoElegido,
      motivoNoElegido: busqueda.motivoNoElegido,
      diagnostico: busqueda.diagnostico,
    };

    // Screenshot del listado SIEMPRE — independiente del éxito del match.
    // Permite ver qué cargó realmente Stake en el browser (página real,
    // splash, captcha, geo-block, etc).
    try {
      const buf = await page.screenshot({ fullPage: false, type: "png" });
      screenshotListadoBase64 = buf.toString("base64");
    } catch (err) {
      advertencias.push(
        `screenshot del listado falló: ${(err as Error).message}`,
      );
    }

    if (!busqueda.candidatoElegido) {
      errores.push(
        `partido "${input.equipoLocal} vs ${input.equipoVisita}" no encontrado en listado de Stake (${busqueda.candidatosTotales} partidos vistos)${busqueda.motivoNoElegido ? ` — ${busqueda.motivoNoElegido}` : ""}`,
      );
      tiempos.total = Date.now() - tInicio;
      return {
        ok: false,
        casa: input.casa,
        input,
        tiempos,
        etapas,
        advertencias,
        errores,
        screenshotListadoBase64,
      };
    }

    // ── Paso 2: navegar al detalle ──
    const hrefDetalle = busqueda.candidatoElegido.hrefDetalle;
    if (!hrefDetalle) {
      errores.push("partido encontrado pero sin href hacia el detalle");
      tiempos.total = Date.now() - tInicio;
      return {
        ok: false,
        casa: input.casa,
        input,
        tiempos,
        etapas,
        advertencias,
        errores,
        screenshotListadoBase64,
      };
    }

    const t2 = Date.now();
    try {
      await page.goto(hrefDetalle, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
    } catch (err) {
      errores.push(
        `navegación al detalle falló (${hrefDetalle}): ${(err as Error).message}`,
      );
      tiempos.navegacionDetalle = Date.now() - t2;
      tiempos.total = Date.now() - tInicio;
      return {
        ok: false,
        casa: input.casa,
        input,
        tiempos,
        etapas,
        advertencias,
        errores,
        screenshotListadoBase64,
      };
    }
    tiempos.navegacionDetalle = Date.now() - t2;

    etapas.detalle = {
      url: page.url(),
      eventId: busqueda.candidatoElegido.eventId,
    };

    // ── Paso 3: extraer cuotas de los 4 mercados ──
    const t3 = Date.now();
    const extraccion = await extraerCuotasStake(page);
    tiempos.extraccion = Date.now() - t3;
    etapas.extraccion = extraccion;

    const m = extraccion.mercados;
    const ningunoExtraido =
      !m.m1x2 && !m.mDoble && !m.mMasMenos25 && !m.mBtts;
    if (ningunoExtraido) {
      errores.push(
        `ningún mercado se extrajo (total wol-odd vistos en DOM: ${extraccion.totalOddsEnDom})`,
      );
    } else {
      const faltantes: string[] = [];
      if (!m.m1x2) faltantes.push("1X2");
      if (!m.mDoble) faltantes.push("Doble Op");
      if (!m.mMasMenos25) faltantes.push("Más/Menos 2.5");
      if (!m.mBtts) faltantes.push("BTTS");
      if (faltantes.length > 0) {
        advertencias.push(
          `mercados no extraídos: ${faltantes.join(", ")}`,
        );
      }
    }

    // ── Paso 4: screenshot del detalle (visible viewport) ──
    try {
      const buf = await page.screenshot({ fullPage: false, type: "png" });
      screenshotDetalleBase64 = buf.toString("base64");
    } catch (err) {
      advertencias.push(
        `screenshot del detalle falló: ${(err as Error).message}`,
      );
    }

    tiempos.total = Date.now() - tInicio;

    return {
      ok: errores.length === 0,
      casa: input.casa,
      input: {
        equipoLocal: input.equipoLocal,
        equipoVisita: input.equipoVisita,
      },
      tiempos,
      etapas,
      advertencias,
      errores,
      screenshotListadoBase64,
      screenshotDetalleBase64,
    };
  } catch (err) {
    errores.push(`error inesperado: ${(err as Error).message}`);
    tiempos.total = Date.now() - tInicio;
    return {
      ok: false,
      casa: input.casa,
      input: {
        equipoLocal: input.equipoLocal,
        equipoVisita: input.equipoVisita,
      },
      tiempos,
      etapas,
      advertencias,
      errores,
      screenshotListadoBase64,
      screenshotDetalleBase64,
    };
  } finally {
    void liberarPagePlaywright(page);
    logger.info(
      {
        casa: input.casa,
        equipoLocal: input.equipoLocal,
        equipoVisita: input.equipoVisita,
        ms: tiempos.total,
        ok: errores.length === 0,
        mercadosOk: [
          etapas.extraccion?.mercados.m1x2 ? "1X2" : null,
          etapas.extraccion?.mercados.mDoble ? "DobleOp" : null,
          etapas.extraccion?.mercados.mMasMenos25 ? "MasMenos2.5" : null,
          etapas.extraccion?.mercados.mBtts ? "BTTS" : null,
        ].filter(Boolean),
        source: "prototipo-cuotas",
      },
      `prototipo cuotas ${input.casa} terminado (${tiempos.total}ms · ${errores.length === 0 ? "OK" : "ERROR"})`,
    );
  }
}
