// Status discriminado del ComboModal (Hotfix #4 Bug #6).
//
// El modal tiene 6 estados visibles que el render de body + footer deben
// diferenciar. Antes del Hotfix #4 solo existían "normal" e "idle" + el
// flag `balanceInsuficiente` del mapper de footer — no había feedback
// post-submit ni copy específico para cierre/capacidad ni errores de
// red. Este tipo centraliza todos los estados en un solo eje.
//
// El status es independiente de `computeComboFooterState` (que solo
// decide cuántos Lukas descontar y si alcanza el balance). Ambos se
// componen en el ComboModal: footer state = cálculo de Lukas; status =
// fase del flujo del usuario.

export type ComboModalStatus =
  | "idle"
  | "submitting"
  | "success"
  | "insufficient-balance"
  | "tournament-closed"
  | "error";

/** Datos del ticket recién creado que se muestran en el panel de éxito. */
export interface ComboSuccessInfo {
  ticketId: string;
  /** Lukas pagados por el ticket (0 si fue reemplazo de placeholder). */
  entradaPagada: number;
  /** Premio máximo teórico (21 si usuario completó predicciones). */
  puntosMaximos: number;
  /** Predicción humanizada para mostrar en la confirmación. */
  predResumen: {
    resultado: "LOCAL" | "EMPATE" | "VISITA";
    btts: boolean;
    mas25: boolean;
    tarjetaRoja: boolean;
    marcadorLocal: number;
    marcadorVisita: number;
  };
  /** Balance después del descuento (0 si hubo placeholder). */
  nuevoBalance: number;
  reemplazoPlaceholder: boolean;
}

export interface ComboModalUIState {
  /** Título principal que muestra el body (si hay feedback panel). */
  bodyTitle: string;
  /** Texto secundario del body. */
  bodyCopy: string;
  /** Emoji o icono decorativo del panel de feedback. */
  icon: string;
  /** Tono cromatico del panel: verde ok, rojo error, ámbar warning, neutral. */
  tone: "success" | "error" | "warning" | "neutral";
  /** CTA principal del footer. Null = no renderizar footer principal. */
  primaryCta: {
    label: string;
    /** Si es link interno, pasar href. Si es botón, handler ===
     *  "retry" | "close" | "submit" | "reset" según el status.
     *  `reset` se usa desde Abr 2026 en el panel de éxito (primary =
     *  "Crear otra combinada" → reabre el form del modal). */
    kind: "link" | "retry" | "close" | "submit" | "reset";
    href?: string;
  } | null;
  /** CTA secundario opcional (ej. "Ver mis combinadas" en éxito). */
  secondaryCta: {
    label: string;
    kind: "link" | "retry" | "close" | "submit" | "reset";
    href?: string;
  } | null;
}

interface ComputeUIStateOpts {
  status: ComboModalStatus;
  tienePlaceholder: boolean;
  entradaLukas: number;
  /** Mensaje del backend o del fetch cuando status === "error". */
  errorMessage?: string | null;
  /** Cuántos Lukas le faltan al usuario. Se usa en insufficient-balance. */
  faltanLukas?: number;
}

/**
 * Deriva el texto + CTAs del feedback panel del ComboModal según el
 * status. Pura — 0 side effects. Los CTAs vienen con `kind` que el
 * componente resuelve a handler concreto (retry/close/reset) o a un
 * `<Link href>` para link kind.
 */
export function computeComboModalUIState(
  opts: ComputeUIStateOpts,
): ComboModalUIState {
  switch (opts.status) {
    case "submitting":
      return {
        bodyTitle: "Enviando tu combinada...",
        bodyCopy: "Un momento, estamos confirmando la inscripción.",
        icon: "⏳",
        tone: "neutral",
        primaryCta: null,
        secondaryCta: null,
      };

    case "success":
      return {
        bodyTitle: opts.tienePlaceholder
          ? "¡Combinada confirmada!"
          : "¡Estás inscrito!",
        bodyCopy: opts.tienePlaceholder
          ? "Tu combinada quedó sellada. Los puntos se calcularán cuando arranque el partido."
          : "Tu ticket quedó sellado. Te toca seguir el partido en vivo y ver cómo vas en el ranking.",
        icon: "🎉",
        tone: "success",
        // Énfasis invertido (Abr 2026): el PO quiere empujar a armar más
        // combinadas antes que sacar al usuario a otra pantalla.
        primaryCta: {
          label: "Crear otra combinada",
          kind: "reset",
        },
        secondaryCta: {
          label: "Ver mis combinadas",
          kind: "link",
          href: "/mis-combinadas",
        },
      };

    case "insufficient-balance":
      return {
        bodyTitle: "Balance insuficiente",
        bodyCopy: `Te faltan ${opts.faltanLukas ?? 0} Lukas para inscribirte en este torneo. Comprá un pack para seguir jugando.`,
        icon: "🪙",
        tone: "warning",
        primaryCta: {
          label: "Comprar Lukas",
          kind: "link",
          href: "/wallet",
        },
        secondaryCta: {
          label: "Cerrar",
          kind: "close",
        },
      };

    case "tournament-closed":
      return {
        bodyTitle: "El torneo ya cerró",
        bodyCopy:
          "Las inscripciones se cerraron al inicio del partido. Elegí otro torneo para armar tu combinada.",
        icon: "🔒",
        tone: "warning",
        primaryCta: {
          label: "Ver otros torneos",
          kind: "link",
          href: "/matches",
        },
        secondaryCta: {
          label: "Cerrar",
          kind: "close",
        },
      };

    case "error":
      return {
        bodyTitle: "No pudimos enviar tu combinada",
        bodyCopy:
          opts.errorMessage ??
          "Se cortó la conexión o hubo un error en el servidor. Probá de nuevo.",
        icon: "⚠️",
        tone: "error",
        primaryCta: {
          label: "Reintentar",
          kind: "retry",
        },
        secondaryCta: {
          label: "Cerrar",
          kind: "close",
        },
      };

    case "idle":
    default:
      return {
        bodyTitle: "Armá tus 5 predicciones",
        bodyCopy:
          "Elegí el resultado, el marcador exacto y las tres jugadas complementarias. Tenés hasta el inicio del partido.",
        icon: "🎯",
        tone: "neutral",
        primaryCta: {
          label: opts.tienePlaceholder
            ? "Confirmar mi combinada"
            : `Inscribir por ${opts.entradaLukas} 🪙`,
          kind: "submit",
        },
        secondaryCta: null,
      };
  }
}

/**
 * Mapea un error del backend / red al `ComboModalStatus` correspondiente.
 * El backend devuelve códigos como "TORNEO_CERRADO", "BALANCE_INSUFICIENTE",
 * etc. Este mapper es consumido por el ComboModal tras un POST /tickets
 * fallido.
 */
export function statusFromBackendError(
  errorCode: string | undefined,
): ComboModalStatus {
  if (!errorCode) return "error";
  if (errorCode === "BALANCE_INSUFICIENTE") return "insufficient-balance";
  if (errorCode === "TORNEO_CERRADO" || errorCode === "TORNEO_NO_ENCONTRADO") {
    return "tournament-closed";
  }
  return "error";
}
