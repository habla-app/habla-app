// Mock de la pasarela para modo PREVIEW (flag OFF) y para tests.
//
// `crearCargo` simula éxito 100% y emite por su cuenta el webhook al
// endpoint local. Esto permite probar el flujo end-to-end (cargo →
// webhook → acreditación de Lukas + asiento contable) sin Culqi real.

import { createHmac } from "crypto";
import type {
  CrearCargoInput,
  CrearCargoResult,
  ConsultarCargoResult,
  PasarelaPagos,
  ReembolsarInput,
  ReembolsarResult,
  WebhookPayload,
} from "./types";
import { logger } from "../logger";

function nanoid(n = 12): string {
  const buf = new Uint8Array(n);
  globalThis.crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export class MockPasarelaPagos implements PasarelaPagos {
  async crearCargo(input: CrearCargoInput): Promise<CrearCargoResult> {
    const cargoId = `mock_chr_${nanoid(8)}`;
    const eventId = `mock_evt_${nanoid(8)}`;

    logger.info(
      { cargoId, monto: input.monto, ...input.metadata },
      "MockPasarelaPagos: cargo simulado",
    );

    // Disparamos el webhook al server local. NEXT_PUBLIC_APP_URL es
    // usable también server-side (no es runtime-restricted) y nos evita
    // hardcodear puertos.
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const payload: WebhookPayload = {
      eventId,
      tipo: "charge.creation.succeeded",
      data: {
        cargoId,
        monto: input.monto,
        metadata: input.metadata as unknown as Record<string, string>,
      },
    };
    const rawBody = JSON.stringify(payload);
    const secret = process.env.CULQI_WEBHOOK_SECRET ?? "mock-secret";
    const signature = createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    // Fire-and-forget — el endpoint del webhook hace la acreditación.
    void fetch(`${baseUrl}/api/v1/webhooks/culqi`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "culqi-signature": signature,
      },
      body: rawBody,
    }).catch((err) => {
      logger.error({ err }, "MockPasarelaPagos: webhook fire-and-forget falló");
    });

    return { cargoId, estado: "captured" };
  }

  verificarWebhook(rawBody: string, signature: string | null): boolean {
    // Mismo HMAC que el adaptador real — el mock firma con el mismo secret.
    if (!signature) return false;
    const secret = process.env.CULQI_WEBHOOK_SECRET ?? "mock-secret";
    const expected = createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");
    return expected === signature;
  }

  async consultarCargo(cargoId: string): Promise<ConsultarCargoResult> {
    return {
      cargoId,
      estado: "captured",
      monto: 0,
      metadata: {},
    };
  }

  async reembolsar(input: ReembolsarInput): Promise<ReembolsarResult> {
    return {
      reembolsoId: `mock_ref_${nanoid(8)}`,
      estado: "ok",
    };
  }
}
