// Constantes económicas del juego — fuente única de verdad.
//
// Todas las reglas numéricas que el Plan de Negocios v6 establece como
// configurables centralizadas vivenacá. Antes estaban dispersas entre
// signup/route.ts, auth-adapter.ts, torneos.service.ts, limites.service.ts
// y la config de ligas. Lote 4 (Abr 2026) las concentró.
//
// Reglas que NO viven acá (y por qué):
//   - Distribución de premios: lógica pura en `lib/utils/premios-distribucion.ts`.
//   - Rake 12%: vive en `torneos.service.ts:RAKE_PCT` porque está acoplado
//     al `DISTRIB_PREMIOS_DESCRIPTOR` que se serializa por torneo.
//   - Límites de auto-exclusión (7/30/90): viven en `limites.service.ts`
//     como `AUTOEXCLUSION_DIAS_VALIDOS` por su uso ya consolidado.

/** Bonus de bienvenida acreditado al usuario nuevo (BONUS, sin vencimiento). */
export const BONUS_BIENVENIDA_LUKAS = 15;

/** Meses desde la compra hasta el vencimiento de Lukas Adquiridos. */
export const MESES_VENCIMIENTO_COMPRA = 36;

/** Entrada única para todos los torneos, independientemente del tipo. */
export const ENTRADA_LUKAS = 3;

/** Default del límite mensual de compra de Lukas (en S/, 1:1 con Lukas). */
export const LIMITE_MENSUAL_DEFAULT = 300;

/** Tope superior configurable por el usuario en /perfil. */
export const LIMITE_MENSUAL_MAX = 1000;

/** Default del límite diario de tickets enviados por usuario. */
export const LIMITE_DIARIO_TICKETS_DEFAULT = 10;
