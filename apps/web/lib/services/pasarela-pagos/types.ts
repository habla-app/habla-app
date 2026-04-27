// Contrato de la pasarela. Implementado por CulqiAdapter (real) y
// MockPasarelaPagos (modo preview).

import type { PackLukasId } from "../../constants/packs-lukas";

export interface CrearCargoInput {
  /** Monto en soles (entero, 1 Luka = S/1). */
  monto: number;
  descripcion: string;
  metadata: {
    usuarioId: string;
    packId: PackLukasId;
  };
}

export interface CrearCargoResult {
  /** ID del cargo en la pasarela (Culqi: chr_xxx). */
  cargoId: string;
  /** Estado simbólico ("pending", "captured"). El acreditado real ocurre vía webhook. */
  estado: "pending" | "captured" | "failed";
}

export interface ConsultarCargoResult {
  cargoId: string;
  estado: "pending" | "captured" | "failed";
  monto: number;
  metadata: Record<string, string>;
}

export interface ReembolsarInput {
  cargoId: string;
  monto?: number; // si se omite, full refund
  motivo: string;
}

export interface ReembolsarResult {
  reembolsoId: string;
  estado: "ok" | "failed";
}

export interface WebhookPayload {
  /** ID único del evento (idempotencia). */
  eventId: string;
  tipo: string;
  data: {
    cargoId: string;
    monto: number;
    metadata?: Record<string, string>;
  };
}

export interface PasarelaPagos {
  crearCargo(input: CrearCargoInput): Promise<CrearCargoResult>;
  /**
   * Verifica HMAC del webhook con `CULQI_WEBHOOK_SECRET`. El mock siempre
   * devuelve true (ya que el cuerpo lo firma él mismo).
   */
  verificarWebhook(rawBody: string, signature: string | null): boolean;
  consultarCargo(cargoId: string): Promise<ConsultarCargoResult>;
  reembolsar(input: ReembolsarInput): Promise<ReembolsarResult>;
}
