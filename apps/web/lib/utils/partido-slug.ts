// partido-slug.ts — Lote M v3.2 (May 2026).
// Spec: docs/plan-trabajo-claude-code-v3.2.md § Lote M.
//
// Helpers para construir y resolver slugs SEO-friendly de partidos en las
// rutas /las-fijas/[slug] y /liga/[slug]. El slug es derivado y no se
// persiste en BD — la resolución es por equipos + fecha (zona Lima) y
// cae en el partido más cercano si hay ambigüedad.
//
// Forma del slug:
//   "<local-slug>-vs-<visita-slug>-YYYY-MM-DD"
// Ejemplo:
//   "manchester-united-vs-liverpool-2026-05-08"

const FECHA_PATTERN = /-(\d{4}-\d{2}-\d{2})$/;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Construye un slug determinístico para un partido a partir de los nombres
 * de los equipos y la fecha de inicio. Usa zona horaria America/Lima para
 * que el slug sea consistente con la fecha que ve el usuario peruano.
 */
export function buildPartidoSlug(
  equipoLocal: string,
  equipoVisita: string,
  fechaInicio: Date,
): string {
  const fechaLima = fechaInicio.toLocaleDateString("en-CA", {
    timeZone: "America/Lima",
  }); // YYYY-MM-DD
  return `${slugify(equipoLocal)}-vs-${slugify(equipoVisita)}-${fechaLima}`;
}

/**
 * Extrae la fecha YYYY-MM-DD del final del slug. Devuelve null si el slug
 * no respeta el formato esperado (caller debe 404).
 */
export function fechaFromSlug(slug: string): string | null {
  const m = slug.match(FECHA_PATTERN);
  return m?.[1] ?? null;
}

/**
 * Convierte la fecha YYYY-MM-DD al rango UTC [00:00 PET, 23:59:59 PET]
 * que se usa para query a BD. Sin esto, una query naive con `>= fechaUTC`
 * pierde partidos que en zona Lima son del día pero en UTC son del día
 * anterior.
 */
export function diaLimaFromFecha(fecha: string): { gte: Date; lte: Date } {
  // PET es UTC-5 sin DST. 00:00 PET = 05:00 UTC del mismo día calendario.
  const gte = new Date(`${fecha}T05:00:00.000Z`);
  const lte = new Date(`${fecha}T28:59:59.999Z`); // 23:59:59 PET = 04:59 UTC del día siguiente
  // 28:59:59 no es válido — lo construimos así:
  const lteOk = new Date(gte.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { gte, lte: lteOk };
}
