// Distribución de premios en el FE — Hotfix #6: la curva real depende de
// totalInscritos. Para el "1er premio estimado" del header del ComboModal
// usamos un proxy simple (45% del pozo neto estimado) — si el torneo tiene
// <10 inscritos, share[0] puede ser hasta 100% (M=1), pero para el MVP
// aceptamos el approx de 45% porque mostramos "hasta" — el valor exacto
// aparece en /live-match una vez que hay ranking.

/** Porcentaje del pozo neto que se lleva el 1° con la nueva curva
 *  top-heavy (Hotfix #6). Es un LOWER BOUND: en brackets chicos (M≤5)
 *  el 1° se lleva más (40-100%). */
export const PREMIO_PRIMER_LUGAR_PCT = 0.45;
