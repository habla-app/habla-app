# Blog post `/blog/[slug]`

Artículo individual del blog. Vista crítica para SEO orgánico (cada artículo es una landing potencial para queries específicas) y para la conversión secundaria (newsletter, link a casas, link a partidos).

## Lote responsable

**Lote B** — Reauditoría móvil de la capa pública.

## Estado actual del repo

- `apps/web/app/(public)/blog/[slug]/page.tsx` (Lote 8): TOC sticky desktop + collapsable mobile + JSON-LD Article + OG dinámico per-route + dispatch de evento `articulo_visto` en mount + `<RelatedArticles>` server matcheando por tags.
- ISR `revalidate=3600`.
- Carga MDX desde `apps/web/content/blog/[slug].mdx` con frontmatter validado por Zod.

## Cambios necesarios

Refinamiento mobile-first y agregado de cross-links contextuales (a Producto B si el artículo menciona partido, a Premium si aplica).

### Archivos a modificar

- `apps/web/app/(public)/blog/[slug]/page.tsx`:
  - Mantener carga MDX, JSON-LD, OG existentes.
  - Si `frontmatter.partidoSlug` existe: cargar el partido + cuotas y embebir `<CrossLinkPartido>` al final del artículo (antes de `<RelatedArticles>`).
  - Si `frontmatter.partidoSlug` corresponde a un partido con pick Premium aprobado: embebir `<PickPremiumPromo>` también.

- `apps/web/components/mdx/TOC.tsx` (Lote 8):
  - Refactor mobile-first: en mobile usar `<details>` collapsable (default cerrado).
  - En desktop mantener sticky sidebar.
  - Touch target del summary ≥44px.

### Archivos a crear

- `apps/web/components/blog/BlogPostHero.tsx`:
  - Hero del artículo: cover image (o gradient fallback), categoria/tags, title, autor + fecha + tiempo de lectura estimado.
  - Layout mobile-first: stack vertical.

- `apps/web/components/blog/CrossLinkPartido.tsx`:
  - Card que aparece al pie del artículo si menciona un partido específico.
  - Layout: "📊 Lee este artículo? Ve el análisis completo y cuotas comparadas →".
  - Linkea a `/partidos/[slug]`.

- `apps/web/components/blog/PickPremiumPromo.tsx`:
  - Card oscura tipo Premium teaser que aparece al pie del artículo si su partido tiene pick Premium aprobado.
  - Si usuario es Premium: muestra el pick desbloqueado con link a `/partidos/[slug]`.
  - Si NO: muestra blur + CTA "Probar Premium 7 días".

### Archivos a eliminar

Ninguno.

## Datos requeridos

```typescript
// apps/web/app/(public)/blog/[slug]/page.tsx
export const revalidate = 3600;

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const article = articles.getBySlug(params.slug);
  if (!article) notFound();

  // Cross-data si el artículo menciona partido
  const partidoData = article.frontmatter.partidoSlug
    ? await partidos.getBySlug(article.frontmatter.partidoSlug)
    : null;

  const cuotas = partidoData?.partidoId
    ? await obtenerOddsCacheadas(partidoData.partidoId)
    : null;

  const pickPremium = partidoData?.partidoId
    ? await prisma.pickPremium.findFirst({
        where: { partidoId: partidoData.partidoId, aprobado: true },
      })
    : null;

  const session = await getServerSession(authOptions);
  const estadoUsuario = await detectarEstadoUsuario(session?.user?.id);

  return (
    <BlogPost
      article={article}
      partidoCrossLink={partidoData}
      cuotas={cuotas}
      pickPremium={pickPremium}
      estadoUsuario={estadoUsuario}
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
│ <BlogPostHero>                   │
├──────────────────────────────────┤
│ <TOC> collapsable mobile         │
├──────────────────────────────────┤
│ Cuerpo del artículo (MDX)        │
│   - Componentes embebidos:       │
│     <PronosticoBox>, <CasaCTA>,  │
│     <CuotasComparator>, etc.     │
├──────────────────────────────────┤
│ <CrossLinkPartido> (si aplica)   │
├──────────────────────────────────┤
│ <PickPremiumPromo> (si aplica)   │
├──────────────────────────────────┤
│ <NewsletterCTA fuente="blog">    │
├──────────────────────────────────┤
│ <RelatedArticles>                │
├──────────────────────────────────┤
│ <Footer>                         │
├──────────────────────────────────┤
│ <BottomNav>                      │
└──────────────────────────────────┘
```

### Loading / Error

- Si MDX no parsea: log warn + `notFound()`.
- TOC: si no hay headings h2/h3 en el artículo, ocultar componente.

## Componentes que reutiliza

- `<MobileHeader>` (Lote A).
- `<BottomNav>` (Lote A).
- MDX provider con todos los componentes registrados (Lote 8): `<CasaCTA>`, `<CasaReviewCard>`, `<TablaCasas>`, `<DisclaimerLudopatia>`, `<CuotasComparator>`, `<DisclaimerAfiliacion>`, `<PronosticoBox>`, `<TOC>`, `<RelatedArticles>`.
- `<NewsletterCTA>` (Lote 10).

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- Mobile-first.
- JSON-LD `Article` + OG dinámico se mantienen (Lote 8).
- `articulo_visto` se dispara en mount (ya existe Lote 8).
- ISR `revalidate=3600`.
- Eventos: si aparece `<PickPremiumPromo>` en viewport, dispatch `pick_premium_blocked_visto` (NUEVO Lote B, definido en `flujos-navegacion.md`).

## Mockup de referencia

Sin mockup individual. Patrón visual: similar a Producto B pero con foco en lectura (más texto, menos UI). Ver `partidos-slug.html` para patrones de cross-link y secciones oscuras.

## Pasos manuales para Gustavo post-deploy

Ninguno.

**Validación:**
1. Abrir cualquier `hablaplay.com/blog/[slug]` existente.
2. Verificar TOC funciona en mobile (collapsable) y desktop (sticky).
3. Si el artículo menciona partido, verificar `<CrossLinkPartido>` al pie.
4. Verificar Newsletter CTA y `<RelatedArticles>`.

---

*Versión 1 · Abril 2026 · Blog post para Lote B*
