// Utilidades de formateo para Lukas

/**
 * Formatea centavos de Lukas a formato legible
 * Ejemplo: 1500 -> "15.00 Lukas"
 */
export function formatLukas(centavos: number): string {
  const lukas = centavos / 100;
  return `${lukas.toFixed(2)} Lukas`;
}

/**
 * Formatea centavos de Lukas a soles peruanos (paridad 1:1)
 * Ejemplo: 1500 -> "S/ 15.00"
 */
export function formatSoles(centavos: number): string {
  const soles = centavos / 100;
  return `S/ ${soles.toFixed(2)}`;
}
