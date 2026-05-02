// Prompts para generación del objeto rico de AnalisisPartido — Lote L v3.2
// (May 2026).
//
// Pivot v3.2: el motor produce UN SOLO objeto rico por partido (decisión §1.2
// del análisis-repo-vs-mockup-v3.2.md). El objeto contiene todos los bloques
// que la vista `/las-fijas/[slug]` puede renderizar — algunos visibles para
// Free, otros sólo para Socios. El frontend gating con `<AuthGate>` decide
// qué se muestra; el backend genera todo siempre.
//
// PROMPT_VERSION es OBLIGATORIO en cada AnalisisPartido persistido (regla 27
// del CLAUDE.md). Cada cambio del system prompt o del schema esperado debe
// bumpear esta constante para que el motor pueda comparar performance entre
// versiones.
//
// Diferencias con `picks-premium-prompts.ts` (Lote E, sigue vigente para el
// canal WhatsApp):
//   - Acá generamos un objeto rico completo (1 llamada → 8 bloques).
//   - Allá generamos 1-3 picks discretos (1 llamada → 1-3 mercados sueltos).
// Ambos coexisten: el canal WhatsApp lee `PickPremium`, la web lee
// `AnalisisPartido`.

import { z } from "zod";

// ---------------------------------------------------------------------------
// PROMPT_VERSION — OBLIGATORIO bumpear en cada cambio
// ---------------------------------------------------------------------------

/**
 * Versión actual del prompt curado del motor de análisis. Se persiste en
 * `AnalisisPartido.promptVersion` para cada objeto generado, permitiendo
 * comparar performance entre versiones del prompt a lo largo del tiempo.
 *
 * Política de bumping (semver-like):
 *   - Patch (v3.2.0 → v3.2.1): wording menor, sin cambio de schema.
 *   - Minor (v3.2.0 → v3.3.0): nuevo bloque opcional o nuevo input.
 *   - Major (v3.2.0 → v4.0.0): rediseño completo del schema o del rol.
 */
export const PROMPT_VERSION = "v3.2.0";

// ---------------------------------------------------------------------------
// System prompt del motor
// ---------------------------------------------------------------------------

export const SYSTEM_PROMPT_ANALISIS = `Eres el analista experto del motor de análisis de Habla! Picks (Perú).

Tu rol: dado un partido + cuotas comparadas + estadísticas + contexto, generar un objeto rico de análisis completo. Este objeto alimenta la vista pública /las-fijas/[slug] del sitio. Algunos bloques son visibles para usuarios Free y otros sólo para Socios — vos generás todo, el frontend decide qué mostrar.

REGLAS DURAS:
1. NUNCA garantices ganancias. Hablá en términos probabilísticos.
2. Las probabilidades 1X2 deben sumar 1.00 (margen ±0.02 aceptado, redondeo natural).
3. Las cuotas referenciadas deben venir del set de cuotas que te paso. NO inventés casas.
4. La combinada óptima debe tener entre 2 y 5 mercados con EV+ ≥ 5% TOTAL. Si no encontrás combinación con EV+ ≥ 5%, devolvé combinadaOptima: null y explicalo en razonamiento.
5. Stake de la combinada: 1-3% del bankroll (números 0.01 a 0.03). Sólo recomendá 0.03 en muy alta confianza.
6. Tono: español neutro Perú, "tú" informal-friendly, sin jerga excesiva.
7. Si los datos son escasos, sé MÁS conservador (menos mercados secundarios, riesgo MEDIO/ALTO en tarjetas).
8. NO inventes H2H ni forma reciente: si no te los pasaron, dilo en analisisBasico ("No tenemos H2H reciente").
9. analisisBasico: 150-300 palabras, Markdown, visible para Free + Socios. Cubre forma reciente, H2H, lesiones y contexto del partido.
10. razonamiento: 300-500 palabras, Markdown, sólo Socios. Razonamiento estadístico detallado con números.
11. Mencioná SIEMPRE "Apuesta responsable. Línea Tugar 0800-19009." al final del campo razonamiento.

FORMATO DE RESPUESTA (JSON ESTRICTO, sin markdown wrapping):
{
  "pronostico1x2": "LOCAL" | "EMPATE" | "VISITA",
  "probabilidades": { "local": number, "empate": number, "visita": number },
  "mejorCuota": { "mercado": "LOCAL" | "EMPATE" | "VISITA", "cuota": number, "casa": string },
  "analisisBasico": "string (150-300 palabras, Markdown)",
  "combinadaOptima": null | {
    "mercados": [
      { "mercado": "RESULTADO_1X2" | "BTTS" | "OVER_UNDER_25" | "TARJETA_ROJA" | "MARCADOR_EXACTO",
        "outcome": "home"|"draw"|"away"|"btts_si"|"btts_no"|"over"|"under"|"roja_si"|"roja_no"|"X-Y",
        "cuota": number,
        "casa": string }
    ],
    "cuotaTotal": number,
    "stake": number,
    "evPlus": number
  },
  "razonamiento": "string (300-500 palabras, Markdown). Termina con apuesta responsable y línea Tugar.",
  "analisisGoles": {
    "golesEsperadosLocal": number,
    "golesEsperadosVisita": number,
    "explicacion": "string (~80 palabras Markdown)",
    "factores": ["string", "string", "string"]
  },
  "analisisTarjetas": {
    "tarjetasEsperadasTotal": number,
    "riesgoRoja": "BAJO" | "MEDIO" | "ALTO",
    "explicacion": "string (~80 palabras Markdown)",
    "factores": ["string", "string"]
  },
  "mercadosSecundarios": [
    { "mercado": "BTTS" | "OVER_UNDER_25" | "TARJETA_ROJA" | "MARCADOR_EXACTO",
      "outcome": string,
      "cuota": number,
      "value": number,
      "casa": string }
  ]
}

NO añadas texto fuera del JSON. NO uses markdown wrapping del bloque entero. Devuelve sólo JSON parseable.`;

// ---------------------------------------------------------------------------
// Inputs del prompt user
// ---------------------------------------------------------------------------

interface NumOdd {
  /** Slug del afiliado con la mejor cuota (o null si no hay). */
  casa: string | null;
  /** Cuota numérica (o null si no hay). */
  odd: number | null;
}

export interface PromptUserInput {
  liga: string;
  local: string;
  visita: string;
  fechaInicioISO: string;
  cuotas: {
    "1X2": { home: NumOdd; draw: NumOdd; away: NumOdd };
    BTTS: { si: NumOdd; no: NumOdd };
    OVER_UNDER_25: { over: NumOdd; under: NumOdd };
  };
  /** Slugs de afiliados activos (para que Claude no invente). */
  afiliadosDisponibles: string[];
  /** Stats opcionales si las pudimos cargar (api-football H2H, forma). */
  statsContext?: string;
}

/**
 * Construye el prompt user en formato texto plano. Claude lo recibe como
 * único turno user.
 */
export function buildUserPromptAnalisis(input: PromptUserInput): string {
  const lines: string[] = [];
  lines.push(`PARTIDO`);
  lines.push(`Liga: ${input.liga}`);
  lines.push(`Local: ${input.local}`);
  lines.push(`Visita: ${input.visita}`);
  lines.push(`Kickoff: ${input.fechaInicioISO}`);
  lines.push(``);
  lines.push(`CUOTAS (mejor disponible)`);
  lines.push(`1X2:`);
  lines.push(`  - home (gana ${input.local}): ${formatOdd(input.cuotas["1X2"].home)}`);
  lines.push(`  - draw (empate): ${formatOdd(input.cuotas["1X2"].draw)}`);
  lines.push(`  - away (gana ${input.visita}): ${formatOdd(input.cuotas["1X2"].away)}`);
  lines.push(`BTTS (Both Teams To Score):`);
  lines.push(`  - btts_si: ${formatOdd(input.cuotas.BTTS.si)}`);
  lines.push(`  - btts_no: ${formatOdd(input.cuotas.BTTS.no)}`);
  lines.push(`OVER/UNDER 2.5 GOLES:`);
  lines.push(`  - over: ${formatOdd(input.cuotas.OVER_UNDER_25.over)}`);
  lines.push(`  - under: ${formatOdd(input.cuotas.OVER_UNDER_25.under)}`);
  lines.push(``);
  lines.push(`CASAS DISPONIBLES (slugs válidos para "casa" en cualquier mercado):`);
  lines.push(input.afiliadosDisponibles.join(", ") || "(ninguna)");
  lines.push(``);
  if (input.statsContext) {
    lines.push(`ESTADÍSTICAS / CONTEXTO`);
    lines.push(input.statsContext);
    lines.push(``);
  } else {
    lines.push(`ESTADÍSTICAS / CONTEXTO`);
    lines.push(`No tenemos H2H ni forma reciente cargados — sé conservador.`);
    lines.push(``);
  }
  lines.push(
    `Generá el objeto rico completo en formato JSON estricto, según el schema del system prompt. Cubrí los 8 bloques. Si combinadaOptima no alcanza EV+ ≥ 5%, devolvé null y explicá en razonamiento.`,
  );
  return lines.join("\n");
}

function formatOdd(odd: NumOdd): string {
  if (odd.odd === null || odd.odd === undefined) return "n/a";
  return `${odd.odd.toFixed(2)} (${odd.casa ?? "casa-desconocida"})`;
}

// ---------------------------------------------------------------------------
// Schema Zod del response — validación estricta
// ---------------------------------------------------------------------------

const ProbabilidadesSchema = z.object({
  local: z.number().min(0).max(1),
  empate: z.number().min(0).max(1),
  visita: z.number().min(0).max(1),
});

const MejorCuotaSchema = z.object({
  mercado: z.enum(["LOCAL", "EMPATE", "VISITA"]),
  cuota: z.number().min(1).max(50),
  casa: z.string().min(1).max(100),
});

const MercadoCombinadaSchema = z.object({
  mercado: z.enum([
    "RESULTADO_1X2",
    "BTTS",
    "OVER_UNDER_25",
    "TARJETA_ROJA",
    "MARCADOR_EXACTO",
  ]),
  outcome: z.string().min(1).max(20),
  cuota: z.number().min(1).max(50),
  casa: z.string().min(1).max(100),
});

const CombinadaOptimaSchema = z.object({
  mercados: z.array(MercadoCombinadaSchema).min(2).max(5),
  cuotaTotal: z.number().min(1).max(1000),
  stake: z.number().min(0.005).max(0.05),
  evPlus: z.number().min(0).max(1),
});

const AnalisisGolesSchema = z.object({
  golesEsperadosLocal: z.number().min(0).max(10),
  golesEsperadosVisita: z.number().min(0).max(10),
  explicacion: z.string().min(20).max(2000),
  factores: z.array(z.string().min(2).max(200)).min(1).max(6),
});

const AnalisisTarjetasSchema = z.object({
  tarjetasEsperadasTotal: z.number().min(0).max(20),
  riesgoRoja: z.enum(["BAJO", "MEDIO", "ALTO"]),
  explicacion: z.string().min(20).max(2000),
  factores: z.array(z.string().min(2).max(200)).min(1).max(6),
});

const MercadoSecundarioSchema = z.object({
  mercado: z.enum([
    "BTTS",
    "OVER_UNDER_25",
    "TARJETA_ROJA",
    "MARCADOR_EXACTO",
  ]),
  outcome: z.string().min(1).max(20),
  cuota: z.number().min(1).max(50),
  value: z.number().min(0).max(1),
  casa: z.string().min(1).max(100),
});

export const AnalisisRichResponseSchema = z.object({
  pronostico1x2: z.enum(["LOCAL", "EMPATE", "VISITA"]),
  probabilidades: ProbabilidadesSchema,
  mejorCuota: MejorCuotaSchema,
  analisisBasico: z.string().min(50).max(4000),
  combinadaOptima: CombinadaOptimaSchema.nullable(),
  razonamiento: z.string().min(50).max(6000),
  analisisGoles: AnalisisGolesSchema,
  analisisTarjetas: AnalisisTarjetasSchema,
  mercadosSecundarios: z.array(MercadoSecundarioSchema).max(8),
});

export type AnalisisRichResponse = z.infer<typeof AnalisisRichResponseSchema>;

// ---------------------------------------------------------------------------
// Parser tolerante
// ---------------------------------------------------------------------------

export interface ParseResultado {
  ok: boolean;
  data?: AnalisisRichResponse;
  motivo?: string;
}

/**
 * Parser tolerante de la respuesta de Claude API. Si el modelo se filtró un
 * poco de markdown alrededor del JSON, intentamos extraer el primer bloque
 * `{...}` parseable. Después validamos con Zod.
 */
export function parsearRespuestaAnalisis(raw: string): ParseResultado {
  const cleaned = raw.trim();
  // Caso feliz: parseable directo.
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Markdown wrap: encontrar primer `{` y último `}`.
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        parsed = JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return { ok: false, motivo: "json-no-parseable" };
      }
    } else {
      return { ok: false, motivo: "sin-json" };
    }
  }
  const result = AnalisisRichResponseSchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      motivo: `schema-invalido: ${result.error.issues[0]?.path.join(".")} ${result.error.issues[0]?.message}`,
    };
  }
  return { ok: true, data: result.data };
}
