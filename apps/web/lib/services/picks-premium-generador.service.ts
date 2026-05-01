// Generador de picks Premium con Claude API — Lote E (May 2026).
//
// Pipeline:
//   1. Cron O (instrumentation.ts) llama `generarPicksPremiumDelDia()` cada 4h.
//   2. Selecciona los próximos N partidos top sin pick aprobado.
//   3. Para cada uno: lee odds-cache + stats opcionales + llama Claude con
//      el prompt de `picks-premium-prompts.ts`.
//   4. Parsea response → crea filas PickPremium en estado PENDIENTE para
//      que el editor las apruebe desde /admin/picks-premium (Lote F).
//
// Reglas duras:
//   - Cero auto-publicación: PENDIENTE siempre, nunca aprobado=true.
//   - Rate limit Claude API: máx 3 partidos por corrida (configurable).
//   - Idempotencia: si ya hay un pick APROBADO para el partido + mercado,
//     no genera duplicado.
//   - Logs detallados con tokens consumidos para monitoreo de costo.

import Anthropic from "@anthropic-ai/sdk";
import {
  prisma,
  type Afiliado,
  type Partido,
  type PickPremium,
} from "@habla/db";

import { logger } from "./logger";
import { track } from "./analytics.service";
import { obtenerOddsCacheadas } from "./odds-cache.service";
import { obtenerActivosOrdenados } from "./afiliacion.service";
import { LIGAS } from "@/lib/config/ligas";
import {
  buildUserPromptPicks,
  parsearRespuestaPicks,
  SYSTEM_PROMPT_PICKS,
  type PickGenerado,
} from "./picks-premium-prompts";

const DEFAULT_MODEL = "claude-opus-4-7";
const MAX_TOKENS = 4096;
const MAX_PARTIDOS_POR_CORRIDA = 3;
const VENTANA_HORAS_LOOKAHEAD = 36;

interface AnthropicConfig {
  apiKey: string;
  model: string;
}

function readAnthropicConfig(): AnthropicConfig | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    model: process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL,
  };
}

// ---------------------------------------------------------------------------
// Generación para un partido individual
// ---------------------------------------------------------------------------

export async function generarPicksParaPartido(
  partidoId: string,
): Promise<PickPremium[]> {
  const cfg = readAnthropicConfig();
  if (!cfg) {
    logger.warn(
      { partidoId, source: "picks-premium:gen" },
      "generarPicksParaPartido: ANTHROPIC_API_KEY no configurada, skip",
    );
    return [];
  }

  const partido = await prisma.partido.findUnique({
    where: { id: partidoId },
  });
  if (!partido) {
    logger.warn(
      { partidoId, source: "picks-premium:gen" },
      "generarPicksParaPartido: partido no existe",
    );
    return [];
  }

  // Idempotencia básica: si ya hay un pick APROBADO para este partido,
  // no llamamos a Claude (asumimos que el editor ya cubrió este partido).
  const yaAprobado = await prisma.pickPremium.count({
    where: { partidoId, aprobado: true },
  });
  if (yaAprobado > 0) {
    logger.info(
      { partidoId, source: "picks-premium:gen" },
      "generarPicksParaPartido: ya tiene pick aprobado, skip",
    );
    return [];
  }

  // Cuotas del odds-cache (Lote 9). Si no hay cuotas, no podemos generar.
  const odds = await obtenerOddsCacheadas(partidoId);
  if (!odds) {
    logger.info(
      { partidoId, source: "picks-premium:gen" },
      "generarPicksParaPartido: sin odds cacheadas, skip",
    );
    return [];
  }

  // Afiliados activos para que Claude pueda mapear casaSlug.
  const afiliadosActivos = await obtenerActivosOrdenados();
  const slugsActivos = afiliadosActivos.map((a) => a.slug);

  // Build user prompt.
  const userPrompt = buildUserPromptPicks({
    liga: partido.liga,
    local: partido.equipoLocal,
    visita: partido.equipoVisita,
    fechaInicioISO: partido.fechaInicio.toISOString(),
    cuotas: {
      "1X2": {
        home: oddOrEmpty(odds.mercados["1X2"].local),
        draw: oddOrEmpty(odds.mercados["1X2"].empate),
        away: oddOrEmpty(odds.mercados["1X2"].visita),
      },
      BTTS: {
        si: oddOrEmpty(odds.mercados.BTTS.si),
        no: oddOrEmpty(odds.mercados.BTTS.no),
      },
      OVER_UNDER_25: {
        over: oddOrEmpty(odds.mercados["+2.5"].over),
        under: oddOrEmpty(odds.mercados["+2.5"].under),
      },
    },
    afiliadosDisponibles: slugsActivos,
  });

  // Llamar Claude.
  let raw = "";
  let tokensIn = 0;
  let tokensOut = 0;
  try {
    const anthropic = new Anthropic({ apiKey: cfg.apiKey });
    const response = await anthropic.messages.create({
      model: cfg.model,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT_PICKS,
      messages: [{ role: "user", content: userPrompt }],
    });
    raw = response.content
      .filter((c) => c.type === "text")
      .map((c) => ("text" in c ? c.text : ""))
      .join("\n");
    tokensIn = response.usage?.input_tokens ?? 0;
    tokensOut = response.usage?.output_tokens ?? 0;
  } catch (err) {
    logger.error(
      { err, partidoId, source: "picks-premium:gen" },
      "generarPicksParaPartido: Claude API falló",
    );
    return [];
  }

  logger.info(
    {
      partidoId,
      tokensIn,
      tokensOut,
      total: tokensIn + tokensOut,
      modelo: cfg.model,
      source: "picks-premium:gen",
    },
    "generarPicksParaPartido: Claude respondió",
  );

  const parsed = parsearRespuestaPicks(raw);
  if (parsed.picks.length === 0) {
    logger.info(
      {
        partidoId,
        razonGeneral: parsed.razonGeneral,
        source: "picks-premium:gen",
      },
      "generarPicksParaPartido: sin picks (razón: " +
        (parsed.razonGeneral ?? "n/a") +
        ")",
    );
    return [];
  }

  // Persistir cada pick. Filtramos por mercado: si ya existe un pick
  // PENDIENTE/APROBADO para ese partido + mercado + outcome, skip.
  const created: PickPremium[] = [];
  for (const p of parsed.picks) {
    const existe = await prisma.pickPremium.findFirst({
      where: {
        partidoId,
        mercado: p.mercado,
        outcome: p.outcome,
        estado: { in: ["PENDIENTE", "APROBADO", "EDITADO_Y_APROBADO"] },
      },
    });
    if (existe) continue;

    const casaId = await resolveCasaId(afiliadosActivos, p.casaSlug);
    const pick = await prisma.pickPremium.create({
      data: {
        partidoId,
        mercado: p.mercado,
        outcome: p.outcome,
        cuotaSugerida: p.cuotaSugerida,
        stakeSugerido: clampStake(p.stakeSugerido),
        evPctSugerido: clampEv(p.evPct),
        casaRecomendadaId: casaId,
        razonamiento: p.razonamiento.slice(0, 4000),
        estadisticas: p.statsResumen ?? undefined,
        generadoPor: "CLAUDE_API",
        estado: "PENDIENTE",
        aprobado: false,
      },
    });
    created.push(pick);
  }

  void track({
    evento: "pick_premium_generado",
    props: {
      partidoId,
      tokensTotales: tokensIn + tokensOut,
      modelo: cfg.model,
      picksCreados: created.length,
    },
  });

  logger.info(
    {
      partidoId,
      picksCreados: created.length,
      tokensTotales: tokensIn + tokensOut,
      source: "picks-premium:gen",
    },
    "generarPicksParaPartido: ok",
  );

  return created;
}

// ---------------------------------------------------------------------------
// Cron — generar para los próximos top partidos
// ---------------------------------------------------------------------------

export interface CronGenerarReporte {
  partidosCandidatos: number;
  partidosProcesados: number;
  picksCreados: number;
  errores: number;
}

export async function generarPicksPremiumDelDia(): Promise<CronGenerarReporte> {
  const reporte: CronGenerarReporte = {
    partidosCandidatos: 0,
    partidosProcesados: 0,
    picksCreados: 0,
    errores: 0,
  };

  const ahora = new Date();
  const ventanaFin = new Date(ahora.getTime() + VENTANA_HORAS_LOOKAHEAD * 3600 * 1000);

  // Ligas top: priorizamos por prioridadDisplay ascendente.
  const ligasTop = LIGAS.filter((l) => l.activa)
    .slice() // copia inmutable
    .sort((a, b) => a.prioridadDisplay - b.prioridadDisplay)
    .map((l) => l.nombre);

  const candidatos = await prisma.partido.findMany({
    where: {
      fechaInicio: { gte: ahora, lte: ventanaFin },
      liga: { in: ligasTop },
      estado: "PROGRAMADO",
      picksPremium: { none: { aprobado: true } },
    },
    orderBy: { fechaInicio: "asc" },
    take: MAX_PARTIDOS_POR_CORRIDA * 4, // sobre-fetch para filtrar luego.
  });

  reporte.partidosCandidatos = candidatos.length;

  // Procesar como mucho MAX_PARTIDOS_POR_CORRIDA. El resto se cubre en la
  // próxima corrida.
  for (const partido of candidatos.slice(0, MAX_PARTIDOS_POR_CORRIDA)) {
    try {
      const created = await generarPicksParaPartido(partido.id);
      reporte.picksCreados += created.length;
      reporte.partidosProcesados++;
    } catch (err) {
      logger.error(
        { err, partidoId: partido.id, source: "picks-premium:cron" },
        "generarPicksPremiumDelDia: error en partido",
      );
      reporte.errores++;
    }
  }

  return reporte;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface CachedOdd {
  casa: string;
  casaNombre: string;
  odd: number;
}

function oddOrEmpty(o: CachedOdd | null): { casa: string | null; odd: number | null } {
  if (!o) return { casa: null, odd: null };
  return { casa: o.casa, odd: o.odd };
}

async function resolveCasaId(
  afiliadosActivos: Awaited<ReturnType<typeof obtenerActivosOrdenados>>,
  slug: string | null,
): Promise<string | null> {
  if (!slug) return null;
  const found = afiliadosActivos.find((a) => a.slug === slug);
  return found?.id ?? null;
}

function clampStake(v: unknown): number {
  const n = typeof v === "number" ? v : 0.01;
  return Math.max(0.01, Math.min(0.05, n));
}

function clampEv(v: unknown): number {
  const n = typeof v === "number" ? v : 0;
  return Math.max(0, Math.min(0.5, n));
}
