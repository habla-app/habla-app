// torneo-detail-view — mapper puro para /torneo/:id (Hotfix #5 Bug #13).
//
// Deriva el "view-model" del detalle del torneo a partir de:
//   - el torneo y su partido (BD)
//   - estado del torneo (ABIERTO / CERRADO / EN_JUEGO / FINALIZADO / CANCELADO)
//   - el ticket del usuario loggeado, si hay
//
// Convenciones del Bug #13:
//
// 1. EL POZO: se muestra UN SOLO NÚMERO con label "Pozo".
//    - Mientras el torneo está ABIERTO el "pozo" expuesto es la
//      estimación post-rake (`pozoBruto × 0.88`), porque `pozoNeto` en
//      BD recién se calcula al cierre.
//    - Una vez CERRADO/EN_JUEGO/FINALIZADO usamos `pozoNeto` real de BD.
//    - NUNCA se expone "pozo neto", "pozo bruto" ni "rake" al jugador.
//
// 2. DISTRIBUCIÓN: calculamos los montos en Lukas absolutos sobre el
//    pozo expuesto (35/20/12/33%). El 33% de "4° a 10°" se divide en
//    7 partes iguales y se expone como "~X 🪙 c/u".
//
// 3. CTA estelar: cambia según estado.
//    - ABIERTO + yaInscrito + ticketsUsuario<10 → "Editar mi combinada"
//      (si placeholder default) o "+ Otra combinada"
//    - ABIERTO + ticketsUsuario===10 → disabled "Máximo alcanzado"
//    - ABIERTO + !yaInscrito → "🎯 Crear combinada"
//    - CERRADO/EN_JUEGO → "Ver ranking en vivo" → /live-match
//    - FINALIZADO → "Ver resultado final" → /live-match
//    - CANCELADO → card informativa, sin CTA
//
// Todo el helper es puro — ni Prisma ni env ni dates dinámicas — para
// facilitar el testeo. Fecha-dependencias se pasan por parámetro (`now`).

import { DISTRIB_PREMIOS, RAKE_PCT } from "@/lib/services/torneos.service";

export type EstadoTorneoView =
  | "ABIERTO"
  | "CERRADO"
  | "EN_JUEGO"
  | "FINALIZADO"
  | "CANCELADO";

export interface TorneoDetailInput {
  estado: EstadoTorneoView;
  pozoBruto: number;
  pozoNeto: number;
  totalInscritos: number;
  entradaLukas: number;
  cierreAt: Date;
  /** Tickets que ya tiene el usuario logueado en este torneo. 0 si no
   *  hay sesión o no está inscrito. */
  ticketsUsuario: number;
  /** True si alguno de sus tickets es el placeholder del Sub-Sprint 3.
   *  Cambia el copy del CTA a "Editar mi combinada" en vez de "+ Otra". */
  tienePlaceholder: boolean;
  /** "Now" para computar `cerrado` (cierreAt <= now) y otros flags
   *  dependientes del tiempo. Parametrizable para tests. */
  now: Date;
}

export interface TorneoDetailViewModel {
  /** Número único a mostrar con label "Pozo" (en Lukas). */
  pozoMostrado: number;
  /** Premios por posición en Lukas absolutos (1°, 2°, 3°, y cada
   *  puesto del 4°-10° por separado = mismo valor). */
  premios: {
    primero: number;
    segundo: number;
    tercero: number;
    cuartoADecimo: number;
  };
  /** Estado resuelto para la UI (mismo que input.estado salvo que el
   *  cierre ya se pasó pero el cron aún no movió el estado: marcamos
   *  como CERRADO para que el CTA deje de invitar a inscribirse). */
  estadoResuelto: EstadoTorneoView;
  /** True si CERRADO/EN_JUEGO/FINALIZADO — habilita mostrar predicciones
   *  + puntos de los inscritos (privacidad competitiva inversa). */
  mostrarPredicciones: boolean;
  /** Config del CTA estelar. */
  cta: TorneoDetailCta;
}

export type TorneoDetailCta =
  | { kind: "combo"; label: string; variant: "primary" | "urgent" }
  | { kind: "link"; label: string; href: string }
  | { kind: "disabled"; label: string; reason: string }
  | { kind: "info"; label: string; tone: "warning" | "neutral" };

export const MAX_TICKETS_POR_TORNEO_VIEW = 10;

export function buildTorneoDetailViewModel(
  input: TorneoDetailInput,
): TorneoDetailViewModel {
  // Estado resuelto: si cierreAt < now y BD aún dice ABIERTO, la UI
  // trata el torneo como CERRADO (el cron lo moverá en <=1min).
  let estadoResuelto = input.estado;
  if (
    estadoResuelto === "ABIERTO" &&
    input.cierreAt.getTime() <= input.now.getTime()
  ) {
    estadoResuelto = "CERRADO";
  }

  // Pozo mostrado: estimación (1 - RAKE_PCT) del bruto si aún no se
  // calculó el neto real. Nunca expone bruto ni rake al jugador.
  const pozoMostrado =
    input.pozoNeto > 0
      ? input.pozoNeto
      : Math.floor(input.pozoBruto * (1 - RAKE_PCT));

  const premios = {
    primero: Math.floor(pozoMostrado * DISTRIB_PREMIOS["1"]),
    segundo: Math.floor(pozoMostrado * DISTRIB_PREMIOS["2"]),
    tercero: Math.floor(pozoMostrado * DISTRIB_PREMIOS["3"]),
    cuartoADecimo: Math.floor((pozoMostrado * DISTRIB_PREMIOS["4-10"]) / 7),
  };

  const mostrarPredicciones = estadoResuelto !== "ABIERTO";

  const cta = buildCta(input, estadoResuelto);

  return {
    pozoMostrado,
    premios,
    estadoResuelto,
    mostrarPredicciones,
    cta,
  };
}

function buildCta(
  input: TorneoDetailInput,
  estado: EstadoTorneoView,
): TorneoDetailCta {
  if (estado === "CANCELADO") {
    return {
      kind: "info",
      label:
        "Este torneo fue cancelado. Los Lukas de entrada fueron reembolsados automáticamente.",
      tone: "warning",
    };
  }

  if (estado === "CERRADO" || estado === "EN_JUEGO") {
    return {
      kind: "link",
      label: "Ver ranking en vivo →",
      href: "__LIVE_HREF__", // reemplazable por el caller con torneoId
    };
  }

  if (estado === "FINALIZADO") {
    return {
      kind: "link",
      label: "Ver resultado final →",
      href: "__LIVE_HREF__",
    };
  }

  // ABIERTO
  if (input.ticketsUsuario >= MAX_TICKETS_POR_TORNEO_VIEW) {
    return {
      kind: "disabled",
      label: "Máximo de tickets alcanzado",
      reason: `Ya tenés ${MAX_TICKETS_POR_TORNEO_VIEW} combinadas en este torneo.`,
    };
  }

  // Urgencia: <15 min al cierre → CTA rojo. Helper inline para no
  // acoplarse a `urgency.ts` (que es internal).
  const diffMin =
    (input.cierreAt.getTime() - input.now.getTime()) / 60_000;
  const urgent = diffMin < 15;

  const label = input.tienePlaceholder
    ? "✏️ Editar mi combinada"
    : input.ticketsUsuario > 0
      ? "+ Otra combinada"
      : urgent
        ? "🔥 Crear combinada"
        : "🎯 Crear combinada";

  return {
    kind: "combo",
    label,
    variant: urgent ? "urgent" : "primary",
  };
}
