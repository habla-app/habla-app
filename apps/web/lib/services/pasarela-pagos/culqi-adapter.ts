// Adaptador real de Culqi — fetch directo a api.culqi.com (sin SDK), igual
// patrón que email.service y twilio (CLAUDE.md §13).
//
// Activado solo cuando `pagosHabilitados()` devuelve true (flag ON + las 3
// creds configuradas). El boot guard de `feature-flags.ts` ya forzó false
// si faltan creds, así que aquí asumimos que están todas presentes.

import { createHmac, timingSafeEqual } from "crypto";
import type {
  CrearCargoInput,
  CrearCargoResult,
  ConsultarCargoResult,
  PasarelaPagos,
  ReembolsarInput,
  ReembolsarResult,
} from "./types";
import { logger } from "../logger";

const CULQI_BASE = "https://api.culqi.com/v2";

export class CulqiAdapter implements PasarelaPagos {
  private secretKey(): string {
    const k = process.env.CULQI_SECRET_KEY;
    if (!k) throw new Error("CULQI_SECRET_KEY no configurado");
    return k;
  }

  async crearCargo(input: CrearCargoInput): Promise<CrearCargoResult> {
    const res = await fetch(`${CULQI_BASE}/charges`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: input.monto * 100, // Culqi trabaja en céntimos
        currency_code: "PEN",
        description: input.descripcion,
        email: `${input.metadata.usuarioId}@hablaplay.com`,
        metadata: input.metadata,
      }),
    });
    const json = (await res.json()) as {
      id?: string;
      object?: string;
      outcome?: { type?: string };
      user_message?: string;
    };
    if (!res.ok || !json.id) {
      logger.error({ status: res.status, json }, "Culqi crearCargo: error");
      throw new Error(`Culqi crearCargo falló: ${json.user_message ?? res.status}`);
    }
    return {
      cargoId: json.id,
      estado: json.outcome?.type === "venta_exitosa" ? "captured" : "pending",
    };
  }

  verificarWebhook(rawBody: string, signature: string | null): boolean {
    if (!signature) return false;
    const secret = process.env.CULQI_WEBHOOK_SECRET;
    if (!secret) return false;
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    try {
      const a = Buffer.from(expected, "utf8");
      const b = Buffer.from(signature, "utf8");
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  async consultarCargo(cargoId: string): Promise<ConsultarCargoResult> {
    const res = await fetch(`${CULQI_BASE}/charges/${cargoId}`, {
      headers: { Authorization: `Bearer ${this.secretKey()}` },
    });
    const json = (await res.json()) as {
      id?: string;
      amount?: number;
      outcome?: { type?: string };
      metadata?: Record<string, string>;
    };
    if (!res.ok || !json.id) {
      throw new Error(`Culqi consultarCargo ${cargoId} falló`);
    }
    return {
      cargoId: json.id,
      estado: json.outcome?.type === "venta_exitosa" ? "captured" : "pending",
      monto: (json.amount ?? 0) / 100,
      metadata: json.metadata ?? {},
    };
  }

  async reembolsar(input: ReembolsarInput): Promise<ReembolsarResult> {
    const res = await fetch(`${CULQI_BASE}/refunds`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        charge_id: input.cargoId,
        amount: input.monto ? input.monto * 100 : undefined,
        reason: input.motivo,
      }),
    });
    const json = (await res.json()) as { id?: string; user_message?: string };
    if (!res.ok || !json.id) {
      logger.error({ status: res.status, json }, "Culqi reembolsar: error");
      return { reembolsoId: "", estado: "failed" };
    }
    return { reembolsoId: json.id, estado: "ok" };
  }
}
