# Guía individual `/guias/[slug]`

Vista de guía editorial. Soporta tipo HowTo (con pasos numerados) o Article genérico. Con JSON-LD apropiado por tipo.

## Lote responsable

**Lote B** — Reauditoría móvil de la capa pública.

## Estado actual del repo

- `apps/web/app/(public)/guias/[slug]/page.tsx` (Lote 8): JSON-LD `Article` + `HowTo` opcional via `frontmatter.tipo: "howto"`. ISR `revalidate=3600`.
- Carga MDX desde `apps/web/content/guias/[slug].mdx`.

## Cambios necesarios

Refinamiento mobile-first y agregado de cross-link a vistas relacionadas (Producto B, Casas, Premium) según contenido.

### Archivos a modificar

- `apps/web/app/(public)/guias/[slug]/page.tsx`:
  - Mantener carga MDX, JSON-LD existentes.
  - Agregar al final: `<GuiaSiguienteEnCategoria>` y `<GuiasRelacionadas>` (basado en categoría y tags).

- `apps/web/components/mdx/TOC.tsx` (compartido con blog):
  - Mismo refactor mobile-first del Lote 8 que se aplica a blog.

### Archivos a crear

- `apps/web/components/guias/GuiaHero.tsx`:
  - Hero compacto: chip de categoría + chip de tipo + título + tiempo de lectura + autor (si aplica).

- `apps/web/components/guias/GuiaSiguienteEnCategoria.tsx`:
  - Card al pie con la siguiente guía de la misma categoría según orden de `_meta.ts`.
  - Layout: "📚 Siguiente en [Categoría]: Cómo combinar apuestas →".

- `apps/web/components/guias/GuiasRelacionadas.tsx`:
  - Lista de 3 guías relacionadas (matched por tags compartidos).
  - Server component que reutiliza la lógica de `<RelatedArticles>` (Lote 8) adaptada a guías.

- `apps/web/components/guias/PasosHowTo.tsx`:
  - Componente MDX que se registra en el provider de Lote 8 para renderizar pasos HowTo con styling consistente.
  - Cada paso tiene número + título + contenido + opcional imagen.

### Archivos a eliminar

Ninguno.

## Datos requeridos

```typescript
// apps/web/app/(public)/guias/[slug]/page.tsx
export const revalidate = 3600;

export default async function GuiaPage({ params }: { params: { slug: string } }) {
  const guia = guias.getBySlug(params.slug);
  if (!guia) notFound();

  const siguiente = guias.getSiguienteEnCategoria(guia);
  const relacionadas = guias.getRelacionadas(guia, 3);

  return (
    <Guia
      guia={guia}
      siguiente={siguiente}
      relacionadas={relacionadas}
    />
  );
}
```

### Servicios nuevos

- `guias.getSiguienteEnCategoria(guia)`: busca en `_meta.ts` la siguiente guía de la misma categoría. Devuelve `null` si es la última.
- `guias.getRelacionadas(guia, n)`: matchea por tags compartidos. Reusa lógica de `<RelatedArticles>` adaptada.

## Estados de UI

### Estructura

```
┌──────────────────────────────────┐
│ <MobileHeader variant="public">  │
├──────────────────────────────────┤
│ <GuiaHero>                       │
├──────────────────────────────────┤
│ <TOC> collapsable mobile         │
├──────────────────────────────────┤
│ Cuerpo de la guía (MDX)          │
│   - Pasos HowTo si aplica        │
│   - Componentes MDX embebidos    │
├──────────────────────────────────┤
│ <GuiaSiguienteEnCategoria>       │
├──────────────────────────────────┤
│ <NewsletterCTA fuente="guia">    │
├──────────────────────────────────┤
│ <GuiasRelacionadas>              │
├──────────────────────────────────┤
│ <Footer>                         │
├──────────────────────────────────┤
│ <BottomNav>                      │
└──────────────────────────────────┘
```

### Empty / Error

- Si MDX no parsea: log warn + `notFound()`.
- Si no hay siguiente o relacionadas: ocultar componentes correspondientes.

## Componentes que reutiliza

- `<MobileHeader>` (Lote A).
- `<BottomNav>` (Lote A).
- MDX provider con todos los componentes (Lote 8).
- `<NewsletterCTA>` (Lote 10).
- `<Footer>` (Lote 11).
- `<TOC>` (Lote 8, refactor compartido con blog).

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- Mobile-first.
- JSON-LD `Article` + `HowTo` se mantienen (Lote 8).
- ISR `revalidate=3600`.

## Mockup de referencia

Sin mockup individual. Estructura similar a blog post (`blog-slug.spec.md`). Diferencias: no tiene pick Premium ni cross-link a partido por defecto, pero sí tiene `<GuiaSiguienteEnCategoria>` y agrupación por categoría.

## Pasos manuales para Gustavo post-deploy

Ninguno.

**Validación:**
1. Abrir cualquier `hablaplay.com/guias/[slug]` existente.
2. Probar TOC en mobile y desktop.
3. Verificar `<GuiaSiguienteEnCategoria>` y `<GuiasRelacionadas>` al pie.

---

*Versión 1 · Abril 2026 · Guía individual para Lote B*
