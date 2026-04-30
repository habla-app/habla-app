# Producto B — Vista de partido `/partidos/[slug]`

Vista más crítica del modelo v3.1. Presenta **un partido específico** con análisis editorial, comparador de cuotas, pronóstico Habla!, pick Premium bloqueado, y cross-link al torneo del partido (Producto C).

## Lote responsable

**Lote B** — Reauditoría móvil de la capa pública.

## Estado actual del repo

- `apps/web/app/(public)/partidos/[slug]/page.tsx` (Lote 8 + 9): vista actual con TOC sticky + `<CuotasComparator>` embebido al final del MDX si `frontmatter.partidoId` existe en BD.
- Carga MDX desde `apps/web/content/partidos/[slug].mdx`.
- Renderiza JSON-LD `SportsEvent` para SEO.
- `revalidate=3600` (ISR). **Cambia en v3.1 a `force-dynamic`** porque depende de session.

### Componentes existentes a reutilizar

- `<CuotasComparator>` (Lote 9): server async que lee odds-cache y dispatcha a `<CuotasGrid>` (hit) o `<CuotasComparatorPoller>` (miss).
- `<PronosticoBox>` (Lote 8): box destacado del pronóstico con confianza 1-5.
- `<TOC>` (Lote 8): tabla de contenidos sticky con scroll-spy.
- `<RelatedArticles>` (Lote 8): server component que matchea por tags.
- `<CasaCTA>` (Lote 7): CTA dorado prominente.
- `<DisclaimerAfiliacion>` (Lote 8): legal.

## Cambios necesarios

Esta vista se **reescribe casi completa** porque el modelo v3.1 cambia su estructura para incluir los 3 CTAs jerárquicos (Liga, Premium, Afiliado) y la sincronía B↔C.

### Archivos a modificar

- `apps/web/app/(public)/partidos/[slug]/page.tsx`:
  - Cambiar `export const revalidate = 3600` por `export const dynamic = 'force-dynamic'`.
  - Agregar `getServerSession()` para detectar estado del usuario.
  - Cargar `obtenerOddsCacheadas(partidoId)` directo desde el page (server-side), no esperar al MDX.
  - Cargar `prisma.pickPremium.findFirst({partidoId, aprobado:true})` para el pick bloqueado.
  - Cargar `prisma.torneo.findFirst({partidoSlug})` para el cross-link a Producto C.
  - Renderizar **estructura nueva** según mockup (no el TOC sticky actual).

- `apps/web/components/mdx/PronosticoBox.tsx`: refactor visual al estilo `pronostico-mock` del mockup-actualizado.html (gradiente azul, label uppercase, pick grande, cuota con strong dorado).

- `apps/web/components/mdx/CuotasComparator.tsx`: variante mobile-first del comparador. Mantener `<CuotasGrid>` actual para desktop. Crear nueva `<CuotasGridMobile>` con layout vertical que coincide con el mockup (filas con nombre casa + 1/X/2 + flecha → en círculo).

### Archivos a crear

- `apps/web/components/partido/PartidoHero.tsx`:
  - Hero con countdown + chips liga/countdown + escudos grandes + nombres + estadio/fecha.
  - Background gradient stadium con radial dorado.
  - Variantes según estado del partido: `programado` (countdown), `en_vivo` (marcador + minuto + LIVE pulse), `finalizado` (resultado + chip "FIN").

- `apps/web/components/partido/CuotasGridMobile.tsx`:
  - Filas con scroll-y. Cada fila: nombre casa (80px) | 1 | X | 2 | botón → (32px circle).
  - Mejor cuota destacada con `bg-gold-dim` y borde dorado. Botón → en gold con shadow.
  - Click en cualquier celda dispara `/go/[casa]?utm_source=partido&utm_medium=comparador&partidoId=...&mercado=1x2&outcome=1` con tracking.

- `apps/web/components/partido/PronosticoCard.tsx`:
  - Card destacada con el pronóstico del editor + cuota + casa con mejor cuota + nivel de confianza.
  - Reemplaza/complementa al `<PronosticoBox>` actual.

- `apps/web/components/partido/PickBloqueadoSeccion.tsx`:
  - Sección oscura "💎 Pick Premium del editor" con `<PickBloqueadoTeaser>` (componente del Lote A).
  - Padding generoso, separadores con borde dorado tenue.
  - Si usuario es Premium: renderiza el pick desbloqueado con razonamiento estadístico completo.
  - Si usuario NO es Premium: muestra blur + overlay + CTA "⚡ Probar 7 días gratis" → `/premium`.

- `apps/web/components/partido/LigaWidgetInline.tsx`:
  - Widget azul brillante con icono trofeo + "234 tipsters compitiendo" + arrow.
  - Linkea a `/comunidad/torneo/[slug]` (Producto C).
  - Solo se renderiza si `prisma.torneo.findFirst({partidoSlug})` devuelve un torneo activo.

- `apps/web/components/partido/SoporteFooter.tsx`:
  - Footer pequeño "¿Dudas con la jerga? [Ver guías y glosario →]".
  - Linkea a `/guias` o `/guias/glosario` (si existe).

### Archivos a eliminar

Ninguno. El MDX legacy de `apps/web/content/partidos/[slug].mdx` se mantiene como fuente del análisis editorial. El page renderiza la nueva estructura usando el MDX como una de las secciones (análisis editorial), no como el todo.

## Datos requeridos

```typescript
// apps/web/app/(public)/partidos/[slug]/page.tsx
export const dynamic = 'force-dynamic';

export default async function PartidoPage({ params }: { params: { slug: string } }) {
  const partido = await partidos.getBySlug(params.slug);
  if (!partido) notFound();

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const estadoUsuario = await detectarEstadoUsuario(userId);

  // Cuotas cacheadas (Lote 9)
  const cuotas = partido.partidoId
    ? await obtenerOddsCacheadas(partido.partidoId)
    : null;

  // Pick Premium si existe (depende de Lote E)
  const pickPremium = partido.partidoId
    ? await prisma.pickPremium.findFirst({
        where: { partidoId: partido.partidoId, aprobado: true },
        include: { casaRecomendada: true },
      })
    : null;

  // Torneo Liga Habla! del partido (Producto C)
  const torneo = partido.partidoId
    ? await prisma.torneo.findFirst({
        where: { partidoId: partido.partidoId, estado: 'ACTIVO' },
        include: { _count: { select: { tickets: true } } },
      })
    : null;

  return (
    <PartidoView
      partido={partido}
      mdxContent={partido.content}
      cuotas={cuotas}
      pickPremium={pickPremium}
      torneo={torneo}
      estadoUsuario={estadoUsuario}
    />
  );
}
```

### Servicios usados

- `partidos.getBySlug` (Lote 8, ya existe).
- `obtenerOddsCacheadas` (Lote 9, ya existe).
- `prisma.pickPremium` (Lote E — fallback `null` si aún no existe el modelo).
- `prisma.torneo` (Lote 0/3, ya existe).
- `detectarEstadoUsuario` (NUEVO — definido en `home.spec.md`).

## Estados de UI

### Estructura completa de la vista

```
┌──────────────────────────────────┐
│ <PartidoHero variant="...">      │  ← Background gradient stadium
│   - Back button + share icons    │
│   - Chips liga + countdown       │
│   - Escudos grandes + nombres    │
│   - Estadio + fecha + hora       │
├──────────────────────────────────┤
│ Section "📊 Cuotas comparadas"   │
│   - <CuotasGridMobile>           │  ← CTA AFILIADO inline
├──────────────────────────────────┤
│ Section "🎯 Pronóstico Habla!"   │
│   - Análisis editorial (MDX)     │
│   - <PronosticoCard>             │
├──────────────────────────────────┤
│ Section oscura PREMIUM           │
│   <PickBloqueadoSeccion>         │  ← CTA PREMIUM dominante
├──────────────────────────────────┤
│ Section "🏆 Compite por este     │
│  partido"                        │
│   - <LigaWidgetInline>           │  ← CTA REGISTRO/Liga
├──────────────────────────────────┤
│ <SoporteFooter>                  │  ← Link a Producto A
├──────────────────────────────────┤
│ <Footer> (compartido)            │
├──────────────────────────────────┤
│ <BottomNav>                      │
└──────────────────────────────────┘

<StickyCTABar primary="...">       ← CTA dinámico según estado
```

### CTAs jerárquicos por estado del usuario

Implementar mediante `<StickyCTABar>` y la prominencia visual de las secciones internas:

| Estado | StickyCTABar primary | StickyCTABar secondary | Sección Premium | LigaWidget |
|---|---|---|---|---|
| **Anónimo** | "💰 Apostar en Betano @ 2.05" (link a `/go/[mejor-casa]`) | Botón outline "📊 Compartir" | Visible con CTA "Probar 7 días gratis" | "Compite gratis →" |
| **Free** | "💰 Apostar en Betano @ 2.05" | "🏆 Predecir" (linkea a `/comunidad/torneo/[slug]`) | Más prominente, copy con FOMO | "Tu pos: #156 →" |
| **FTD activo** (no Premium) | Cross-sell de casa diferente: "💰 Probar Stake (bono S/100)" | "🏆 Predecir" | "Tu acierto X% → 65% con Premium" | "Tu pos →" |
| **Premium** | "💰 Apostar @ 1.85 (cuota recomendada)" — abre la casa específica del pick | "📋 Ver bot WhatsApp" | OCULTO (ya es Premium, ve pick desbloqueado) | "Tu pos →" |

### Loading

- Server component → render directo. Sin loading client-side global.
- `<CuotasComparatorPoller>` ya existente del Lote 9 maneja el caso "miss" del cache.

### Vacío

- Si no hay cuotas cacheadas y el poller agota reintentos: la sección de cuotas muestra estado vacío "Cuotas en proceso de actualización. [Ver todas las casas →]" linkeando a `/casas`.
- Si no hay pick Premium aprobado para este partido: la sección Premium muestra placeholder más sobrio "Picks Premium se publican antes de cada partido top. [Ver todos los picks →]" → `/premium`.
- Si no hay torneo activo para este partido: ocultar `<LigaWidgetInline>` completamente.

### Error

- Si `partidos.getBySlug` devuelve null: `notFound()` (Next.js 404).
- Si `obtenerOddsCacheadas` lanza excepción: log warn, render fallback.

## Componentes que reutiliza

- `<MobileHeader variant="transparent">` (Lote A → 00-layout).
- `<BottomNav>` (Lote A).
- `<StickyCTABar>` (Lote A → componentes-mobile).
- `<PickBloqueadoTeaser>` (Lote A → componentes-mobile).
- `<CuotasComparator>` o sub-componentes (Lote 9, refactor mobile).
- MDX provider con componentes registrados (Lote 8, ya existe).
- `<RelatedArticles>` (Lote 8, opcional al pie).
- `<DisclaimerAfiliacion>` (Lote 8) en footer de la vista.

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md.
- Mobile-first riguroso. Esta vista es la más probable de ser visitada desde TikTok/IG con tráfico móvil puro.
- Lighthouse Mobile target >90.
- LCP <2.5s. Tiene mucha info renderizada — usar streaming SSR si es posible (`<Suspense>` boundaries en secciones que dependen de queries lentas como `obtenerOddsCacheadas`).
- Z-index correcto: header z-30, sticky CTA z-20, BottomNav z-20.
- JSON-LD `SportsEvent` se mantiene para SEO (estructura existente del Lote 8).
- Tokens del design system. Cero hex hardcodeados.
- Eventos analíticos:
  - `partido_visto` (renombrar `match_viewed` actual del Lote 6 a este).
  - `pick_premium_blocked_visto` cuando aparece en viewport (NUEVO Lote B).
  - `cross_product_navegado` cuando click en `<LigaWidgetInline>` (NUEVO Lote B).
  - `casa_click_afiliado` cuando click en cualquier botón → de cuotas (ya existe Lote 7).

## Mockup de referencia

- `partidos-slug.html` en este mismo folder (versión mobile estado anónimo, caso base).
- `00-design-system/mockup-actualizado.html` sección "05·06 · Productos B y C — sincronía mobile" (B en columna izquierda).

## Pasos manuales para Gustavo post-deploy

Ninguno. Esta vista es código puro reutilizando datos existentes.

**Validación post-deploy:** abrir `hablaplay.com/partidos/cualquier-slug-existente` y verificar visualmente:
1. Hero con escudos y countdown se ve bien en móvil.
2. Comparador de cuotas tiene la casa con mejor cuota destacada en dorado.
3. Sección Premium muestra blur + lock si no estás suscrito.
4. Widget Liga Habla! aparece con número correcto de tipsters compitiendo.
5. Sticky CTA inferior tiene el copy correcto según estado.
6. Click en una casa del comparador navega a `/go/[casa]?utm_source=...` correctamente.

---

*Versión 1 · Abril 2026 · Producto B spec para Lote B*
