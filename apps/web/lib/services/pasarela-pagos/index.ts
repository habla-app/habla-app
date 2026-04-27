// Pasarela de pagos — interface + selector de adaptador (Lote 8).
//
// El selector decide entre Culqi real y mock según `pagosHabilitados()`.
// El resto del código solo consume `getPasarelaPagos()` y nunca hace
// `if (process.env.PAGOS_HABILITADOS === "true")` — ese guard vive aquí.

import { pagosHabilitados } from "../../feature-flags";
import { CulqiAdapter } from "./culqi-adapter";
import { MockPasarelaPagos } from "./mock-adapter";
import type { PasarelaPagos } from "./types";

let cached: PasarelaPagos | null = null;

export function getPasarelaPagos(): PasarelaPagos {
  if (cached) return cached;
  cached = pagosHabilitados() ? new CulqiAdapter() : new MockPasarelaPagos();
  return cached;
}

/** Solo para tests: resetea el cache para que el siguiente get reevalúe el flag. */
export function _resetPasarelaCache(): void {
  cached = null;
}

export type { PasarelaPagos } from "./types";
export type {
  CrearCargoInput,
  CrearCargoResult,
  ConsultarCargoResult,
  ReembolsarInput,
  ReembolsarResult,
  WebhookPayload,
} from "./types";
