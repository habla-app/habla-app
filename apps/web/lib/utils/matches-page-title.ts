// matches-page-title — helper puro que deriva el <h1> de `/matches`
// según los filtros activos (liga + día). Hotfix #5 Bug #15.
//
// Antes el h1 decía literalmente "Partidos de hoy" sin importar el
// filtro seleccionado — misleading cuando el usuario estaba viendo
// "Mañana" o "Champions · Sáb 28 abr" y leía "Partidos de hoy".
//
// Reglas:
//   - sin filtros            → "Todos los torneos"
//   - solo liga              → "Torneos de <nombreLiga>"
//   - solo día (hoy)         → "Torneos de hoy"
//   - solo día (mañana)      → "Torneos de mañana"
//   - solo día (otro)        → "Torneos del <formato-día>"
//   - liga + día             → "Torneos de <liga> · <día>"
//
// Testeable sin jsdom — todo string puro con tz explícita.

import { DEFAULT_TZ, formatDayChip, getDayKey } from "@/lib/utils/datetime";
import { LIGA_SLUGS } from "@/lib/config/liga-slugs";

export interface MatchesTitleInput {
  /** Slug del ?liga= (de LIGA_SLUGS keys), o null/undefined si "Todas". */
  liga?: string | null;
  /** dayKey YYYY-MM-DD en la tz dada, o null/undefined si "Todos". */
  dia?: string | null;
  /** "Now" para decidir si dia=hoy/mañana. Parametrizable para tests. */
  now?: Date;
  /** Timezone para formatear el día. Default America/Lima. */
  tz?: string;
}

export interface MatchesTitle {
  title: string;
  /** El helper NO dicta el subtítulo (se deja fijo en la UI). Lo
   *  expone por si un caller quiere overridearlo, pero lo default es
   *  que la UI mantenga el subtitle existente. */
  subtitle?: string;
}

/**
 * Nombre legible de la liga por slug. Fuente de verdad: LIGA_SLUGS.
 * Devuelve null si el slug no está registrado (el caller cae al
 * "Todos los torneos" o ignora el filtro).
 */
function nombreLiga(slug: string): string | null {
  return LIGA_SLUGS[slug] ?? null;
}

/**
 * Formato para el día dentro del título. Reusa `formatDayChip` que ya
 * maneja hoy/mañana/mes-actual/mes-cruzado. Si dayKey no parsea,
 * devuelve null y el caller lo ignora.
 */
function nombreDia(
  dia: string,
  now: Date,
  tz: string,
): { kind: "hoy" | "manana" | "otro"; label: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return null;
  const todayKey = getDayKey(now, tz);
  const tomorrowKey = getDayKey(new Date(now.getTime() + 86_400_000), tz);
  if (dia === todayKey) return { kind: "hoy", label: "hoy" };
  if (dia === tomorrowKey) return { kind: "manana", label: "mañana" };
  // `formatDayChip` devuelve "Mié 22 abr" / "Lun 20" — perfecto para
  // el sufijo del título. Lo lowercaseamos para que fluya natural
  // dentro de la frase "Torneos del ...".
  const label = formatDayChip(dia, tz, now);
  return { kind: "otro", label };
}

export function buildMatchesPageTitle(input: MatchesTitleInput = {}): MatchesTitle {
  const now = input.now ?? new Date();
  const tz = input.tz ?? DEFAULT_TZ;
  const liga = input.liga ? nombreLiga(input.liga) : null;
  const dia = input.dia ? nombreDia(input.dia, now, tz) : null;

  // Sin filtros activos — o con slugs desconocidos que colapsan a
  // null — mostramos el default general.
  if (!liga && !dia) return { title: "Todos los torneos" };

  // Solo liga
  if (liga && !dia) return { title: `Torneos de ${liga}` };

  // Solo día
  if (!liga && dia) {
    if (dia.kind === "hoy") return { title: "Torneos de hoy" };
    if (dia.kind === "manana") return { title: "Torneos de mañana" };
    return { title: `Torneos del ${dia.label}` };
  }

  // Liga + día. Preservamos el nombre exacto de la liga y pegamos el
  // día con separador middot. Para "hoy"/"mañana" capitalizamos para
  // que el middot se lea bien ("Torneos de Liga 1 Perú · Hoy").
  const sufijoDia =
    dia!.kind === "hoy"
      ? "Hoy"
      : dia!.kind === "manana"
        ? "Mañana"
        : dia!.label;
  return { title: `Torneos de ${liga!} · ${sufijoDia}` };
}
