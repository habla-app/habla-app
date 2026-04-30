# Blog listing `/blog`

Listing público de artículos editoriales. Crítico para SEO orgánico (atrae tráfico desde buscadores con contenido útil sobre fútbol y apuestas).

## Lote responsable

**Lote B** — Reauditoría móvil de la capa pública.

## Estado actual del repo

- `apps/web/app/(public)/blog/page.tsx` (Lote 8): listing paginado 12 por página con `?page=N`. Server-rendered con ISR (revalidate del layout, 1h).
- Datos: `articles.getAll()` que carga MDX desde `apps/web/content/blog/*.mdx`, ordenado por `publishedAt DESC`.
- Sin filtros ni búsqueda actualmente.

## Cambios necesarios

Refinamiento visual mobile-first + agregado de filtro por tag y buscador.

### Archivos a modificar

- `apps/web/app/(public)/blog/page.tsx`:
  - Mantener paginación.
  - Agregar lectura de `searchParams.tag` y `searchParams.q` para filtrado.
  - Si filtros activos: aplicar antes de paginar.
  - Mantener metadata existente.

- `apps/web/components/home/ArticleCard.tsx`:
  - Refactor visual mobile-first.
  - Agregar prop `variant: 'compact' | 'expanded'`.
  - En blog listing usar `expanded` (incluye excerpt).
  - En home usar `compact` (solo title + meta).

### Archivos a crear

- `apps/web/components/blog/BlogFilters.tsx`:
  - Chips horizontales con scroll-x mostrando los tags más usados (top 8 + chip "Todos").
  - Estado en URL param `?tag=...`.
  - Linkea con `<Link>` para preservar SSR del listing filtrado.

- `apps/web/components/blog/BlogSearchBar.tsx`:
  - Input de búsqueda con debounce 300ms.
  - Estado en URL param `?q=...`.
  - Filtrado client-side sobre title/excerpt (server-side seria over-engineering para tan pocos artículos).

- `apps/web/lib/content/articles.ts`:
  - Si no existe ya: agregar función `getAllTags()` que recorre los MDX y devuelve tags únicos ordenados por frecuencia.
  - Agregar función `filter({ tag, q, page, pageSize })` que combina filtros.

### Archivos a eliminar

Ninguno.

## Datos requeridos

```typescript
// apps/web/app/(public)/blog/page.tsx
export const revalidate = 3600;

interface Props {
  searchParams?: { page?: string; tag?: string; q?: string };
}

export default function BlogIndexPage({ searchParams }: Props) {
  const tag = searchParams?.tag;
  const query = searchParams?.q;
  const page = Math.max(1, Number.parseInt(searchParams?.page ?? '1', 10));

  const filtered = articles.filter({ tag, q: query });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  if (page > totalPages) redirect('/blog');

  const slice = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const allTags = articles.getAllTags().slice(0, 8);

  return (
    <BlogListing
      articles={slice}
      tags={allTags}
      currentTag={tag}
      currentQuery={query}
      page={page}
      totalPages={totalPages}
    />
  );
}
```

## Estados de UI

### Estructura

```
┌──────────────────────────────────┐
│ <MobileHeader variant="public">  │
├──────────────────────────────────┤
│ Page hero compact                │
│   - "Blog · Análisis y Picks"    │
│   - Sub: descripción             │
├──────────────────────────────────┤
│ <BlogSearchBar>                  │
├──────────────────────────────────┤
│ <BlogFilters> (chips de tags)    │
├──────────────────────────────────┤
│ Listado de artículos             │
│   - <ArticleCard expanded> x12   │
├──────────────────────────────────┤
│ Paginación numérica              │
├──────────────────────────────────┤
│ <NewsletterCTA fuente="blog">    │
├──────────────────────────────────┤
│ <Footer>                         │
├──────────────────────────────────┤
│ <BottomNav>                      │
└──────────────────────────────────┘
```

### Empty / Loading

- Si filtros producen 0 resultados: "Ningún artículo coincide. [Limpiar filtros]".
- Sin loading global (server-rendered).

### Estados según usuario

| Estado | Diferencia |
|---|---|
| Anónimo | Newsletter CTA prominente al pie |
| Free / FTD / Premium | Sin newsletter CTA (ya está suscrito por default desde registro) |

## Componentes que reutiliza

- `<MobileHeader>` (Lote A).
- `<BottomNav>` (Lote A).
- `<HorizontalScrollChips>` (Lote 9 / refactor Lote A) para el filtro de tags.
- `<ArticleCard>` (Lote 11, refactor con prop `variant`).
- `<NewsletterCTA>` (Lote 10).
- `<Footer>` (Lote 11).

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- Mobile-first.
- ISR `revalidate=3600` heredado del layout.
- 12 artículos por página.
- Touch targets ≥44px en chips, paginación y cards.
- Eventos analíticos: `articulo_visto` se dispara en mount de `/blog/[slug]` (ya existe Lote 8). En el listing no se dispara.

## Mockup de referencia

Sin mockup individual. Estructura basada en `home.html` (sección "Últimos análisis") + chips horizontales (`cuotas.html`).

## Pasos manuales para Gustavo post-deploy

Ninguno.

**Validación:**
1. Abrir `hablaplay.com/blog`.
2. Verificar paginación (`?page=2`, `?page=3`).
3. Probar buscador.
4. Probar filtros de tags.
5. Click en un artículo → navega a `/blog/[slug]`.

---

*Versión 1 · Abril 2026 · Blog listing para Lote B*
