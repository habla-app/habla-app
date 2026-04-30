# Home — Vista raíz `/`

Vista principal de Habla! para todos los usuarios (anónimo / free / FTD / Premium / admin). Personaliza CTAs según estado de session. Es la vista con más tráfico esperado, especialmente durante el Mundial.

## Lote responsable

**Lote B** — Reauditoría móvil de la capa pública.

## Estado actual del repo

- `apps/web/app/(main)/page.tsx` (Lote 11): home rediseñada con 6 secciones (HomeHero, Pronósticos del día, Compite gratis, Casas top, Últimos análisis, Newsletter banner).
- Se accede vía `/(main)` actualmente, pero `inventario-vistas.md` indica eliminar `/(main)/page.tsx` y consolidar en `/(public)/page.tsx`.

### Componentes existentes a reutilizar (Lote 11)

- `apps/web/components/home/HomeHero.tsx`: hero con gradient + 2 CTAs.
- `apps/web/components/home/PartidoDelDiaCard.tsx`: card de partido con `<CuotasComparatorMini>` embebido.
- `apps/web/components/home/LeaderboardPreview.tsx`: top 5 mes en curso.
- `apps/web/components/home/SectionBar.tsx`: barra de sección reusable.
- `apps/web/components/home/ArticleCard.tsx`: card de artículo.
- `apps/web/components/mdx/CuotasComparatorMini.tsx` (Lote 9 + 11): variante compacta del comparador.
- `apps/web/components/mdx/CasaReviewCardMini.tsx` (Lote 7 + 11): variante compacta de casa.
- `apps/web/components/marketing/NewsletterCTA.tsx` (Lote 10).

## Cambios necesarios

### Decisión arquitectónica

**Mover `/(main)/page.tsx` a `/(public)/page.tsx`**. Eliminar la redirección automática de `/(main)` que llevaba al usuario logueado a otra parte. La home es UNA sola para todos, con personalización por estado.

### Archivos a modificar

- `apps/web/app/(public)/page.tsx`: nuevo archivo (mover desde main). Trasladar la lógica completa de `/(main)/page.tsx`.
- `apps/web/app/(main)/page.tsx`: ELIMINAR. La ruta `/(main)/` queda vacía, Next.js no genera ruta para ella.
- `apps/web/app/(main)/matches/page.tsx`: ELIMINAR. La vista `/matches` se descontinúa según `inventario-vistas.md`. El comparador global vive en `/cuotas` (más relevante).
- `apps/web/components/home/HomeHero.tsx`: refactor visual completo siguiendo el mockup. Tagline cambia a "Todas las fijas en una". CTAs cambian según estado del usuario (ver "Estados de UI" abajo).
- `apps/web/components/home/PartidoDelDiaCard.tsx`: agregar variante con pick Premium bloqueado embebido.
- `apps/web/components/home/ArticleCard.tsx`: agregar prop `showPickPremiumLink` cuando el artículo cubre un partido con pick Premium disponible.

### Archivos a crear

- `apps/web/components/home/HomeLiveBanner.tsx`: banner flotante que aparece cuando hay partido en vivo. Linkea a `/live-match` o al `/partidos/[slug]` según haya uno o varios. Usa `<MobileHeader>` no se mueve, sino que este banner aparece debajo del hero con margen negativo (efecto "card sobre hero").
- `apps/web/components/home/LigaHablaCardHome.tsx`: card grande dorada que aparece a mitad de home. Reusable en otras vistas. Datos: contadores reales del leaderboard del mes en curso, premio total, próximo cierre.
- `apps/web/components/home/PremiumTeaserHome.tsx`: card oscura con badge "Pick Premium del día", contenido blureado, CTA "Desbloquear con Premium". Datos: pick aprobado más reciente.
- `apps/web/components/home/EstadoUsuarioBanner.tsx`: banner contextual según estado del usuario logueado (ver `flujos-navegacion.md` sección 7).

### Archivos a eliminar

- `apps/web/app/(main)/page.tsx` (después de mover contenido).
- `apps/web/app/(main)/matches/page.tsx`.
- `apps/web/components/matches/MatchesPageContent.tsx`.
- `apps/web/components/matches/MatchesSidebar.tsx`.

## Datos requeridos

```typescript
// apps/web/app/(public)/page.tsx
export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  // Próximos 3 partidos top con cuotas cacheadas
  const partidosProximos = await prisma.partido.findMany({
    where: {
      fechaInicio: { gte: new Date(), lte: addHours(new Date(), 24) },
      liga: { in: LIGAS_TOP },
    },
    orderBy: { fechaInicio: 'asc' },
    take: 3,
  });

  const partidosConCuotas = await Promise.all(
    partidosProximos.map(async (p) => ({
      ...p,
      cuotas: await obtenerOddsCacheadas(p.id),
    }))
  );

  // Top 5 leaderboard mes actual
  const topTipsters = await obtenerTopTipsters(5);

  // Mi posición si autenticado
  const miPosicion = userId ? await obtenerMiPosicion(userId) : null;

  // 6 casas top activas
  const casasTop = await obtenerCasasTopActivas(6);

  // 3 últimos artículos
  const ultimosArticulos = articles.getAll().slice(0, 3);

  // Pick Premium del día (si existe y está aprobado)
  const pickPremiumHoy = await prisma.pickPremium.findFirst({
    where: {
      fechaPublicacion: { gte: startOfToday() },
      aprobado: true,
    },
    include: { partido: true, casaRecomendada: true },
    orderBy: { fechaPublicacion: 'desc' },
  });

  // Estado del usuario
  const estadoUsuario = await detectarEstadoUsuario(userId);
  // Returns: 'anonimo' | 'free' | 'ftd' | 'premium'

  // ¿Hay partido en vivo?
  const partidosEnVivo = await obtenerPartidosEnVivo();

  return (
    <HomePage
      partidos={partidosConCuotas}
      topTipsters={topTipsters}
      miPosicion={miPosicion}
      casasTop={casasTop}
      ultimosArticulos={ultimosArticulos}
      pickPremiumHoy={pickPremiumHoy}
      estadoUsuario={estadoUsuario}
      partidosEnVivo={partidosEnVivo}
    />
  );
}
```

### Servicios necesarios

- `obtenerOddsCacheadas` (Lote 9, ya existe).
- `obtenerTopTipsters` (Lote 5, ya existe).
- `obtenerMiPosicion` (Lote 5, ya existe).
- `obtenerCasasTopActivas` (Lote 7, ya existe — verificar exportación).
- `articles.getAll()` (Lote 8, ya existe).
- `obtenerPartidosEnVivo` (Lote 0, ya existe).
- `detectarEstadoUsuario` ⚠️ **NUEVO** — crear en `apps/web/lib/services/usuarios.service.ts`. Devuelve `'anonimo' | 'free' | 'ftd' | 'premium'` según presencia de session, suscripción activa, y `usuario.ftdReportado`.
- `prisma.pickPremium.findFirst()` ⚠️ **NUEVO** — depende del modelo `PickPremium` que se crea en Lote E. **Si Lote B se ejecuta antes que Lote E**, esta query devuelve `null` siempre y los componentes `<PremiumTeaserHome>` muestran fallback "Próximamente picks Premium" con CTA igual a `/premium`.

## Estados de UI

### Estructura completa de la home

Vertical stack de secciones, mobile-first:

```
┌──────────────────────────────────┐
│ <MobileHeader variant="public">  │
├──────────────────────────────────┤
│ <HomeHero>                       │
│   - Tagline "Todas las fijas..."  │
│   - Sub: descripción              │
│   - <SearchBar> placeholder      │
├──────────────────────────────────┤
│ <HomeLiveBanner> (si aplica)     │  ← Card flotante con margen -16px
├──────────────────────────────────┤
│ <EstadoUsuarioBanner>            │  ← Solo si free/ftd/premium
├──────────────────────────────────┤
│ Section "⚡ Próximos partidos"   │
│   - <PartidoDelDiaCard> x3       │
│   - "Ver todos →" → /cuotas      │
├──────────────────────────────────┤
│ <LigaHablaCardHome>              │  ← Card dorada grande
├──────────────────────────────────┤
│ <PremiumTeaserHome>              │  ← Card oscura con pick bloqueado
├──────────────────────────────────┤
│ Section "🏠 Casas autorizadas"   │
│   - <CasaReviewCardMini> x6      │
├──────────────────────────────────┤
│ Section "📝 Últimos análisis"   │
│   - <ArticleCard> x3             │
├──────────────────────────────────┤
│ <NewsletterCTA fuente="home">    │
├──────────────────────────────────┤
│ <Footer> (4 columnas)            │
├──────────────────────────────────┤
│ <BottomNav> (sticky)             │
└──────────────────────────────────┘
```

### Variantes según estado del usuario

| Sección | Anónimo | Free | FTD | Premium |
|---|---|---|---|---|
| `<HomeHero>` CTAs | "Empezar gratis" + "Ver pronósticos" | "Hola Juan" + "Tus partidos" | "Hola Juan" + "Próximos picks" | "Hola Juan, suscriptor 💎" |
| `<EstadoUsuarioBanner>` | (no se muestra) | "🏆 Compite gratis · Top 10 gana S/ 1,250" | "📊 Tu acierto: X% · Premium llega a 65%" | "💎 Próximo cobro: 15 may" |
| `<LigaHablaCardHome>` | "Empezar gratis" CTA | "Tu pos: #156 · +47 para Top 100" | "Tu pos: #..." | "Tu pos: #..." |
| `<PremiumTeaserHome>` | Visible con CTA "Desbloquear" | Visible con CTA "Probar 7 días gratis" | Visible MÁS prominente, copy "Tu acierto puede subir a 65%" | OCULTO (ya es Premium) |
| `<CasaReviewCardMini>` x6 | Todas visibles | Todas visibles | **Solo casas que NO tiene** (cross-sell) | Todas visibles |

### Loading states

- Server component renderiza con datos cargados — no hay loading client-side global.
- Si una sección falla en cargar (ej. cuotas timeout), renderizar fallback discreto con `<Skeleton>` y log via `logs.service.ts` con `level: 'warn'`.

### Empty states

- Si no hay partidos top en próximas 24h (raro, pero posible en breaks de liga): sección "Próximos partidos" se reemplaza por banner "No hay partidos top hoy. Ver toda la agenda →" linkeando a `/cuotas`.
- Si no hay pick Premium aprobado para hoy: `<PremiumTeaserHome>` muestra placeholder "Pick del día llega antes de las 12:00 PM. [Ver picks pasados →]".

## Componentes que reutiliza

- `<MobileHeader variant="public">` (Lote A → 00-layout).
- `<BottomNav>` (Lote A → 00-layout).
- `<SearchBar>` (Lote A — átomo nuevo en componentes-base).
- `<PartidoDelDiaCard>` (refactor de Lote 11).
- `<CuotasComparatorMini>` (Lote 9 + 11, ya existe).
- `<LeaderboardPreview>` (Lote 11, refactor visual).
- `<CasaReviewCardMini>` (Lote 11, ya existe).
- `<ArticleCard>` (Lote 11, refactor visual).
- `<NewsletterCTA>` (Lote 10, ya existe).
- `<Footer>` (Lote 11, refactor copy).
- `<PickBloqueadoTeaser>` (Lote A → componentes-mobile).
- `<EstadoUsuarioBanner>` (Lote A → componentes-mobile).
- `<Button>`, `<Card>`, `<Badge>` del design system base.

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- Mobile-first: ancho base 375px. Breakpoints `sm` y `md` deben verse correctamente pero el diseño optimizado es móvil.
- Lighthouse Mobile target >90 en esta vista (es la más visitada).
- Tokens del design system, nada hardcodeado.
- Renderizar SSR/`force-dynamic` (depende de session + cuotas frescas). Sin `revalidate`.
- Eventos analíticos a disparar:
  - Mount: `casa_click_afiliado` se dispara desde `<CasaCTA>` ya existente.
  - Mount: ya existen los eventos del Lote 6/8/9/10. **Nuevo:** disparar `pick_premium_blocked_visto` cuando `<PickBloqueadoTeaser>` aparece en viewport (instrumentar con IntersectionObserver para que solo se dispare 1 vez por sesión).

## Mockup de referencia

`home.html` en este mismo folder. Cubre la variante "visitante anónimo" como caso base. Las variantes free/FTD/Premium se documentan en este spec pero se implementan condicionalmente en JSX.

También ver `00-design-system/mockup-actualizado.html` sección "04 · Pista usuario · Home mobile" como referencia secundaria.

## Pasos manuales para Gustavo post-deploy

Ninguno. Este lote es 100% código frontend reutilizando services existentes.

Si el modelo `PickPremium` aún no existe (Lote E no ha corrido), `<PremiumTeaserHome>` muestra fallback. El componente NO debe romper. Validar visualmente que se ve bien sin pick.

---

*Versión 1 · Abril 2026 · Spec home para Lote B*
