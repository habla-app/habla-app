// Feature flags.
//
// Lote 4 (Abr 2026): se eliminó el flag `pagosHabilitados()` (gobernaba
// Culqi + sistema contable, ambos demolidos). Quedan dos flags
// independientes para las capas que vendrán detrás de paywall:
//   - `premiumHabilitado()` — capa Premium (Lote 11+).
//   - `cursosHabilitado()`  — capa Cursos (Lote 12+).
//
// Ambos defaultean a `false`. La integración OpenPay (BBVA) que va a
// alimentar los cobros se construye en Lote 12 — recién ahí se agregan
// boot guards de `OPENPAY_*` creds.

export function premiumHabilitado(): boolean {
  return process.env.PREMIUM_HABILITADO === "true";
}

export function cursosHabilitado(): boolean {
  return process.env.CURSOS_HABILITADO === "true";
}
