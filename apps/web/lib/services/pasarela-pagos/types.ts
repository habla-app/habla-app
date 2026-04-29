// Esqueleto neutral de pasarela de pagos.
//
// Lote 4 (Abr 2026): se eliminó la integración Culqi entera (decisión de
// migrar a OpenPay BBVA por costo). El adapter real OpenPay se construye
// desde cero en Lote 12. Este contrato queda como punto de extensión:
// dos métodos cubren ambos flujos previstos (cobro único de un curso,
// suscripción mensual de Premium).
//
// `metadata` queda como map abierto — el caller del flujo nuevo (Premium /
// Cursos) define qué guarda ahí.

export interface CrearCobroUnicoInput {
  /** Monto en soles (entero). */
  monto: number;
  descripcion: string;
  metadata: Record<string, string>;
}

export interface CrearCobroUnicoResult {
  /** ID del cobro en la pasarela. */
  cobroId: string;
  /** Estado simbólico. La acreditación real ocurre vía webhook. */
  estado: "pending" | "captured" | "failed";
}

export interface CrearSuscripcionInput {
  /** ID del plan en la pasarela. */
  plan: string;
  /** Usuario al que se le cobra. */
  usuarioId: string;
}

export interface CrearSuscripcionResult {
  /** ID de la suscripción en la pasarela. */
  suscripcionId: string;
  estado: "activa" | "pendiente" | "fallida";
}

export interface PasarelaPagos {
  crearCobroUnico(input: CrearCobroUnicoInput): Promise<CrearCobroUnicoResult>;
  crearSuscripcion(input: CrearSuscripcionInput): Promise<CrearSuscripcionResult>;
}
