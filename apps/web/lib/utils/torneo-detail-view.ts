// torneo-detail-view — mapper puro para /torneo/:id.
//
// Lote 2 (Abr 2026): se demolió el sistema de Lukas. El detalle del torneo
// ya no muestra pozos ni premios. Lo que sobrevive del view-model:
//
//   1. estadoResuelto: si cierreAt ≤ now y BD dice ABIERTO, lo tratamos
//      como CERRADO (el cron lo va a mover en <=1 min).
//   2. mostrarPredicciones: true para CERRADO/EN_JUEGO/FINALIZADO.
//   3. cta: el CTA estelar varía según estado y la inscripción del
//      usuario. Plan v6 — copy "Hacer mi predicción" / "Editar mi
//      combinada" / etc.

export type EstadoTorneoView =
  | "ABIERTO"
  | "CERRADO"
  | "EN_JUEGO"
  | "FINALIZADO"
  | "CANCELADO";

export interface TorneoDetailInput {
  estado: EstadoTorneoView;
  totalInscritos: number;
  cierreAt: Date;
  /** Tickets que ya tiene el usuario logueado en este torneo. 0 si no
   *  hay sesión o no está inscrito. */
  ticketsUsuario: number;
  /** True si alguno de sus tickets es el placeholder (predicciones
   *  default). Cambia el copy del CTA a "Editar mi combinada". */
  tienePlaceholder: boolean;
  /** "Now" para computar `cerrado` (cierreAt ≤ now) y otros flags
   *  dependientes del tiempo. Parametrizable para tests. */
  now: Date;
}

export interface TorneoDetailViewModel {
  /** Estado resuelto para la UI. */
  estadoResuelto: EstadoTorneoView;
  /** True si CERRADO/EN_JUEGO/FINALIZADO — habilita mostrar predicciones
   *  + puntos de los inscritos. */
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
  let estadoResuelto = input.estado;
  if (
    estadoResuelto === "ABIERTO" &&
    input.cierreAt.getTime() <= input.now.getTime()
  ) {
    estadoResuelto = "CERRADO";
  }

  const mostrarPredicciones = estadoResuelto !== "ABIERTO";
  const cta = buildCta(input, estadoResuelto);

  return { estadoResuelto, mostrarPredicciones, cta };
}

function buildCta(
  input: TorneoDetailInput,
  estado: EstadoTorneoView,
): TorneoDetailCta {
  if (estado === "CANCELADO") {
    return {
      kind: "info",
      label: "Este torneo fue cancelado.",
      tone: "warning",
    };
  }

  if (estado === "CERRADO" || estado === "EN_JUEGO") {
    return {
      kind: "link",
      label: "Ver ranking en vivo →",
      href: "__LIVE_HREF__",
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
      label: "Máximo de combinadas alcanzado",
      reason: `Ya tenés ${MAX_TICKETS_POR_TORNEO_VIEW} combinadas en este torneo.`,
    };
  }

  const diffMin =
    (input.cierreAt.getTime() - input.now.getTime()) / 60_000;
  const urgent = diffMin < 15;

  const label = input.tienePlaceholder
    ? "✏️ Editar mi combinada"
    : input.ticketsUsuario > 0
      ? "+ Otra combinada"
      : urgent
        ? "🔥 Hacer mi predicción"
        : "🎯 Hacer mi predicción";

  return {
    kind: "combo",
    label,
    variant: urgent ? "urgent" : "primary",
  };
}
