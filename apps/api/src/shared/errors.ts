// Clases de error tipadas para la API
// Nunca usar throw new Error('string') — siempre clases tipadas

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, "NOT_FOUND", `${resource} no encontrado`);
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "No autorizado") {
    super(401, "UNAUTHORIZED", message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Acceso denegado") {
    super(403, "FORBIDDEN", message);
    this.name = "ForbiddenError";
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(400, "BAD_REQUEST", message);
    this.name = "BadRequestError";
  }
}

export class InsufficientLukasError extends AppError {
  constructor() {
    super(400, "INSUFFICIENT_LUKAS", "Balance de Lukas insuficiente");
    this.name = "InsufficientLukasError";
  }
}

export class TorneoCerradoError extends AppError {
  constructor() {
    super(400, "TORNEO_CERRADO", "El torneo ya esta cerrado para inscripciones");
    this.name = "TorneoCerradoError";
  }
}

export class MaxTicketsError extends AppError {
  constructor(max: number) {
    super(400, "MAX_TICKETS", `Maximo ${max} tickets por torneo`);
    this.name = "MaxTicketsError";
  }
}

export class TicketDuplicadoError extends AppError {
  constructor() {
    super(400, "TICKET_DUPLICADO", "Ya tienes un ticket con estas mismas predicciones");
    this.name = "TicketDuplicadoError";
  }
}
