// Zod schemas para validar el frontmatter de cada tipo de contenido — Lote 8.
//
// Si un .mdx llega con frontmatter inválido, el loader lo skipea de los
// listings y loggea un warning vía `logsService.registrarError` (queda
// visible en /admin/logs del Lote 6). Una page individual que apunte a
// ese slug responde 404. La idea: errores de contenido NO rompen el
// build ni la home — sólo se registran y el slug "no existe".

import { z } from "zod";

// ISO 8601 fecha (yyyy-mm-dd). Aceptamos también con tiempo, lo recortamos.
const dateLikeSchema = z.string().refine((s) => !Number.isNaN(Date.parse(s)), {
  message: "fecha inválida (esperado yyyy-mm-dd)",
});

const baseSchema = z.object({
  title: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug debe ser kebab-case"),
  excerpt: z.string().min(1).max(500),
  publishedAt: dateLikeSchema,
  updatedAt: dateLikeSchema,
  author: z.string().min(1),
  tags: z.array(z.string()).default([]),
  ogImage: z.string().optional(),
});

export const articleFrontmatterSchema = baseSchema.extend({
  categoria: z.string().optional(),
});

export const casaFrontmatterSchema = baseSchema.extend({
  afiliadoSlug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "afiliadoSlug debe ser kebab-case"),
});

export const guiaFrontmatterSchema = baseSchema.extend({
  tipo: z.enum(["howto"]).optional(),
});

export const pronosticoFrontmatterSchema = baseSchema.extend({
  liga: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "liga debe ser kebab-case"),
});

export const partidoFrontmatterSchema = baseSchema.extend({
  partidoSlug: z.string().min(1),
  partidoId: z.string().optional(),
});
