# Casas autorizadas — Listing `/casas`

Listing público de casas de apuestas autorizadas por MINCETUR. Vista crítica para SEO y para canalizar tráfico hacia conversión de afiliación.

## Lote responsable

**Lote B** — Reauditoría móvil de la capa pública.

## Estado actual del repo

- `apps/web/app/(public)/casas/page.tsx` (Lote 8): SSR + filtros client-side sobre lista de casas activas + `<CasasGrid>` con filtrado in-memory por rating mín / con bono / métodos de pago.
- `apps/web/components/public/CasasGrid.tsx` (Lote 8): grid responsive con filtros sticky. Optimizado para desktop.
- Datos: `casas.getActivas()` devuelve solo casas con `activo=true && autorizadoMincetur=true`.
- Componente embebido: `<CasaReviewCard>` (Lote 7) por casa.

## Cambios necesarios

### Decisión arquitectónica

Esta vista funciona bien en su lógica de datos (Lote 7-8 ya implementa todo el sistema de afiliación + verificación MINCETUR). Solo necesita refinamiento mobile-first del filtrado.

### Archivos a modificar

- `apps/web/app/(public)/casas/page.tsx`:
  - Cambiar metadata para alinear con copy v3.1 (mencionar comparador y Liga Habla! en la descripción de la página para canalizar a otras secciones).
  - Resto sin cambios estructurales.

- `apps/web/components/public/CasasGrid.tsx`:
  - Refactor mobile-first: en vez de dropdown de filtros desktop, usar `<BottomSheet>` con los filtros para mobile.
  - Mantener layout grid en desktop.
  - Agregar nuevo filtro: "Solo con bono activo" como toggle.
  - Agregar buscador de nombre de casa (input con debounce).

- `apps/web/components/mdx/CasaReviewCard.tsx`:
  - Refactor visual al estilo design system v3.1 (border-light, shadow-sm, rounded-lg).
  - Agregar badge "★ Mejor cuota hoy en X partido" si la casa tiene mejor cuota en algún partido próximo top.
  - Touch targets ≥44px en CTA.

### Archivos a crear

- `apps/web/components/casas/CasasFiltersSheet.tsx`:
  - Bottom sheet con todos los filtros (rating, bono, métodos pago, deportes).
  - Botón "Aplicar" sticky bottom + "Reset" outline.
  - Usa `<BottomSheet>` del Lote A (componentes-mobile.md sección 5).

- `apps/web/components/casas/CasasSearchBar.tsx`:
  - Search bar con icono lupa + input.
  - Debounce 300ms.
  - Estado controlado por URL param `?q=...` para que sea compartible.

- `apps/web/lib/services/casas-mejores-cuotas.service.ts`:
  - Helper que recibe lista de casas y devuelve cuáles tienen "mejor cuota actual" en al menos 1 partido top de las próximas 24h.
  - Usa `obtenerOddsCacheadas` (Lote 9) y compara.
  - Cachea resultado en Redis con TTL 30min (alineado con odds-cache).
  - Devuelve `Map<casaSlug, { partidoSlug, partidoNombre, mercado, cuota }>`.

### Archivos a eliminar

Ninguno.

## Datos requeridos

```typescript
// apps/web/app/(public)/casas/page.tsx
export const revalidate = 3600;  // ISR 1h, alineado con layout

export default async function CasasPage({ searchParams }: { searchParams: { q?: string } }) {
  const reviews = await casas.getActivas();

  // Cross-data: ¿qué casas tienen mejor cuota en próximos partidos top?
  const mejoresCuotas = await obtenerCasasConMejorCuotaProximas24h();

  const items = reviews.map((r) => ({
    slug: r.doc.frontmatter.slug,
    title: r.doc.frontmatter.title,
    excerpt: r.doc.frontmatter.excerpt,
    afiliadoSlug: r.afiliado!.slug,
    nombre: r.afiliado!.nombre,
    logoUrl: r.afiliado!.logoUrl,
    rating: r.afiliado!.rating,
    bonoActual: r.afiliado!.bonoActual,
    metodosPago: r.afiliado!.metodosPago,
    deportes: r.afiliado!.deportes,
    mejorCuotaInfo: mejoresCuotas.get(r.afiliado!.slug),
  }));

  return <CasasGrid items={items} initialQuery={searchParams.q} />;
}
```

## Estados de UI

### Estructura

```
┌──────────────────────────────────┐
│ <MobileHeader variant="public">  │
├──────────────────────────────────┤
│ Page hero compact                │
│   - "Casas autorizadas MINCETUR" │
│   - Sub: "X casas verificadas"   │
├──────────────────────────────────┤
│ <CasasSearchBar>                 │  ← sticky
├──────────────────────────────────┤
│ Botón "🎚 Filtros (3 activos)"   │  ← abre BottomSheet
├──────────────────────────────────┤
│ Listado de casas                 │
│   - <CasaReviewCard> x N         │
│   - Stack vertical mobile,       │
│     grid 2-col desktop           │
├──────────────────────────────────┤
│ <Footer>                         │
├──────────────────────────────────┤
│ <BottomNav>                      │
└──────────────────────────────────┘
```

### Loading

- Server component renderiza con datos directos. Sin loading global.
- Cuando se cambia un filtro: re-render client-side instantáneo (filtrado in-memory).

### Empty

- Si filtros producen 0 resultados: mensaje "Ninguna casa coincide con los filtros aplicados. [Reset filtros]".
- Si no hay casas activas en BD (raro): "Estamos verificando la lista de casas con MINCETUR. Vuelve pronto."

### Estados según usuario

| Estado | Diferencia |
|---|---|
| Anónimo | Banner secundario "🏆 Compite gratis en Liga Habla!" al pie del listado |
| Free / FTD | Sin banner extra |
| Premium | Footer con CTA "Tu próximo pick Premium recomienda X casa →" linkeando al partido del pick |

## Componentes que reutiliza

- `<MobileHeader>` (Lote A).
- `<BottomNav>` (Lote A).
- `<BottomSheet>` (Lote A).
- `<CasaReviewCard>` (Lote 7, refactor visual).
- `<DisclaimerLudopatia>` (Lote 7) al pie.

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- Mobile-first riguroso.
- ISR `revalidate=3600` (heredado del layout).
- Solo casas con `activo=true && autorizadoMincetur=true` se renderizan.
- Touch targets ≥44px.
- Eventos analíticos:
  - `casa_click_afiliado` (Lote 7) ya cableado en `<CasaCTA>`/`<CasaReviewCard>`.

## Mockup de referencia

`00-design-system/mockup-actualizado.html` no incluye un mockup específico de listing de casas. Para esta vista, Claude Code se basa en la estructura definida arriba + el componente `<CasaReviewCard>` que ya existe + el patrón general de listing visto en `home.html` del Paquete 3A.

Si visualmente surge ambigüedad, Claude Code documenta la decisión en el reporte de cierre del lote y se mantiene consistente con el resto de las vistas del Lote B.

## Pasos manuales para Gustavo post-deploy

Ninguno. Es código frontend reutilizando datos existentes.

**Validación post-deploy:**
1. Abrir `hablaplay.com/casas`.
2. Verificar que aparecen todas las casas activas y autorizadas MINCETUR.
3. Probar filtros (bottom sheet en mobile).
4. Probar buscador.
5. Click en una casa → debe navegar a `/casas/[slug]` (reseña individual).
6. Click en el CTA dorado de una casa → debe navegar a `/go/[casa]?utm_source=casas`.

---

*Versión 1 · Abril 2026 · Casas listing para Lote B*
