// Mock de la pasarela. Sin callers actualmente — queda como referencia
// de la forma de la interfaz para tests futuros y para el adapter real
// OpenPay del Lote 12.

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
    return {
      suscripcionId: `mock_sub_${nanoid(8)}`,
      estado: "activa",
    };
  }
}
