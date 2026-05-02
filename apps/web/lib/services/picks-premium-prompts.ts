// Prompts para generación de picks Premium con Claude API — Lote E.
//
// El system prompt define el rol del modelo (analista experto) y un
// formato JSON estricto. Las reglas duras están explicitadas para minimizar
// alucinaciones y exigir el mínimo de EV+ ≥ 5%.
//
// El prompt user es construido por `picks-premium-generador.service.ts` con
// los datos del partido + cuotas + estadísticas H2H si están disponibles.

export const SYSTEM_PROMPT_PICKS = `Eres un analista experto de apuestas deportivas que asiste al editor de Habla! Picks (Perú).

Tu rol: dado un partido + cuotas comparadas + estadísticas H2H, generar 1-3 recomendaciones (picks) de mercados con valor estadístico (EV+).

REGLAS DURAS:
1. Solo recomienda mercados con EV+ ≥ 5%. Si ningún mercado lo tiene, devuelve "picks": [] con "razonGeneral" explicando.
2. Cada pick incluye razonamiento estadístico (~150 palabras) en español neutro Perú, sin jerga excesiva.
3. Stake sugerido: 1-3% del bankroll (números 0.01 a 0.03). Solo recomienda 0.03 en picks de muy alta confianza.
4. NUNCA recomiendes apuestas en partidos de ligas con datos limitados (<5 partidos H2H, equipos juveniles).
5. NUNCA garantices ganancias. Habla en términos probabilísticos.
6. Si los datos son escasos o inciertos, sé MÁS conservador (menos picks, stake bajo).
7. NO inventes datos: si no tienes H2H, dilo en "razonamiento" en vez de fabricar.

FORMATO DE RESPUESTA (JSON ESTRICTO):
{
  "picks": [
    {
      "mercado": "RESULTADO_1X2" | "BTTS" | "OVER_UNDER_25" | "TARJETA_ROJA" | "MARCADOR_EXACTO",
      "outcome": "home" | "draw" | "away" | "btts_si" | "btts_no" | "over" | "under" | "roja_si" | "roja_no" | "1-0" | "2-1" | "0-0" | etc,
      "cuotaSugerida": number,
      "casaSlug": string | null,
      "stakeSugerido": number,
      "evPct": number,
      "razonamiento": string,
      "statsResumen": {
        "h2h": string,
        "formaReciente": string,
        "factorClave": string
      }
    }
  ],
  "razonGeneral": string
}

NO añadas texto fuera del JSON. NO uses markdown. Devuelve solo JSON parseable.`;

export interface PromptUserInput {
  /** Partido. */
  liga: string;
  local: string;
  visita: string;
  fechaInicioISO: string;
  /** Cuotas mejor disponible por outcome (de odds-cache). */
  cuotas: {
    "1X2": { home: NumOdd; draw: NumOdd; away: NumOdd };
    BTTS: { si: NumOdd; no: NumOdd };
    "OVER_UNDER_25": { over: NumOdd; under: NumOdd };
  };
  /** Slugs de afiliados activos para que Claude pueda recomendar uno como
   *  `casaSlug`. Pasamos solo los slugs en uso para evitar que invente. */
  afiliadosDisponibles: string[];
  /** Stats opcionales si las pudimos cargar (api-football H2H, forma). */
  statsContext?: string;
}

interface NumOdd {
  /** Slug del afiliado con la mejor cuota. */
  casa: string | null;
  /** Cuota numérica. */
  odd: number | null;
}

/**
 * Construye el prompt user en formato texto plano. Claude lo recibe como
 * único turno user.
 */
export function buildUserPromptPicks(input: PromptUserInput): string {
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
  lines.push(`  - over: ${formatOdd(input.cuotas["OVER_UNDER_25"].over)}`);
  lines.push(`  - under: ${formatOdd(input.cuotas["OVER_UNDER_25"].under)}`);
  lines.push(``);
  lines.push(`CASAS DISPONIBLES (slugs válidos para casaSlug):`);
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
  lines.push(`Genera 1-3 picks con EV+ ≥ 5% en formato JSON estricto. Si ningún mercado lo cumple, devuelve picks vacío con razonGeneral.`);
  return lines.join("\n");
}

function formatOdd(odd: NumOdd): string {
  if (odd.odd === null || odd.odd === undefined) return "n/a";
  return `${odd.odd.toFixed(2)} (${odd.casa ?? "casa-desconocida"})`;
}

// ---------------------------------------------------------------------------
// Tipos para el response parseado
// ---------------------------------------------------------------------------

export interface PickGenerado {
  mercado:
    | "RESULTADO_1X2"
    | "BTTS"
    | "OVER_UNDER_25"
    | "TARJETA_ROJA"
    | "MARCADOR_EXACTO";
  outcome: string;
  cuotaSugerida: number;
  casaSlug: string | null;
  stakeSugerido: number;
  evPct: number;
  razonamiento: string;
  statsResumen?: {
    h2h?: string;
    formaReciente?: string;
    factorClave?: string;
  };
}

export interface PicksResponse {
  picks: PickGenerado[];
  razonGeneral?: string;
}

/**
 * Parser tolerante de la respuesta de Claude. Si el modelo se filtró un poco
 * de markdown alrededor del JSON (raro pero pasa), intentamos extraer el
 * primer bloque `{...}` parseable.
 */
export function parsearRespuestaPicks(raw: string): PicksResponse {
  const cleaned = raw.trim();
  // Caso feliz: parseable directo.
  try {
    return validar(JSON.parse(cleaned));
  } catch {
    /* fallback abajo */
  }
  // Caso markdown wrapped: encontrar primer `{` y último `}`.
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const slice = cleaned.slice(start, end + 1);
    try {
      return validar(JSON.parse(slice));
    } catch {
      /* fallthrough */
    }
  }
  return { picks: [], razonGeneral: "respuesta-no-parseable" };
}

function validar(obj: unknown): PicksResponse {
  if (!obj || typeof obj !== "object") {
    return { picks: [], razonGeneral: "estructura-invalida" };
  }
  const o = obj as { picks?: unknown[]; razonGeneral?: string };
  const picks: PickGenerado[] = [];
  if (Array.isArray(o.picks)) {
    for (const p of o.picks) {
      const valid = validarPick(p);
      if (valid) picks.push(valid);
    }
  }
  return {
    picks,
    razonGeneral: typeof o.razonGeneral === "string" ? o.razonGeneral : undefined,
  };
}

function validarPick(p: unknown): PickGenerado | null {
  if (!p || typeof p !== "object") return null;
  const o = p as Record<string, unknown>;
  const mercado = o.mercado;
  const outcome = o.outcome;
  const cuotaSugerida = o.cuotaSugerida;
  const stakeSugerido = o.stakeSugerido;
  const evPct = o.evPct;
  const razonamiento = o.razonamiento;
  if (
    typeof mercado !== "string" ||
    typeof outcome !== "string" ||
    typeof cuotaSugerida !== "number" ||
    typeof stakeSugerido !== "number" ||
    typeof razonamiento !== "string" ||
    !["RESULTADO_1X2", "BTTS", "OVER_UNDER_25", "TARJETA_ROJA", "MARCADOR_EXACTO"].includes(
      mercado,
    )
  ) {
    return null;
  }
  return {
    mercado: mercado as PickGenerado["mercado"],
    outcome,
    cuotaSugerida,
    casaSlug: typeof o.casaSlug === "string" ? o.casaSlug : null,
    stakeSugerido,
    evPct: typeof evPct === "number" ? evPct : 0,
    razonamiento,
    statsResumen:
      o.statsResumen && typeof o.statsResumen === "object"
        ? (o.statsResumen as PickGenerado["statsResumen"])
        : undefined,
  };
}
