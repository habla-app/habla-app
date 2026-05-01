// Mock de la pasarela. Útil para tests de los services que dependen de
// `PasarelaPagos` sin tocar OpenPay real. El adapter real es OpenPayAdapter
// (Lote E, May 2026).

import type {
  CrearCobroUnicoInput,
  CrearCobroUnicoResult,
  CrearSuscripcionInput,
  CrearSuscripcionResult,
  PasarelaPagos,
} from "./types";

function nanoid(n = 12): string {
  const buf = new Uint8Array(n);
  globalThis.crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export class MockPasarelaPagos implements PasarelaPagos {
  async crearCobroUnico(
    _input: CrearCobroUnicoInput,
  ): Promise<CrearCobroUnicoResult> {
    return {
      cobroId: `mock_cob_${nanoid(8)}`,
      estado: "captured",
    };
  }

  async crearSuscripcion(
    _input: CrearSuscripcionInput,
  ): Promise<CrearSuscripcionResult> {
    const id = `mock_sub_${nanoid(8)}`;
    return {
      suscripcionId: id,
      customerId: `mock_cus_${nanoid(8)}`,
      estado: "activa",
    };
  }

  async cancelarSuscripcion(_suscripcionPasarelaId: string): Promise<void> {
    /* no-op */
  }

  async reembolsar(_cobroPasarelaId: string): Promise<void> {
    /* no-op */
  }

  verificarFirmaWebhook(_rawBody: string, _signature: string | null): boolean {
    return true;
  }
}
