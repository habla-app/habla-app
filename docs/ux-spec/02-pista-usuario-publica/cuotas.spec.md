# Comparador global `/cuotas`

Vista que muestra los próximos partidos top con cuotas comparadas. Es el "hub" de Producto B antes de profundizar en un partido específico. Reemplaza al ítem "Partidos" del BottomNav.

## Lote responsable

**Lote B** — Reauditoría móvil de la capa pública.

## Estado actual del repo

- `apps/web/app/(public)/cuotas/page.tsx` (Lote 9): SSR `revalidate=1800`, lee `prisma.partido.findMany` próximas 36h hasta 30 partidos, usa `<CuotasPageClient>` con `<HorizontalScrollChips>` por liga.
- Filtra in-memory via `data-liga`/`data-hidden`. Server-side render con datos cacheados.

### Componentes existentes a reutilizar

- `<CuotasComparator>` (Lote 9): server async que lee odds-cache.
- `<HorizontalScrollChips>` (Lote 9): chips horizontales scrollables.
- `<CuotasPageClient>` (Lote 9): wrapper client-side para filtros.

## Cambios necesarios

Refinamientos visuales al estilo mobile-first. La lógica de datos del Lote 9 se mantiene tal cual.

### Archivos a modificar

- `apps/web/app/(public)/cuotas/page.tsx`:
  - Cambiar layout para ser mobile-first riguroso.
  - Agregar filtros adicionales: por día (Hoy / Mañana / Esta semana) además de por liga.
  - Agregar buscador de equipo/partido en el header de la vista.

- `apps/web/components/mdx/CuotasComparator.tsx`:
  - Refactor mobile-first según la spec en `partidos-slug.spec.md` (crear `<CuotasGridMobile>`).
  - Aplicar el mismo refactor aquí: filas verticales con casa + 1/X/2 + flecha → en círculo.

- `apps/web/components/cuotas/CuotasPageClient.tsx`:
  - Mover los chips de liga al `<HorizontalScrollChips>` con scroll horizontal smooth.
  - Agregar segundo grupo de chips por día.
  - Layout de partidos: stacked vertical (no grid) para mobile.

### Archivos a crear

- `apps/web/components/cuotas/CuotasFilters.tsx`:
  - Component client con 2 grupos de chips: Liga y Día.
  - Estado en URL params para que sea compartible (`?liga=liga-1&dia=hoy`).
  - Filtra in-memory los partidos visibles.

- `apps/web/components/cuotas/CuotasSearchBar.tsx`:
  - Search bar sticky bajo el header.
  - Filtra por nombre de equipo o liga.
  - Onclick: focus en el input + animation.

- `apps/web/components/cuotas/PartidoCuotasCard.tsx`:
  - Card de partido específico para esta vista. Más compact que `<PartidoDelDiaCard>` de home.
  - Layout: badge de liga + countdown + nombres de equipos + 3 cuotas inline + botón "Ver más cuotas →".

### Archivos a eliminar

Ninguno. Solo refactor.

## Datos requeridos

```typescript
// apps/web/app/(public)/cuotas/page.tsx
export const revalidate = 1800;  // ISR cada 30 min, alineado con TTL del odds-cache (Lote 9)

export default async function CuotasPage() {
  const partidos = await prisma.partido.findMany({
    where: {
      fechaInicio: {
        gte: new Date(),
        lte: addHours(new Date(), 36),  // Próximas 36h
      },
      estado: { in: ['PROGRAMADO', 'EN_VIVO'] },
    },
    orderBy: { fechaInicio: 'asc' },
    take: 30,
  });

  // Para cada partido, intentar obtener cuotas cacheadas
  const partidosConCuotas = await Promise.all(
    partidos.map(async (p) => ({
      ...p,
      cuotas: await obtenerOddsCacheadas(p.id),  // null si miss
    }))
  );

  // Agrupar por liga para los chips
  const ligasUnicas = [...new Set(partidos.map(p => p.liga.slug))];

  return (
    <CuotasPageClient
      partidos={partidosConCuotas}
      ligas={ligasUnicas}
    />
  );
}
```

### Servicios usados

- `prisma.partido.findMany` (estándar Prisma).
- `obtenerOddsCacheadas` (Lote 9, ya existe).

## Estados de UI

### Estructura completa

```
┌──────────────────────────────────┐
│ <MobileHeader variant="public">  │
├──────────────────────────────────┤
│ Hero compacto                    │
│   - Title "Comparador de cuotas" │
│   - Sub: "Mejor cuota por        │
│     partido y mercado"           │
├──────────────────────────────────┤
│ <CuotasSearchBar> sticky         │
├──────────────────────────────────┤
│ <CuotasFilters>                  │
│   - Chips de día                 │
│   - Chips de liga                │
├──────────────────────────────────┤
│ Listado de partidos              │
│   - <PartidoCuotasCard> x N      │
│   - Skeleton mientras carga      │
├──────────────────────────────────┤
│ Footer estado vacío si N=0       │
├──────────────────────────────────┤
│ <Footer>                         │
├──────────────────────────────────┤
│ <BottomNav>                      │
└──────────────────────────────────┘
```

### Loading

- ISR sirve la versión cacheada inmediatamente. No hay loading global.
- Por partido individual, si las cuotas son `null` (cache miss), `<PartidoCuotasCard>` muestra skeleton de cuotas y dispara fetch en background usando `<CuotasComparatorPoller>` ya existente del Lote 9.

### Empty

- Si no hay partidos en próximas 36h: mensaje "No hay partidos top esta jornada. Agenda completa próximamente." con CTA "Ver pronósticos →" linkeando a `/pronosticos`.
- Si los filtros aplicados resultan en 0 partidos visibles: mensaje "Ningún partido coincide con los filtros. [Reset filtros]".

### Error

- Si `prisma.partido.findMany` falla: log error + render fallback con CTA a `/casas`.

### Variantes según estado del usuario

| Estado | Diferencia |
|---|---|
| Anónimo | Footer con "Compite gratis en Liga Habla! →" |
| Free / FTD / Premium | Sin footer extra. Solo el listado. |

## Componentes que reutiliza

- `<MobileHeader>` (Lote A).
- `<BottomNav>` (Lote A).
- `<HorizontalScrollChips>` (Lote 9, refactor mobile en Lote A).
- `<CuotasGridMobile>` (NUEVO en `partidos-slug.spec.md`, reutilizado aquí en variante compacta).
- `<Skeleton>` (Lote A).
- `<Footer>` (Lote 11, refactor copy en Lote B).

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- Mobile-first riguroso.
- ISR `revalidate=1800` mantener (alineado con odds-cache TTL).
- Touch targets ≥44px en chips y CTAs.
- Eventos analíticos:
  - `cuotas_comparator_visto` ya existe del Lote 9 — confirma que se dispara en mount de la vista.
  - `casa_click_afiliado` ya existe del Lote 7 — se dispara desde el botón → de cada cuota.
- Cero hex hardcodeados.
- Lighthouse Mobile target >90.

## Mockup de referencia

`cuotas.html` en este mismo folder.

## Pasos manuales para Gustavo post-deploy

Ninguno. Es código frontend reutilizando datos existentes.

**Validación post-deploy:**
1. Abrir `hablaplay.com/cuotas` en móvil.
2. Verificar que aparecen los partidos de las próximas 36h.
3. Probar filtros de día y liga (chips horizontales con scroll suave).
4. Probar buscador (typing filtra el listado).
5. Click en un partido → debe navegar a `/partidos/[slug]` (Producto B).
6. Click directo en una cuota → debe navegar a `/go/[casa]?utm_source=cuotas&...`.

---

*Versión 1 · Abril 2026 · Comparador para Lote B*
