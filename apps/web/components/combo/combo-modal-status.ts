// Status discriminado del ComboModal.
//
// Lote 2 (Abr 2026): se demolió el sistema de Lukas — el estado
// `insufficient-balance` desapareció y el copy del status `success` cambió
// a "Tu predicción está lista. ¡Sigue el ranking!" según el plan del lote.

export type ComboModalStatus =
  | "idle"
  | "submitting"
  | "success"
  | "tournament-closed"
  | "error";

/** Datos del ticket recién creado que se muestran en el panel de éxito. */
export interface ComboSuccessInfo {
  ticketId: string;
  /** Premio máximo teórico (21 si el usuario completó las 5 predicciones). */
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
  reemplazoPlaceholder: boolean;
}

export interface ComboModalUIState {
  bodyTitle: string;
  bodyCopy: string;
  icon: string;
  tone: "success" | "error" | "warning" | "neutral";
  primaryCta: {
    label: string;
    kind: "link" | "retry" | "close" | "submit" | "reset";
    href?: string;
  } | null;
  secondaryCta: {
    label: string;
    kind: "link" | "retry" | "close" | "submit" | "reset";
    href?: string;
  } | null;
}

interface ComputeUIStateOpts {
  status: ComboModalStatus;
  tienePlaceholder: boolean;
  errorMessage?: string | null;
}

export function computeComboModalUIState(
  opts: ComputeUIStateOpts,
): ComboModalUIState {
  switch (opts.status) {
    case "submitting":
      return {
        bodyTitle: "Enviando tu predicción...",
        bodyCopy: "Un momento, estamos sellando tu combinada.",
        icon: "⏳",
        tone: "neutral",
        primaryCta: null,
        secondaryCta: null,
      };

    case "success":
      return {
        bodyTitle: "Tu predicción está lista",
        bodyCopy: "¡Sigue el ranking!",
        icon: "🎉",
        tone: "success",
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
        primaryCta: { label: "Reintentar", kind: "retry" },
        secondaryCta: { label: "Cerrar", kind: "close" },
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
            : "Predecir gratis",
          kind: "submit",
        },
        secondaryCta: null,
      };
  }
}

/**
 * Mapea un error del backend / red al `ComboModalStatus` correspondiente.
 */
export function statusFromBackendError(
  errorCode: string | undefined,
): ComboModalStatus {
  if (!errorCode) return "error";
  if (errorCode === "TORNEO_CERRADO" || errorCode === "TORNEO_NO_ENCONTRADO") {
    return "tournament-closed";
  }
  return "error";
}
