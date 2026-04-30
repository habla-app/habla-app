# Live match `/live-match`

Vista de partidos en vivo con ranking en tiempo real, eventos del partido, y mi ticket si predije. En v3.1 se agregan alertas Premium si el usuario está suscrito.

## Lote responsable

**Lote C** — Reauditoría móvil de la capa autenticada.

## Estado actual del repo

- `apps/web/app/(main)/live-match/page.tsx` (Lote 0/3): Server Component con LiveSwitcher + LiveFinalizedSection + LiveFinalizedBanner + filtro por liga.
- Servicios: `live-matches.service.ts` (`obtenerLiveMatches`, `obtenerFinalizedMatches`, `elegirTorneoPrincipal`).
- Cache: `live-partido-status.cache.ts` (TTL corto para datos en vivo).
- Socket.io para actualización del ranking en vivo (cliente).

## Cambios necesarios

Refactor mobile-first + agregado de alertas Premium (si suscrito) + cross-link a Producto B.

### Archivos a modificar

- `apps/web/app/(main)/live-match/page.tsx`:
  - Mantener queries de partidos en vivo + finalizados existentes.
  - Agregar query para `pickPremium` aprobado del partido en vivo (si user es Premium).
  - Pasar `estadoUsuario` al componente para renderizar alertas Premium si aplica.

- `apps/web/components/live/LiveSwitcher.tsx` (Lote 3 — verificar existe):
  - Refactor mobile-first.
  - Si solo hay 1 partido en vivo: mostrar directamente sin switcher.
  - Si hay 2+: chips horizontales con scroll-x para cambiar entre ellos.

- `apps/web/components/live/LiveFinalizedSection.tsx` (Lote 3 — verificar):
  - Sección bajo los partidos en vivo: cards de finalizados últimas 24h con resultado + ganador del torneo + premio.
  - Refactor visual mobile-first.

### Archivos a crear

- `apps/web/components/live/LiveHeroCard.tsx`:
  - Card destacada del partido en vivo seleccionado:
    - Nombres equipos + escudos
    - Marcador grande con tipografía Barlow Condensed
    - Indicador "● EN VIVO · Min 67'" con animate-pulse
    - Cuotas en vivo (si disponibles via api-football)
    - Cross-link a Producto B (ver análisis completo)

- `apps/web/components/live/MiTicketLive.tsx`:
  - Card con la predicción del usuario para este partido (si predijo).
  - Muestra cada mercado con check ✓ verde si va acertando, ✗ rojo si va fallando, o ⏳ pendiente si aún no se decidió.
  - Puntos parciales actualizados.

- `apps/web/components/live/RankingLive.tsx`:
  - Top 10 del torneo del partido actualizándose en vivo via Socket.io.
  - Resaltar fila del usuario.
  - Indicador de "actualizado hace Xs" en tiempo real.

- `apps/web/components/live/AlertasPremium.tsx`:
  - Solo visible si usuario es Premium.
  - Lista de alertas en vivo del editor para este partido:
    - "🔥 Cambio de cuotas: Betano subió +2.10 a +2.45 en BTTS Sí"
    - "⚡ Oportunidad: Al minuto 70, las cuotas en vivo de Empate son 3.20"
    - Datos vienen de un canal interno o de WhatsApp Business API webhook.
  - Si no hay alertas: estado vacío "Sin alertas activas. El editor publicará si surge oportunidad."

- `apps/web/components/live/EventosPartido.tsx`:
  - Timeline de eventos del partido (gol, tarjeta, sustitución).
  - Datos del modelo `EventoPartido` ya existente (Lote 0).
  - Se actualiza via polling de api-football (Lote 0/9).

### Archivos a eliminar

Ninguno.

## Datos requeridos

```typescript
// apps/web/app/(main)/live-match/page.tsx
export const dynamic = 'force-dynamic';

interface Props {
  searchParams?: { liga?: string };
}

export default async function LiveMatchPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/signin?callbackUrl=/live-match');

  const userId = session.user.id;
  const ligaFilter = searchParams?.liga;

  const [liveMatches, finalizedMatches, estadoUsuario] = await Promise.all([
    obtenerLiveMatches({ ligaFilter }),
    obtenerFinalizedMatches({ horas: 24 }),
    detectarEstadoUsuario(userId),
  ]);

  // Si Premium, cargar picks Premium activos para los partidos en vivo
  const picksPremium = estadoUsuario === 'premium'
    ? await prisma.pickPremium.findMany({
        where: {
          partidoId: { in: liveMatches.map((m) => m.partido.id) },
          aprobado: true,
        },
      })
    : [];

  // Mi ticket en cada partido en vivo
  const misTickets = await prisma.ticket.findMany({
    where: {
      usuarioId: userId,
      torneo: { partidoId: { in: liveMatches.map((m) => m.partido.id) } },
    },
    include: { torneo: true },
  });

  return (
    <LiveMatchView
      liveMatches={liveMatches}
      finalizedMatches={finalizedMatches}
      misTickets={misTickets}
      picksPremium={picksPremium}
      estadoUsuario={estadoUsuario}
      ligaFilter={ligaFilter}
    />
  );
}
```

### Servicios usados

- `obtenerLiveMatches` (Lote 0/3, ya existe).
- `obtenerFinalizedMatches` (Lote 0/3, ya existe).
- `getLiveStatus` (Lote 0, ya existe — cache de estado en vivo).
- `detectarEstadoUsuario` (Lote B nuevo).
- `prisma.pickPremium` (Lote E — fallback array vacío).

## Estados de UI

### Estructura

```
┌──────────────────────────────────┐
│ <MobileHeader variant="main">    │
├──────────────────────────────────┤
│ <LiveSwitcher> (si 2+ partidos)  │
├──────────────────────────────────┤
│ <LiveHeroCard>                   │
│   - Equipos + marcador grande    │
│   - "● EN VIVO · Min 67'"        │
│   - Cuotas en vivo               │
│   - Cross-link a Producto B      │
├──────────────────────────────────┤
│ <AlertasPremium> (si Premium)    │
├──────────────────────────────────┤
│ <MiTicketLive> (si predijo)      │
├──────────────────────────────────┤
│ <RankingLive> Top 10 del torneo  │
├──────────────────────────────────┤
│ <EventosPartido> Timeline        │
├──────────────────────────────────┤
│ <LiveFinalizedSection>           │
│   - Cards de finalizados 24h     │
├──────────────────────────────────┤
│ <BottomNav>                      │
└──────────────────────────────────┘
```

### Estados de UI según contexto

#### No hay partidos en vivo
- Hero compacto: "Sin partidos en vivo ahora."
- Sub: "El próximo es Alianza vs Universitario · Sábado 9PM."
- Ocultar `<LiveHeroCard>`, `<AlertasPremium>`, `<MiTicketLive>`, `<RankingLive>`, `<EventosPartido>`.
- Mostrar solo `<LiveFinalizedSection>` si hay finalizados de últimas 24h.

#### Hay 1 partido en vivo
- Sin switcher, foco en ese partido.

#### Hay 2+ partidos en vivo
- `<LiveSwitcher>` con chips para cambiar.
- Default: el partido con más tipsters compitiendo.

#### Usuario predijo este partido
- `<MiTicketLive>` visible con sus 5 mercados + estado parcial.

#### Usuario NO predijo este partido
- `<MiTicketLive>` reemplazado por banner: "No hiciste predicción para este partido. [Ver siguiente partido →]".

#### Premium con alertas
- `<AlertasPremium>` muestra alertas reales del editor.

#### Premium sin alertas
- `<AlertasPremium>` muestra estado vacío sobrio.

#### Free / FTD (no Premium)
- `<AlertasPremium>` reemplazado por teaser: "💎 Recibe alertas en vivo con Premium · [Probar 7 días →]".

### Loading

- Server component → render directo.
- Socket.io del ranking se conecta client-side post-mount (loading state breve en `<RankingLive>`).
- Eventos del partido: polling de api-football cada 30-60s (existente Lote 0).

## Componentes que reutiliza

- `<MobileHeader>` (Lote A).
- `<BottomNav>` (Lote A).
- `<CrossProductBanner>` (Lote A).
- Servicios live existentes (Lote 0/3).
- Socket.io client (Lote 0).

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- Mobile-first.
- Animaciones permitidas: `animate-pulse` para LIVE indicator. `animate-fade-in` para nuevos eventos del timeline.
- Touch targets ≥44px en switcher chips.
- Cero hex hardcodeados.
- Si Premium pero modelo `PickPremium` no existe (Lote E pendiente): graceful, mostrar `<AlertasPremium>` vacío.

## Mockup de referencia

Sin mockup individual. Patrones visuales:
- Live banner del `home.html` (Paquete 3A): rojo pulse + texto + meta.
- `<MiTicketLive>` similar a la lista de `mis-predicciones.html` (Paquete 4A) con resultado parcial.
- `<RankingLive>` similar al `<LeaderboardTorneoPreview>` de `comunidad-torneo-slug.html` (Paquete 4A).

## Pasos manuales para Gustavo post-deploy

Ninguno.

**Validación post-deploy:**
1. Esperar a que haya un partido en vivo (o validar con un partido de testing).
2. Logueado, abrir `hablaplay.com/live-match`.
3. Verificar `<LiveHeroCard>` con marcador y minuto.
4. Verificar `<MiTicketLive>` si predijiste.
5. Verificar `<RankingLive>` actualizándose (Socket.io).
6. Si Premium: verificar `<AlertasPremium>` con alertas o vacío sobrio.
7. Click en cross-link → navega a `/partidos/[slug]` (Producto B).
8. Verificar `<LiveFinalizedSection>` con finalizados de últimas 24h.

---

*Versión 1 · Abril 2026 · Live match para Lote C*
