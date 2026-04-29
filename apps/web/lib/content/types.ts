// Tipos base compartidos por los loaders editoriales — Lote 8 (May 2026).
//
// Cada tipo de contenido (blog, casas, guias, pronosticos, partidos)
// extiende `BaseFrontmatter` con los campos propios del tipo.

export interface BaseFrontmatter {
  title: string;
  slug: string;
  excerpt: string;
  publishedAt: string; // ISO 8601 yyyy-mm-dd
  updatedAt: string; // ISO 8601 yyyy-mm-dd
  author: string;
  tags: string[];
  ogImage?: string;
}

export interface ArticleFrontmatter extends BaseFrontmatter {
  /** Categoría editorial. Default "blog". */
  categoria?: string;
}

export interface CasaFrontmatter extends BaseFrontmatter {
  /** Slug del afiliado en BD. La review sólo se publica si el afiliado
   *  existe — `getActivas()` además filtra por `activo` y `autorizadoMincetur`. */
  afiliadoSlug: string;
}

export interface GuiaFrontmatter extends BaseFrontmatter {
  /** Si está marcado "howto", la page emite un schema.org/HowTo además del Article. */
  tipo?: "howto";
}

export interface PronosticoFrontmatter extends BaseFrontmatter {
  liga: string; // slug de la liga (ej. "liga-1-peru")
}

export interface PartidoFrontmatter extends BaseFrontmatter {
  /** Slug del partido. Convención: equipo1-vs-equipo2-yyyy-mm-dd. */
  partidoSlug: string;
  /** Id del partido en BD si está cruzado con la tabla `Partido` (Lote 0).
   *  Opcional — un MDX puede precederse a la fila en BD. */
  partidoId?: string;
}

/** Forma cargada: el frontmatter ya validado + el cuerpo MDX crudo
 *  (sin frontmatter). Las pages pasan `body` a `<MDXRemote source={body}>`. */
export interface LoadedDoc<F extends BaseFrontmatter> {
  frontmatter: F;
  body: string;
  /** Headings h2/h3 extraídos del cuerpo, para renderizar TOC sin tocar
   *  el DOM. Cada heading lleva un id slugificado que matchea el id que
   *  el componente h2/h3 del provider MDX inyecta al render. */
  headings: Array<{ id: string; text: string; level: 2 | 3 }>;
}
