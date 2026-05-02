// Política del paywall por nivel — Lote K v3.2 (May 2026).
// Spec: docs/analisis-repo-vs-mockup-v3.2.md §1.1 + §1.5.
//
// Decisión cerrada: la política Free vs Socios se HARDCODEA acá, no se
// configura dinámicamente vía DB. La vista /admin/paywall (Lote P) es de
// MONITOREO y PREVIEW: muestra qué bloques ve un Free vs un Socio y la
// tasa de conversión por bloque bloqueado. Cero toggles dinámicos.
//
// Beneficios de hardcodear:
//   - Cero migración de BD para cambiar la política.
//   - La política se versiona en código (cambios trazables en git).
//   - Si en el futuro hace falta toggles dinámicos, agregamos una tabla
//     FeatureFlag (que ya existe) sin reescribir la implementación.
//
// Cómo se consume:
//   import { bloqueVisible } from "@/lib/config/paywall";
//   const { useAuthState } = ...;
//   const estado = useAuthState();          // 'visitor' | 'free' | 'socios'
//   if (bloqueVisible('combinadaOptima', estado)) {
//     return <CombinadaOptimaCard data={data} />;
//   }
//   return <BloqueBloqueadoTeaser bloque="combinadaOptima" />;
//
// Tabla del mockup v3.2 (verdad absoluta):
//
//   Bloque                                 | Visitor | Free | Socio
//   ---------------------------------------|---------|------|------
//   Pronóstico Habla! 1X2 + probabilidad   |   ✅    |  ✅  |  ✅
//   Mejor cuota Local + comparador         |   ✅    |  ✅  |  ✅
//   Análisis básico (forma, H2H, lesiones) |   ✅    |  ✅  |  ✅
//   Combinada óptima + stake + EV+         |   🔒    |  🔒  |  ✅
//   Razonamiento estadístico detallado     |   🔒    |  🔒  |  ✅
//   Análisis profundo de goles esperados   |   🔒    |  🔒  |  ✅
//   Análisis profundo de tarjetas          |   🔒    |  🔒  |  ✅
//   Mercados secundarios con value         |   🔒    |  🔒  |  ✅
//   Contenido complementario general       |   🔒    |  🔒  |  ✅

export const PAYWALL_CONFIG = {
  bloques: {
    pronostico1X2: { free: true, socios: true },
    mejorCuotaLocal: { free: true, socios: true },
    comparadorCuotas: { free: true, socios: true },
    analisisBasico: { free: true, socios: true },
    combinadaOptima: { free: false, socios: true },
    razonamientoDetallado: { free: false, socios: true },
    analisisProfundoGoles: { free: false, socios: true },
    analisisProfundoTarjetas: { free: false, socios: true },
    mercadosSecundarios: { free: false, socios: true },
    contenidoComplementarioGeneral: { free: false, socios: true },
  },
} as const;

export type BloquePaywall = keyof typeof PAYWALL_CONFIG.bloques;
export type EstadoAuth = "visitor" | "free" | "socios";

/**
 * Devuelve si un bloque del paywall es visible para un usuario en un estado
 * de auth dado. Visitor y Free comparten la versión "free" del paywall —
 * la diferencia entre ambos no es de contenido sino de CTAs (Visitor ve
 * "Registrate gratis"; Free ve "Hacete Socio").
 */
export function bloqueVisible(
  bloque: BloquePaywall,
  estado: EstadoAuth,
): boolean {
  const cfg = PAYWALL_CONFIG.bloques[bloque];
  if (estado === "socios") return cfg.socios;
  return cfg.free;
}

/**
 * Etiqueta legible del bloque — útil en /admin/paywall (Lote P) para
 * etiquetar filas de la tabla de monitoreo.
 */
export const BLOQUE_LABELS: Record<BloquePaywall, string> = {
  pronostico1X2: "Pronóstico 1X2 + probabilidad",
  mejorCuotaLocal: "Mejor cuota Local",
  comparadorCuotas: "Comparador de cuotas",
  analisisBasico: "Análisis básico (forma, H2H, lesiones)",
  combinadaOptima: "Combinada óptima + stake + EV+",
  razonamientoDetallado: "Razonamiento estadístico detallado",
  analisisProfundoGoles: "Análisis profundo de goles esperados",
  analisisProfundoTarjetas: "Análisis profundo de tarjetas",
  mercadosSecundarios: "Mercados secundarios con value",
  contenidoComplementarioGeneral: "Contenido complementario general",
};
