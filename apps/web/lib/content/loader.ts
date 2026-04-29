// Utilidades compartidas por los loaders editoriales — Lote 8.
//
// Cada loader (articles.ts, casas.ts, etc.) usa estas helpers para:
//   - leer un .mdx del filesystem,
//   - parsear su frontmatter con gray-matter,
//   - validar contra un schema de Zod,
//   - extraer headings h2/h3 para el TOC.
//
// Cache: cada loader mantiene un Map<slug, LoadedDoc> in-memory por
// proceso. Restart de Railway → cache fría. Para invalidar antes de un
// restart no hay endpoint — la cache se construye al primer GET y vive
// hasta que el proceso muera. Suficiente para Lote 14 donde se publican
// piezas con frecuencia baja (días, no minutos).

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import type { ZodTypeAny, infer as Zinfer } from "zod";
import type { BaseFrontmatter, LoadedDoc } from "./types";

/**
 * Slugify para anchors de headings. Misma lógica que MarkdownContent.tsx
 * (legal docs) — kebab-case sin acentos ni caracteres especiales.
 */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Extrae los headings h2/h3 del cuerpo MDX, ignorando bloques fenced de
 * código. Devuelve `{ id, text, level }` ordenados por aparición.
 *
 * Limitación conocida: no parsea h2/h3 hechos con `<h2>...</h2>` JSX en
 * el MDX. Recomendamos usar `## Texto` markdown en los artículos para
 * que TOC los recoja.
 */
export function extractHeadings(
  body: string,
): Array<{ id: string; text: string; level: 2 | 3 }> {
  const lines = body.split("\n");
  const out: Array<{ id: string; text: string; level: 2 | 3 }> = [];
  let inFence = false;
  for (const line of lines) {
    if (line.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m2 = line.match(/^##\s+(.+?)\s*$/);
    if (m2) {
      const text = m2[1];
      out.push({ id: slugifyHeading(text), text, level: 2 });
      continue;
    }
    const m3 = line.match(/^###\s+(.+?)\s*$/);
    if (m3) {
      const text = m3[1];
      out.push({ id: slugifyHeading(text), text, level: 3 });
    }
  }
  return out;
}

/**
 * Lee un .mdx, parsea frontmatter, valida con Zod, y devuelve
 * `LoadedDoc | null` si el frontmatter es inválido (con log warning).
 *
 * `dir` debe ser absoluto (la convención del repo es resolver desde
 * `process.cwd()` que en Next App Router apunta a `apps/web`).
 */
export function loadMdx<S extends ZodTypeAny>(
  dir: string,
  filename: string,
  schema: S,
  source: string,
): LoadedDoc<Zinfer<S> & BaseFrontmatter> | null {
  const path = join(dir, filename);
  if (!existsSync(path)) return null;

  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch {
    return null;
  }

  const parsed = matter(raw);
  const result = schema.safeParse(parsed.data);
  if (!result.success) {
    // Lazy import para evitar el ciclo content → logs → @habla/db en boot.
    void import("../services/logs.service")
      .then((mod) =>
        mod.registrarError({
          level: "warn",
          source,
          message: `frontmatter inválido en ${filename}`,
          metadata: {
            filename,
            issues: result.error.issues.map((i) => ({
              path: i.path.join("."),
              message: i.message,
            })),
          },
        }),
      )
      .catch(() => {
        /* swallow — logs.service ya hace su propio fallback */
      });
    return null;
  }

  return {
    frontmatter: result.data as Zinfer<S> & BaseFrontmatter,
    body: parsed.content,
    headings: extractHeadings(parsed.content),
  };
}

/**
 * Lista los `.mdx` en un directorio (excluye `_meta.ts` y otros no-MDX).
 * Devuelve filenames, no paths absolutos.
 */
export function listMdxFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(
    (f) => f.endsWith(".mdx") && !f.startsWith("_"),
  );
}

/** Path absoluto del directorio de contenido raíz. */
export function contentDir(sub: string): string {
  return join(process.cwd(), "content", sub);
}
