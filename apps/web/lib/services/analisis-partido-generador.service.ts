// Generador del objeto rico de AnalisisPartido — Lote L v3.2 (May 2026).
// Spec: docs/plan-trabajo-claude-code-v3.2.md § Lote L + decisión §1.2 +
// §4.3 del análisis-repo-vs-mockup-v3.2.md.
//
// Pipeline:
//   1. Trigger inmediato: cuando el admin activa Filtro 1 (mostrarAlPublico
//      = true) sobre un partido nuevo, el endpoint PATCH dispara una llamada
//      directa a `generarAnalisisParaPartido(partidoId)`.
//   2. Trigger periódico: el cron in-process llama
//      `generarAnalisisDelDia()` cada 4h como red de seguridad para partidos
//      con Filtro 1 activo que por algún bug no tengan análisis aún.
//   3. Para cada partido: lee odds-cache + stats opcionales + llama Claude
//      con el prompt rico de `analisis-partido-prompts.ts`.
//   4. Parsea response → upsert AnalisisPartido en estado PENDIENTE para que
//      el editor lo apruebe desde /admin/picks (Lote O).
//
// Reglas duras:
//   - Cero auto-publicación: estado=PENDIENTE siempre, nunca APROBADO.
//   - promptVersion + inputsJSON OBLIGATORIOS (regla 27 del CLAUDE.md).
//   - Idempotencia: si ya existe AnalisisPartido APROBADO, no regenera
//     (excepto si lo invocó el admin via regenerarAnalisis()).
//   - Telemetría: persistimos latenciaMs + tokensInput + tokensOutput.
//   - Rate limit Claude API: máx 3 partidos por corrida del cron.
//   - Auditoría 100% en regeneraciones manuales (regla 21).

import Anthropic from "@anthropic-ai/sdk";
import { Prisma, prisma, type Partido } from "@habla/db";

import { logger } from "./logger";
import { track } from "./analytics.service";
import { obtenerOddsCacheadas } from "./odds-cache.service";
import { obtenerActivosOrdenados } from "./afiliacion.service";
import { LIGAS } from "@/lib/config/ligas";
import {
  AnalisisRichResponseSchema,
  buildUserPromptAnalisis,
  parsearRespuestaAnalisis,
  PROMPT_VERSION,
  SYSTEM_PROMPT_ANALISIS,
  type AnalisisRichResponse,
  type PromptUserInput,
} from "./analisis-partido-prompts";

const DEFAULT_MODEL = "claude-opus-4-7";
const MAX_TOKENS = 8000;
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
// Tipos de retorno
// ---------------------------------------------------------------------------

export type GeneradorMotivo =
  | "ok"
  | "ya-aprobado"
  | "sin-anthropic"
  | "partido-no-existe"
  | "sin-odds"
  | "claude-falló"
  | "respuesta-no-parseable"
  | "persistencia-falló";

export interface GenerarResultado {
  ok: boolean;
  motivo: GeneradorMotivo;
  analisisId?: string;
  latenciaMs?: number;
  tokensInput?: number;
  tokensOutput?: number;
  parseDetail?: string;
}

export interface CronGenerarReporte {
  partidosCandidatos: number;
  partidosProcesados: number;
  analisisCreados: number;
  errores: number;
}

// ---------------------------------------------------------------------------
// Generación para un partido individual
// ---------------------------------------------------------------------------

interface GenerarOpts {
  /** Si true, ignora la idempotencia "ya-aprobado" y regenera igual.
   *  Lo usa el admin desde POST /admin/partidos/[id]/regenerar-analisis. */
  forceRegenerar?: boolean;
}

export async function generarAnalisisParaPartido(
  partidoId: string,
  opts: GenerarOpts = {},
): Promise<GenerarResultado> {
  const cfg = readAnthropicConfig();
  if (!cfg) {
    logger.warn(
      { partidoId, source: "analisis-partido:gen" },
      "generarAnalisisParaPartido: ANTHROPIC_API_KEY no configurada, skip",
    );
    return { ok: false, motivo: "sin-anthropic" };
  }

  const partido = await prisma.partido.findUnique({
    where: { id: partidoId },
    include: { analisisPartido: true },
  });
  if (!partido) {
    logger.warn(
      { partidoId, source: "analisis-partido:gen" },
      "generarAnalisisParaPartido: partido no existe",
    );
    return { ok: false, motivo: "partido-no-existe" };
  }

  // Idempotencia: si ya hay análisis APROBADO, no llamamos a Claude (a menos
  // que sea regeneración explícita del admin).
  if (
    !opts.forceRegenerar &&
    partido.analisisPartido?.estado === "APROBADO"
  ) {
    logger.info(
      { partidoId, source: "analisis-partido:gen" },
      "generarAnalisisParaPartido: ya hay análisis APROBADO, skip",
    );
    return {
      ok: true,
      motivo: "ya-aprobado",
      analisisId: partido.analisisPartido.id,
    };
  }

  // Si está ARCHIVADO y no hay forceRegenerar, restauramos a PENDIENTE
  // moviéndolo al estado actual (decisión §4.1: "si ya hay análisis
  // archivado, restaura ese"). El editor decide si regenerar de cero.
  if (
    !opts.forceRegenerar &&
    partido.analisisPartido?.estado === "ARCHIVADO"
  ) {
    const restaurado = await prisma.analisisPartido.update({
      where: { id: partido.analisisPartido.id },
      data: { estado: "PENDIENTE", archivadoEn: null },
    });
    logger.info(
      { partidoId, analisisId: restaurado.id, source: "analisis-partido:gen" },
      "generarAnalisisParaPartido: restaurado análisis archivado",
    );
    return { ok: true, motivo: "ok", analisisId: restaurado.id };
  }

  // Cuotas del odds-cache. Si no hay cuotas, no podemos generar el objeto
  // rico (las probabilidades se anclan a las cuotas implícitas).
  const odds = await obtenerOddsCacheadas(partidoId);
  if (!odds) {
    logger.info(
      { partidoId, source: "analisis-partido:gen" },
      "generarAnalisisParaPartido: sin odds cacheadas, skip",
    );
    return { ok: false, motivo: "sin-odds" };
  }

  // Afiliados activos para que Claude no invente casas.
  const afiliadosActivos = await obtenerActivosOrdenados();
  const slugsActivos = afiliadosActivos.map((a) => a.slug);

  // Build inputs y user prompt.
  const inputs: PromptUserInput = {
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
  };
  const userPrompt = buildUserPromptAnalisis(inputs);

  // Snapshot de inputs que se persiste en inputsJSON. Permite reproducir y
  // debuggear cualquier análisis individual (regla 27 del CLAUDE.md).
  const inputsSnapshot = {
    promptVersion: PROMPT_VERSION,
    modelo: cfg.model,
    partido: {
      id: partido.id,
      liga: partido.liga,
      local: partido.equipoLocal,
      visita: partido.equipoVisita,
      fechaInicioISO: partido.fechaInicio.toISOString(),
      externalId: partido.externalId,
    },
    cuotas: inputs.cuotas,
    afiliadosDisponibles: slugsActivos,
    statsContext: inputs.statsContext ?? null,
    capturadoEn: new Date().toISOString(),
  };

  // Llamar Claude.
  const tStart = Date.now();
  let raw = "";
  let tokensIn = 0;
  let tokensOut = 0;
  try {
    const anthropic = new Anthropic({ apiKey: cfg.apiKey });
    const response = await anthropic.messages.create({
      model: cfg.model,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT_ANALISIS,
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
      { err, partidoId, source: "analisis-partido:gen" },
      "generarAnalisisParaPartido: Claude API falló",
    );
    return { ok: false, motivo: "claude-falló" };
  }
  const latenciaMs = Date.now() - tStart;

  logger.info(
    {
      partidoId,
      tokensIn,
      tokensOut,
      total: tokensIn + tokensOut,
      latenciaMs,
      modelo: cfg.model,
      promptVersion: PROMPT_VERSION,
      source: "analisis-partido:gen",
    },
    "generarAnalisisParaPartido: Claude respondió",
  );

  const parseRes = parsearRespuestaAnalisis(raw);
  if (!parseRes.ok || !parseRes.data) {
    logger.warn(
      {
        partidoId,
        motivo: parseRes.motivo,
        source: "analisis-partido:gen",
      },
      "generarAnalisisParaPartido: respuesta no válida",
    );
    return {
      ok: false,
      motivo: "respuesta-no-parseable",
      latenciaMs,
      tokensInput: tokensIn,
      tokensOutput: tokensOut,
      parseDetail: parseRes.motivo,
    };
  }

  const data = parseRes.data;

  // Persistir / upsertear. Si existía PENDIENTE/RECHAZADO/ARCHIVADO previo,
  // sobreescribimos con la versión nueva. Si APROBADO existía y forzamos
  // regenerar, también sobreescribimos PERO degradamos a PENDIENTE para que
  // el editor revise el contenido nuevo (regla 18: cero auto-publicación).
  let persistido;
  try {
    persistido = await prisma.analisisPartido.upsert({
      where: { partidoId },
      create: buildPersistData(partido.id, data, {
        promptVersion: PROMPT_VERSION,
        inputsSnapshot,
        latenciaMs,
        tokensIn,
        tokensOut,
      }),
      update: {
        ...buildPersistData(partido.id, data, {
          promptVersion: PROMPT_VERSION,
          inputsSnapshot,
          latenciaMs,
          tokensIn,
          tokensOut,
        }),
        // Cualquier regeneración degrada a PENDIENTE para revisión humana.
        estado: "PENDIENTE",
        aprobadoPor: null,
        aprobadoEn: null,
        rechazadoMotivo: null,
        archivadoEn: null,
      },
    });
  } catch (err) {
    logger.error(
      { err, partidoId, source: "analisis-partido:gen" },
      "generarAnalisisParaPartido: upsert falló",
    );
    return {
      ok: false,
      motivo: "persistencia-falló",
      latenciaMs,
      tokensInput: tokensIn,
      tokensOutput: tokensOut,
    };
  }

  void track({
    evento: "analisis_partido_generado",
    props: {
      partidoId,
      analisisId: persistido.id,
      tokensTotales: tokensIn + tokensOut,
      latenciaMs,
      modelo: cfg.model,
      promptVersion: PROMPT_VERSION,
      forceRegenerar: opts.forceRegenerar === true,
    },
  });

  logger.info(
    {
      partidoId,
      analisisId: persistido.id,
      tokensTotales: tokensIn + tokensOut,
      latenciaMs,
      source: "analisis-partido:gen",
    },
    "generarAnalisisParaPartido: ok",
  );

  return {
    ok: true,
    motivo: "ok",
    analisisId: persistido.id,
    latenciaMs,
    tokensInput: tokensIn,
    tokensOutput: tokensOut,
  };
}

// Alias semántico para uso desde admin (regenerar = generar con
// forceRegenerar=true).
export function regenerarAnalisis(partidoId: string): Promise<GenerarResultado> {
  return generarAnalisisParaPartido(partidoId, { forceRegenerar: true });
}

// ---------------------------------------------------------------------------
// Cron — red de seguridad para partidos con Filtro 1 sin análisis
// ---------------------------------------------------------------------------

export async function generarAnalisisDelDia(): Promise<CronGenerarReporte> {
  const reporte: CronGenerarReporte = {
    partidosCandidatos: 0,
    partidosProcesados: 0,
    analisisCreados: 0,
    errores: 0,
  };

  const ahora = new Date();
  const ventanaFin = new Date(
    ahora.getTime() + VENTANA_HORAS_LOOKAHEAD * 3600 * 1000,
  );

  // Ligas top: priorizamos por prioridadDisplay ascendente.
  const ligasTop = LIGAS.filter((l) => l.activa)
    .slice()
    .sort((a, b) => a.prioridadDisplay - b.prioridadDisplay)
    .map((l) => l.nombre);

  // Filtro 1 ON, kickoff próximo, sin análisis APROBADO previo.
  const candidatos = await prisma.partido.findMany({
    where: {
      mostrarAlPublico: true,
      fechaInicio: { gte: ahora, lte: ventanaFin },
      liga: { in: ligasTop },
      estado: "PROGRAMADO",
      OR: [
        { analisisPartido: null },
        { analisisPartido: { estado: { in: ["PENDIENTE", "RECHAZADO", "ARCHIVADO"] } } },
      ],
    },
    orderBy: { fechaInicio: "asc" },
    take: MAX_PARTIDOS_POR_CORRIDA * 4,
  });

  reporte.partidosCandidatos = candidatos.length;

  for (const partido of candidatos.slice(0, MAX_PARTIDOS_POR_CORRIDA)) {
    try {
      const r = await generarAnalisisParaPartido(partido.id);
      if (r.ok && r.motivo === "ok") reporte.analisisCreados += 1;
      reporte.partidosProcesados += 1;
    } catch (err) {
      logger.error(
        { err, partidoId: partido.id, source: "analisis-partido:cron" },
        "generarAnalisisDelDia: error en partido",
      );
      reporte.errores += 1;
    }
  }

  return reporte;
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

interface CachedOdd {
  casa: string;
  casaNombre: string;
  odd: number;
}

function oddOrEmpty(o: CachedOdd | null): {
  casa: string | null;
  odd: number | null;
} {
  if (!o) return { casa: null, odd: null };
  return { casa: o.casa, odd: o.odd };
}

interface PersistMeta {
  promptVersion: string;
  inputsSnapshot: unknown;
  latenciaMs: number;
  tokensIn: number;
  tokensOut: number;
}

function buildPersistData(
  partidoId: string,
  data: AnalisisRichResponse,
  meta: PersistMeta,
): Prisma.AnalisisPartidoUncheckedCreateInput {
  return {
    partidoId,
    pronostico1x2: data.pronostico1x2,
    probabilidades: data.probabilidades as unknown as Prisma.InputJsonValue,
    mejorCuota: data.mejorCuota as unknown as Prisma.InputJsonValue,
    analisisBasico: data.analisisBasico,
    combinadaOptima: data.combinadaOptima
      ? (data.combinadaOptima as unknown as Prisma.InputJsonValue)
      : Prisma.JsonNull,
    razonamiento: data.razonamiento,
    analisisGoles: data.analisisGoles as unknown as Prisma.InputJsonValue,
    analisisTarjetas: data.analisisTarjetas as unknown as Prisma.InputJsonValue,
    mercadosSecundarios: data.mercadosSecundarios as unknown as Prisma.InputJsonValue,
    estado: "PENDIENTE",
    promptVersion: meta.promptVersion,
    inputsJSON: meta.inputsSnapshot as Prisma.InputJsonValue,
    latenciaMs: meta.latenciaMs,
    tokensInput: meta.tokensIn,
    tokensOutput: meta.tokensOut,
    generadoEn: new Date(),
  };
}

// Re-export para que el cron HTTP pueda consumirlo sin importar el módulo
// completo del Lote E.
export { AnalisisRichResponseSchema, PROMPT_VERSION };
export type { AnalisisRichResponse };
// Marcar dependencia explícita para no romper si algún caller necesita el
// tipo `Partido` sin re-importarlo.
export type { Partido };
