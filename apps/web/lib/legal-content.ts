// legal-content.ts — lectura de los .md del catálogo legal y reemplazo de
// placeholders {{LEGAL_*}} con env vars en runtime.
//
// Convención: si una env var no está definida (caso típico: RUC todavía no
// tramitado, partida SUNARP pendiente), el placeholder {{...}} queda
// literal en el render. Esto es intencional — visibiliza datos faltantes
// en lugar de ocultarlos con valores inventados (CLAUDE.md §20).

import { readFileSync } from "node:fs";
import { join } from "node:path";

export type LegalSlug =
  | "terminos"
  | "privacidad"
  | "cookies"
  | "juego-responsable"
  | "canjes"
  | "aviso";

const SLUG_TO_FILE: Record<LegalSlug, string> = {
  terminos: "terminos-y-condiciones.md",
  privacidad: "politica-de-privacidad.md",
  cookies: "politica-de-cookies.md",
  "juego-responsable": "juego-responsable.md",
  canjes: "canjes-y-devoluciones.md",
  aviso: "aviso-legal.md",
};

export const LEGAL_SLUGS = Object.keys(SLUG_TO_FILE) as LegalSlug[];

interface LegalDocMeta {
  slug: LegalSlug;
  title: string;
  description: string;
}

export const LEGAL_DOCS: Record<LegalSlug, LegalDocMeta> = {
  terminos: {
    slug: "terminos",
    title: "Términos y Condiciones",
    description:
      "Términos y condiciones de uso de Habla! — torneos de habilidad, cuenta, Lukas, premios, reglas y obligaciones.",
  },
  privacidad: {
    slug: "privacidad",
    title: "Política de Privacidad",
    description:
      "Cómo Habla! recolecta, usa y protege tus datos personales conforme a la Ley 29733 del Perú.",
  },
  cookies: {
    slug: "cookies",
    title: "Política de Cookies",
    description:
      "Qué cookies utiliza Habla!, con qué finalidad y cómo gestionar tus preferencias.",
  },
  "juego-responsable": {
    slug: "juego-responsable",
    title: "Juego Responsable",
    description:
      "Compromiso, herramientas de control y recursos de apoyo para un uso sano de Habla!.",
  },
  canjes: {
    slug: "canjes",
    title: "Canjes y Devoluciones",
    description:
      "Cómo funcionan los canjes en la Tienda, qué reembolsos están previstos y cómo solicitarlos.",
  },
  aviso: {
    slug: "aviso",
    title: "Aviso Legal",
    description:
      "Aviso legal del sitio hablaplay.com — titularidad, propiedad intelectual y condiciones de uso.",
  },
};

/**
 * Lee un .md del catálogo legal y reemplaza los placeholders {{LEGAL_*}}
 * con env vars. Devuelve `null` si el slug no existe.
 *
 * Si una env var falta, el placeholder queda literal. La idea es que el
 * primer canje SUNARP / RUC los visibilice.
 */
export function loadLegalDoc(slug: string): string | null {
  if (!(slug in SLUG_TO_FILE)) return null;
  const filename = SLUG_TO_FILE[slug as LegalSlug];
  const path = join(process.cwd(), "content/legal", filename);
  const raw = readFileSync(path, "utf-8");
  return resolvePlaceholders(raw);
}

const PLACEHOLDER_KEYS = [
  "RAZON_SOCIAL",
  "RUC",
  "PARTIDA_REGISTRAL",
  "DOMICILIO_FISCAL",
  "DISTRITO",
  "TITULAR_NOMBRE",
  "TITULAR_DNI",
] as const;

export function resolvePlaceholders(raw: string): string {
  let out = raw;
  for (const key of PLACEHOLDER_KEYS) {
    const envName = `LEGAL_${key}`;
    const value = process.env[envName];
    if (value && value.trim().length > 0) {
      // Reemplazo global de la clave dentro de las llaves.
      const re = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      out = out.replace(re, value);
    }
  }
  return out;
}

/**
 * Extrae la línea final "*Versión 1.0 — Vigente desde: <fecha>*" del
 * contenido. Devuelve null si no aparece.
 */
export function extractVersion(md: string): string | null {
  const m = md.match(/\*Versión[^*]+\*/);
  return m ? m[0].replace(/\*/g, "").trim() : null;
}

/**
 * Extrae los headings ## de un documento markdown (ignora ###/####...).
 * Devuelve { id, text } — id es slug-kebab del texto, normalizado para
 * usarse como anchor.
 */
export function extractHeadings(
  md: string,
): Array<{ id: string; text: string }> {
  const lines = md.split("\n");
  const headings: Array<{ id: string; text: string }> = [];
  let inFence = false;
  for (const line of lines) {
    if (line.startsWith("```")) inFence = !inFence;
    if (inFence) continue;
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (!m) continue;
    const text = m[1];
    const id = text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
    headings.push({ id, text });
  }
  return headings;
}
