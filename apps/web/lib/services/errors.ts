// Clases de error tipadas para la capa de servicios. Cada error lleva un
// `code` (string estable que el frontend puede usar para switchear copy) y
// un `status` HTTP sugerido. Los route handlers mapean DomainError → status
// correspondiente; cualquier otro Error → 500.
//
// REGLA (CLAUDE.md §14): nunca `throw new Error('string')`. Usar uno de
// estos tipos o agregar uno nuevo aquí.

export class DomainError extends Error {
  readonly code: string;
  readonly status: number;
  readonly meta?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    status: number,
    meta?: Record<string, unknown>,
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.meta = meta;
    this.name = "DomainError";
  }
}

export class TorneoNoEncontrado extends DomainError {
  constructor(torneoId: string) {
    super(
      "TORNEO_NO_ENCONTRADO",
      `No existe el torneo ${torneoId}.`,
      404,
      { torneoId },
    );
  }
}

export class PartidoNoEncontrado extends DomainError {
  constructor(partidoId: string) {
    super(
      "PARTIDO_NO_ENCONTRADO",
      `No existe el partido ${partidoId}.`,
      404,
      { partidoId },
    );
  }
}

export class TorneoCerrado extends DomainError {
  constructor(torneoId: string) {
    super(
      "TORNEO_CERRADO",
      "Las inscripciones a este torneo ya cerraron.",
      409,
      { torneoId },
    );
  }
}

export class BalanceInsuficiente extends DomainError {
  constructor(balance: number, necesario: number) {
    super(
      "BALANCE_INSUFICIENTE",
      `Necesitas ${necesario} Lukas, tienes ${balance}.`,
      402, /* Payment Required — semánticamente "no alcanzas" */
      { balance, necesario },
    );
  }
}

export class LimiteExcedido extends DomainError {
  constructor(mensaje: string, meta?: Record<string, unknown>) {
    super("LIMITE_EXCEDIDO", mensaje, 409, meta);
  }
}

export class YaInscrito extends DomainError {
  constructor(torneoId: string) {
    super(
      "YA_INSCRITO",
      "Ya estás inscrito en este torneo.",
      409,
      { torneoId },
    );
  }
}

export class NoAutenticado extends DomainError {
  constructor() {
    super("NO_AUTENTICADO", "Debes iniciar sesión para continuar.", 401);
  }
}

export class NoAutorizado extends DomainError {
  constructor(mensaje = "No tienes permiso para esta acción.") {
    super("NO_AUTORIZADO", mensaje, 403);
  }
}

export class ValidacionFallida extends DomainError {
  constructor(mensaje: string, meta?: Record<string, unknown>) {
    super("VALIDACION_FALLIDA", mensaje, 400, meta);
  }
}

export class ApiFootballError extends DomainError {
  constructor(mensaje: string, meta?: Record<string, unknown>) {
    super("API_FOOTBALL_ERROR", mensaje, 502, meta);
  }
}

// -----------------------------------------------------------------------
// Helper para route handlers: convierte cualquier error a respuesta JSON
// con shape { error: { code, message, meta? } } y status code correcto.
// -----------------------------------------------------------------------

export function toErrorResponse(err: unknown): Response {
  if (err instanceof DomainError) {
    return Response.json(
      {
        error: {
          code: err.code,
          message: err.message,
          meta: err.meta,
        },
      },
      { status: err.status },
    );
  }
  // Error desconocido — lo tratamos como 500 sin filtrar detalles internos.
  return Response.json(
    {
      error: {
        code: "INTERNAL",
        message: "Ocurrió un error interno. Intenta de nuevo más tarde.",
      },
    },
    { status: 500 },
  );
}
