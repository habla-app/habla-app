# Casa reseña individual `/casas/[slug]`

Vista de reseña editorial de una casa específica. Página crítica para SEO long-tail (queries como "review betano peru", "betsson bono peru").

## Lote responsable

**Lote B** — Reauditoría móvil de la capa pública.

## Estado actual del repo

- `apps/web/app/(public)/casas/[slug]/page.tsx` (Lote 8): server async que carga MDX desde `apps/web/content/casas/[slug].mdx`, joins con `Afiliado` de BD, render con JSON-LD `Review` (con `aggregateRating` cuando `rating` está presente), CTA dorado al final.
- ISR `revalidate=3600`.

## Cambios necesarios

Refinamiento mobile-first + nueva sección "Mejores cuotas en partidos próximos" para conectar con Producto B.

### Archivos a modificar

- `apps/web/app/(public)/casas/[slug]/page.tsx`:
  - Mantener carga de MDX y JSON-LD existentes.
  - Agregar query nueva: partidos top próximos 7 días donde esta casa tiene mejor cuota.
  - Pasar resultado al componente de página para mostrar en una sección nueva.

- `apps/web/components/mdx/CasaCTA.tsx`:
  - Refactor visual mobile-first.
  - Touch target ≥44px.
  - Sticky bottom en mobile (similar al patrón de Producto B), no inline.

### Archivos a crear

- `apps/web/components/casas/CasaHero.tsx`:
  - Hero con logo grande + nombre + rating (estrellas) + bono actual + chips de métodos de pago + chip "Verificada MINCETUR".
  - Background gradient sutil con color de la marca de la casa (extraído de `afiliado.brandColor` si existe; fallback a navy).

- `apps/web/components/casas/PartidosConMejorCuota.tsx`:
  - Sección "🎯 Partidos donde [Casa] paga la mejor cuota esta semana".
  - Lista de hasta 5 partidos con: equipos, fecha, mercado, cuota, link a Producto B (`/partidos/[slug]`).
  - Si no hay partidos top con mejor cuota: ocultar sección completa.

- `apps/web/components/casas/CasaInfoSidebar.tsx`:
  - Sidebar/section con info estructurada: bono actual, métodos de pago, deportes cubiertos, app móvil sí/no, soporte 24/7 sí/no, licencia MINCETUR (con timestamp de última verificación).
  - En mobile: sección stack vertical. En desktop: sidebar a la derecha del contenido.

### Archivos a eliminar

Ninguno.

## Datos requeridos

```typescript
// apps/web/app/(public)/casas/[slug]/page.tsx
export const revalidate = 3600;

export default async function CasaPage({ params }: { params: { slug: string } }) {
  const casa = await casas.getBySlug(params.slug);
  if (!casa || !casa.afiliado || !casa.afiliado.activo) notFound();

  // Partidos próximos 7 días donde esta casa tiene mejor cuota
  const partidosConMejorCuota = await obtenerPartidosConMejorCuotaPorCasa(
    casa.afiliado.slug,
    { ventanaDias: 7, limit: 5 }
  );

  return (
    <CasaReview
      review={casa}
      mdxContent={casa.doc.content}
      partidosTop={partidosConMejorCuota}
    />
  );
}
```

### Servicio nuevo

`obtenerPartidosConMejorCuotaPorCasa(slug, opts)`:
- Lee próximos partidos top próximos N días.
- Para cada uno consulta `obtenerOddsCacheadas` (Lote 9).
- Filtra los que tienen esta casa con mejor cuota en algún outcome (1X2, OU2.5, BTTS).
- Devuelve top N con `{ partidoSlug, partidoNombre, mercado, outcome, cuota, fechaInicio }`.

Vivir en `apps/web/lib/services/odds-cache.service.ts` como función exportada adicional.

## Estados de UI

### Estructura

```
┌──────────────────────────────────┐
│ <MobileHeader variant="public">  │
├──────────────────────────────────┤
│ <CasaHero>                       │
│   - Logo + nombre + rating       │
│   - Chip MINCETUR                │
│   - Bono actual destacado        │
│   - Chips métodos de pago        │
├──────────────────────────────────┤
│ <CasaInfoSidebar> (stack mobile) │
├──────────────────────────────────┤
│ Análisis editorial (MDX render)  │
│   - Pros / Contras               │
│   - Métodos de pago detalle      │
│   - Soporte / app                │
├──────────────────────────────────┤
│ <PartidosConMejorCuota>          │  ← Cross-link a Producto B
├──────────────────────────────────┤
│ <DisclaimerLudopatia>            │
├──────────────────────────────────┤
│ <Footer>                         │
├──────────────────────────────────┤
│ <BottomNav>                      │
└──────────────────────────────────┘

<StickyCTABar>: 💰 Apostar en [Casa]  ← linkea a /go/[slug]
```

### Loading / Empty / Error

- Si `casa.afiliado.activo === false`: `notFound()` (404).
- Si no hay partidos con mejor cuota: ocultar `<PartidosConMejorCuota>` completamente.
- Si MDX falla en parsear: log error + render fallback "Reseña en revisión, vuelve pronto."

### Estados según usuario

| Estado | StickyCTABar |
|---|---|
| Anónimo | "💰 Apostar en [Casa]" + chip "Bono S/100 nuevos" |
| Free | "💰 Apostar con bono S/100" |
| FTD que YA tiene cuenta en esta casa | "💰 Apostar en [Casa]" sin mención de bono (ya lo usó) |
| Premium | "💰 Apostar en [Casa]" + sub-CTA "Esta casa tiene 2 picks Premium esta semana" |

Detección de "ya tiene cuenta": consultar `prisma.usuarioCasa.findFirst({ usuarioId, casaSlug })` (modelo creado en Lote D/E).

## Componentes que reutiliza

- `<MobileHeader>` (Lote A).
- `<BottomNav>` (Lote A).
- `<StickyCTABar>` (Lote A).
- `<CasaCTA>` (Lote 7, refactor visual).
- `<DisclaimerLudopatia>` (Lote 7).
- `<RelatedArticles>` (Lote 8) opcional al pie con artículos sobre casas.
- MDX provider con componentes registrados (Lote 8).

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- Mobile-first.
- JSON-LD `Review` se mantiene (estructura del Lote 8).
- Si la casa pierde licencia MINCETUR (cron K Lote 10 detecta): casa se desactiva → esta vista responde 404 automáticamente al `notFound()` por `casa.afiliado.activo === false`.
- Eventos analíticos: `casa_click_afiliado` ya cableado en CTAs.

## Mockup de referencia

Sin mockup individual. Estructura visual basada en patrones del design system (`mockup-actualizado.html` componentes base) + lógica del JSX existente del Lote 8.

## Pasos manuales para Gustavo post-deploy

Ninguno.

**Validación:**
1. Abrir cualquier `hablaplay.com/casas/[slug]` existente.
2. Verificar que carga: hero, info, análisis, partidos con mejor cuota (si aplica), sticky CTA.
3. Click en sticky CTA → `/go/[casa]?utm_source=review`.

---

*Versión 1 · Abril 2026 · Casa reseña para Lote B*
