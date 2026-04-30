# Pronósticos `/pronosticos` y `/pronosticos/[liga]`

Vistas de pronósticos editoriales agrupados por liga. Es una de las páginas SEO más fuertes para queries como "pronósticos liga 1 perú", "pronósticos champions hoy".

## Lote responsable

**Lote B** — Reauditoría móvil de la capa pública.

## Estado actual del repo

- `apps/web/app/(public)/pronosticos/page.tsx` (Lote 8): listing simple de ligas.
- `apps/web/app/(public)/pronosticos/[liga]/page.tsx` (Lote 8): pronósticos de una liga específica.
- Datos: MDX desde `apps/web/content/pronosticos/*.mdx`.

## Cambios necesarios

Refinamiento mobile-first y mejora del descubrimiento (mostrar próximos partidos de cada liga en el listing).

### Archivos a modificar

- `apps/web/app/(public)/pronosticos/page.tsx`:
  - Por cada liga: mostrar count de pronósticos publicados + el próximo partido top de esa liga.
  - Layout cards grandes en lugar de lista simple.

- `apps/web/app/(public)/pronosticos/[liga]/page.tsx`:
  - Reordenar para destacar próximos partidos arriba (con cuotas inline).
  - Pronósticos publicados abajo en cards.
  - Agregar widget "Mejor cuota actual por partido próximo".

### Archivos a crear

- `apps/web/components/pronosticos/LigaCard.tsx`:
  - Card grande de liga con: logo/icono + nombre + count de pronósticos + próximo partido + countdown.
  - CTA "Ver pronósticos de [Liga] →".

- `apps/web/components/pronosticos/ProximoPartidoLiga.tsx`:
  - Widget que muestra el próximo partido top de la liga + sus 3 cuotas mejores + CTA.
  - Reutilizable en home y en `/pronosticos/[liga]`.

- `apps/web/components/pronosticos/PronosticoListItem.tsx`:
  - Item de la lista de pronósticos publicados de una liga: thumbnail/icono + título + excerpt + fecha.

### Archivos a eliminar

Ninguno.

## Datos requeridos

```typescript
// apps/web/app/(public)/pronosticos/page.tsx
export const revalidate = 3600;

export default async function PronosticosListingPage() {
  const ligas = pronosticos.getLigas();
  // Para cada liga, traer próximo partido top
  const ligasConProximo = await Promise.all(
    ligas.map(async (liga) => {
      const proximo = await prisma.partido.findFirst({
        where: { liga: liga.slug, fechaInicio: { gte: new Date() } },
        orderBy: { fechaInicio: 'asc' },
      });
      const cuotas = proximo?.id
        ? await obtenerOddsCacheadas(proximo.id)
        : null;
      return { ...liga, proximo, cuotas };
    })
  );

  return <PronosticosLanding ligas={ligasConProximo} />;
}
```

```typescript
// apps/web/app/(public)/pronosticos/[liga]/page.tsx
export const revalidate = 3600;

export default async function PronosticosLigaPage({ params }: { params: { liga: string } }) {
  const ligaInfo = pronosticos.getLigaBySlug(params.liga);
  if (!ligaInfo) notFound();

  // Próximos 3 partidos de esta liga con cuotas
  const proximos = await prisma.partido.findMany({
    where: { liga: params.liga, fechaInicio: { gte: new Date() } },
    orderBy: { fechaInicio: 'asc' },
    take: 3,
  });

  const proximosConCuotas = await Promise.all(
    proximos.map(async (p) => ({
      ...p,
      cuotas: await obtenerOddsCacheadas(p.id),
    }))
  );

  // Pronósticos editoriales publicados
  const pronosticosLiga = pronosticos.getByLiga(params.liga);

  return (
    <PronosticosLiga
      liga={ligaInfo}
      proximos={proximosConCuotas}
      pronosticosPublicados={pronosticosLiga}
    />
  );
}
```

## Estados de UI

### Estructura `/pronosticos`

```
┌──────────────────────────────────┐
│ <MobileHeader variant="public">  │
├──────────────────────────────────┤
│ Page hero compact                │
│   - "Pronósticos por liga"       │
├──────────────────────────────────┤
│ <LigaCard> Liga 1 Perú           │
├──────────────────────────────────┤
│ <LigaCard> Champions League      │
├──────────────────────────────────┤
│ <LigaCard> La Liga, Premier...   │
├──────────────────────────────────┤
│ <Footer> + <BottomNav>           │
└──────────────────────────────────┘
```

### Estructura `/pronosticos/[liga]`

```
┌──────────────────────────────────┐
│ <MobileHeader variant="public">  │
├──────────────────────────────────┤
│ Hero de liga (logo + nombre)     │
├──────────────────────────────────┤
│ Section "⚡ Próximos partidos"   │
│   - <PartidoDelDiaCard> x3       │
├──────────────────────────────────┤
│ Section "📝 Análisis publicados" │
│   - <PronosticoListItem> x N     │
├──────────────────────────────────┤
│ <NewsletterCTA fuente="...">     │
├──────────────────────────────────┤
│ <Footer> + <BottomNav>           │
└──────────────────────────────────┘
```

### Empty / Loading

- Si una liga no tiene próximos partidos: `<LigaCard>` muestra "Sin partidos próximos esta semana" pero sigue listada.
- Si una liga no tiene pronósticos publicados: la sección "Análisis publicados" se omite.

## Componentes que reutiliza

- `<MobileHeader>` (Lote A).
- `<BottomNav>` (Lote A).
- `<PartidoDelDiaCard>` (Lote 11, refactor Lote B).
- `<NewsletterCTA>` (Lote 10).
- `<Footer>` (Lote 11).

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- Mobile-first.
- ISR `revalidate=3600`.
- Touch targets ≥44px en cards y CTAs.

## Mockup de referencia

Sin mockup individual. Patrón visual: similar a `home.html` (sección de partidos) + cards de liga compactas.

## Pasos manuales para Gustavo post-deploy

Ninguno.

**Validación:**
1. Abrir `hablaplay.com/pronosticos`.
2. Verificar que aparecen ligas con próximos partidos.
3. Click en una liga → navega a `/pronosticos/[liga]`.
4. Verificar próximos partidos arriba + análisis publicados abajo.

---

*Versión 1 · Abril 2026 · Pronósticos para Lote B*
