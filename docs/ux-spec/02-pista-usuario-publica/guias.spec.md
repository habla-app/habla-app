# Guías listing `/guias`

Listing público de guías (Producto A en el modelo v3.1). Funciona como apoyo al usuario para entender términos, cómo usar casas, cómo predecir mejor, etc. Es la "Wikipedia" de Habla! — soporte invisible pero importante.

## Lote responsable

**Lote B** — Reauditoría móvil de la capa pública.

## Estado actual del repo

- `apps/web/app/(public)/guias/page.tsx` (Lote 8): listing simple de guías ordenadas por `_meta.ts`. SSR + ISR.
- Datos: `guias.getAll()` desde MDX en `apps/web/content/guias/*.mdx`.

## Cambios necesarios

Refinamiento mobile-first y agrupación por categorías para mejor descubrimiento.

### Archivos a modificar

- `apps/web/app/(public)/guias/page.tsx`:
  - Agrupar guías por `frontmatter.categoria` (campo a agregar al schema MDX si no existe).
  - Renderizar como secciones colapsables o stacked con headers.

- `apps/web/lib/content/guias.ts`:
  - Si no existe ya: agregar `getAgrupadasPorCategoria()` que devuelve `Map<categoria, guia[]>`.
  - Si una guía no tiene categoría asignada: cae en categoría "General".
  - Mantener `getAll()` y `getBySlug()` existentes.

- `apps/web/lib/content/schema.ts` (Lote 8):
  - Agregar campo opcional `categoria: string` al schema Zod de guías.

### Archivos a crear

- `apps/web/components/guias/GuiasCategoria.tsx`:
  - Sección con título de categoría + grid/stack de guías.
  - En mobile: stack vertical con cards compactas.
  - En desktop: grid 2-col.

- `apps/web/components/guias/GuiaCard.tsx`:
  - Card de guía con icono (basado en categoría) + título + tiempo de lectura estimado + chip de tipo (`Tutorial`, `Glosario`, `HowTo`, `Concepto`).

### Archivos a eliminar

Ninguno.

## Datos requeridos

```typescript
// apps/web/app/(public)/guias/page.tsx
export const revalidate = 3600;

export default function GuiasPage() {
  const agrupadas = guias.getAgrupadasPorCategoria();
  // Map<string, GuiaDoc[]>
  // Ej:
  // 'Empezar a apostar' -> [...]
  // 'Estrategias' -> [...]
  // 'Glosario' -> [...]
  // 'Mercados' -> [...]
  // 'General' -> [...]

  return <GuiasListing agrupadas={agrupadas} />;
}
```

### Categorías sugeridas para el contenido v3.1

Definidas para guiar la creación de contenido editorial (no implementación técnica):

- **Empezar a apostar:** "¿Cómo elegir una casa?", "¿Qué es el bono de bienvenida?", "Verificar identidad MINCETUR", etc.
- **Estrategias:** "Bankroll management", "EV+ explicado simple", "Cómo combinar apuestas", etc.
- **Mercados:** "1X2", "Hándicap asiático", "BTTS", "Más/menos goles", "Doble oportunidad", etc.
- **Glosario:** términos básicos como "stake", "cuota", "tipster", etc.
- **Apuestas responsables:** ludopatía, autoexclusión, límites, etc.

## Estados de UI

### Estructura

```
┌──────────────────────────────────┐
│ <MobileHeader variant="public">  │
├──────────────────────────────────┤
│ Page hero compact                │
│   - "Guías y glosario"           │
│   - Sub: "Aprende lo básico..."  │
├──────────────────────────────────┤
│ Buscador opcional (futuro)       │
├──────────────────────────────────┤
│ <GuiasCategoria> "Empezar..."    │
│   - <GuiaCard> x N               │
├──────────────────────────────────┤
│ <GuiasCategoria> "Estrategias"   │
│   - <GuiaCard> x N               │
├──────────────────────────────────┤
│ ... otras categorías             │
├──────────────────────────────────┤
│ <Footer>                         │
├──────────────────────────────────┤
│ <BottomNav>                      │
└──────────────────────────────────┘
```

### Empty / Loading

- Si una categoría no tiene guías: omitir la sección entera.
- Si no hay guías en absoluto (raro): mensaje "Estamos preparando las guías. Vuelve pronto."

## Componentes que reutiliza

- `<MobileHeader>` (Lote A).
- `<BottomNav>` (Lote A).
- `<Footer>` (Lote 11).

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- Mobile-first.
- ISR `revalidate=3600`.
- Cero hex hardcodeados.

## Mockup de referencia

Sin mockup individual. Patrón visual: secciones con header + cards compactas. Estilo similar a `home.html` "Últimos análisis" pero más denso (cards más pequeñas, varias por sección).

## Pasos manuales para Gustavo post-deploy

**Solo si Claude Code agrega el campo `categoria` al schema MDX:** los archivos `.mdx` existentes en `content/guias/` deben actualizarse para incluir `categoria` en su frontmatter. Claude Code debe:

1. Inventariar las guías existentes (`ls apps/web/content/guias/`).
2. Asignar categoría apropiada a cada una en el frontmatter (decidir según el contenido).
3. Hacer commit del cambio de contenido junto con el cambio de código.

Esto NO requiere acción manual de Gustavo — Claude Code hace todo, incluyendo el commit del contenido editorial.

**Validación post-deploy:**
1. Abrir `hablaplay.com/guias`.
2. Verificar agrupación por categorías.
3. Click en una guía → navega a `/guias/[slug]`.

---

*Versión 1 · Abril 2026 · Guías listing para Lote B*
