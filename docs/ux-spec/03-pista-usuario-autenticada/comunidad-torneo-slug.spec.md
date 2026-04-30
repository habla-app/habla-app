# Producto C — Vista del torneo `/comunidad/torneo/[slug]`

Vista del torneo de Liga Habla! sincronizado con un partido específico. **Vista crítica del modelo v3.1**: es donde el usuario hace su predicción y compite por puntos. Tiene cross-link directo a Producto B (vista del partido). Reemplaza al actual `/torneo/[id]`.

## Lote responsable

**Lote C** — Reauditoría móvil de la capa autenticada.

## Estado actual del repo

- `apps/web/app/(main)/torneo/[id]/page.tsx` (Lote 0/3/5/11): vista actual con hero del partido + countdown + tipsters + StickyCTA.
- `apps/web/components/torneos/InscritosList.tsx` (Lote 0): lista de inscritos paginada.
- `apps/web/components/torneos/TorneoStickyCTA.tsx` (Lote 0): CTA sticky bottom.
- `apps/web/components/torneo/InscribirButton.tsx` (Lote 0): botón inscribirse.
- Servicios:
  - `apps/web/lib/services/torneos.service.ts`: `obtener`, `listarInscritos`.
  - `apps/web/lib/services/tickets.service.ts`: CRUD de predicciones (5 mercados).
  - `apps/web/lib/services/puntuacion.service.ts`: cálculo de puntos.

## Cambios necesarios

Vista que se **reescribe casi completa** porque el modelo v3.1 cambia:
1. La URL pasa de `/torneo/[id]` a `/comunidad/torneo/[slug]`.
2. Se agrega cross-link a Producto B.
3. CTA Premium inline.
4. CTA afiliado inline ("Mejor cuota: Betano 2.05").
5. Layout mobile-first con form de 5 mercados rediseñado.

### Archivos a modificar

- `apps/web/lib/services/torneos.service.ts`:
  - Agregar función `obtenerPorSlug(partidoSlug)` que reemplaza `obtener(id)`.
  - Mantener `obtener(id)` por compatibilidad (lo usa el redirect del legacy URL).

### Archivos a crear

- `apps/web/app/(main)/comunidad/torneo/[slug]/page.tsx`:
  - Server component que carga partido + torneo + inscritos + miTicket.
  - Carga tambien cuotas (`obtenerOddsCacheadas`) para el widget afiliado inline.
  - Carga pick Premium si existe (depende de Lote E — fallback null).
  - Renderiza `<TorneoView>`.

- `apps/web/components/torneo/TorneoHero.tsx`:
  - Hero con gradient navy → blue → blue-dark.
  - Pill "⚡ N tipsters compitiendo" + countdown pill rojo.
  - Title "Predice [Equipo A] vs [Equipo B]" en Barlow Condensed grande.
  - Sub: "Suma hasta 21 puntos · Top 10 gana S/ 1,250".
  - `<CrossProductBanner direction="C-to-B">` al final del hero.

- `apps/web/components/torneo/PrediccionForm.tsx`:
  - Form con 5 mercados según el plan v3.1:
    1. Resultado (1X2) — 3 pts
    2. Ambos anotan — 2 pts
    3. Más/menos 2.5 goles — 2 pts
    4. Tarjeta roja — 6 pts
    5. Marcador exacto — 8 pts
  - Cada mercado con label + chip de puntos + opciones grandes (botones para 1X2 y SI/NO; input numérico para marcador).
  - Estado controlado con prefill si `miTicket` ya existe.
  - Disabled si countdown a kickoff <0 (cierre ya pasó).
  - Submit dispara POST `/api/v1/tickets` (existente Lote 0/5).

- `apps/web/components/torneo/MarketRow.tsx`:
  - Component reutilizable por mercado: label + opciones.
  - Variantes: `binary` (Sí/No), `triple` (1/X/2), `input` (marcador).

- `apps/web/components/torneo/PremiumInline.tsx`:
  - Banner inline después del form: "💎 8 de los Top 10 usan Premium · Mira los picks que están sumando puntos".
  - Solo se muestra si NO es Premium.
  - Linkea a `/premium`.

- `apps/web/components/torneo/AffiliateInline.tsx`:
  - Card con borde dorado y badge "★ MEJOR CUOTA".
  - Texto: "¿Apostarías por tu predicción? Betano paga 2.05 por Alianza gana".
  - Botón "Apostar →" linkea a `/go/[mejor-casa]?utm_source=torneo&partidoId=...&mercado=1x2&outcome=...`.
  - La cuota mostrada se sincroniza con la predicción del usuario (1X2): si predijo Alianza gana, muestra la cuota 1.

- `apps/web/components/torneo/LeaderboardTorneoPreview.tsx`:
  - Preview del leaderboard del torneo: top 5 + "Tu posición" + "Línea de premio" decorativa.
  - Linkea a `/comunidad` para ver leaderboard mensual completo.

### Archivos a eliminar

- `apps/web/app/(main)/torneo/[id]/page.tsx`: eliminar después de implementar redirect 301.
- `apps/web/app/(main)/torneos/page.tsx`: eliminar.
- `apps/web/components/torneos/InscritosList.tsx`: reemplazar por `<LeaderboardTorneoPreview>`.
- `apps/web/components/torneos/TorneoStickyCTA.tsx`: reemplazar por `<StickyCTABar>` del Lote A.

### Redirect del URL legacy

En `next.config.js`:
```js
async redirects() {
  return [
    {
      source: '/torneo/:id',
      // Redirect dinámico via middleware o función — Next 14 no soporta
      // redirects asíncronos en next.config. Implementar en middleware.ts:
      // - Buscar Torneo.findUnique({id}) → obtener partidoSlug
      // - 301 a /comunidad/torneo/[partidoSlug]
      // - Si no existe → 301 a /comunidad
      destination: '/comunidad',  // Fallback estático
      permanent: true,
    },
  ];
}
```

Implementación real con resolución del slug: vivir en `apps/web/middleware.ts` con un handler para `/torneo/:id` que consulta BD y redirige.

## Datos requeridos

```typescript
// apps/web/app/(main)/comunidad/torneo/[slug]/page.tsx
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { obtenerPorSlug } from '@/lib/services/torneos.service';
import { obtenerOddsCacheadas } from '@/lib/services/odds-cache.service';

export const dynamic = 'force-dynamic';

export default async function TorneoPage({ params }: { params: { slug: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect(`/auth/signin?callbackUrl=/comunidad/torneo/${params.slug}`);

  const data = await obtenerPorSlug(params.slug, session.user.id);
  if (!data) notFound();

  const { torneo, miTicket } = data;
  const { partido } = torneo;

  const cuotas = partido.id ? await obtenerOddsCacheadas(partido.id) : null;

  const pickPremium = partido.id
    ? await prisma.pickPremium.findFirst({
        where: { partidoId: partido.id, aprobado: true },
      })
    : null;

  const estadoUsuario = await detectarEstadoUsuario(session.user.id);

  const leaderboardTorneo = await obtenerLeaderboardTorneo(torneo.id, { take: 10 });

  return (
    <TorneoView
      torneo={torneo}
      partido={partido}
      miTicket={miTicket}
      cuotas={cuotas}
      pickPremium={pickPremium}
      estadoUsuario={estadoUsuario}
      leaderboardTorneo={leaderboardTorneo}
    />
  );
}
```

### Servicios usados

- `obtenerPorSlug` (NUEVO — wrapper en `torneos.service.ts`).
- `obtenerOddsCacheadas` (Lote 9, ya existe).
- `prisma.pickPremium` (Lote E — fallback `null`).
- `detectarEstadoUsuario` (NUEVO Lote B).
- `obtenerLeaderboardTorneo` (Lote 5 — verificar exportación).

## Estados de UI

### Estructura completa

```
┌──────────────────────────────────┐
│ <MobileHeader variant="main">    │
├──────────────────────────────────┤
│ <TorneoHero>                     │
│   - Pill "⚡ 234 tipsters"       │
│   - Pill countdown "8 min"       │
│   - "Predice Alianza vs Univ."   │
│   - Sub: "Suma hasta 21 pts"     │
│   - <CrossProductBanner C-to-B>  │
├──────────────────────────────────┤
│ Section "🎯 Tu predicción"       │
│   - <PrediccionForm 5 mercados>  │
├──────────────────────────────────┤
│ <PremiumInline> (si NO Premium)  │
├──────────────────────────────────┤
│ <AffiliateInline> con mejor      │
│  cuota según predicción          │
├──────────────────────────────────┤
│ Section "🏅 Leaderboard del mes" │
│   - <LeaderboardTorneoPreview>   │
├──────────────────────────────────┤
│ <Footer> (compartido)            │
├──────────────────────────────────┤
│ <BottomNav>                      │
└──────────────────────────────────┘

<StickyCTABar primary="🏆 Enviar mi predicción">
```

### Estados de UI según contexto temporal y user

#### Estado 1: Antes del kickoff, sin predicción enviada
- Form habilitado, todos los inputs editables.
- Sticky CTA: "🏆 Enviar mi predicción" (gold).

#### Estado 2: Antes del kickoff, con predicción enviada
- Form prefilled con valores de `miTicket`.
- Inputs editables (puede modificar hasta el kickoff).
- Sticky CTA: "✅ Actualizar predicción" (gold) o "Tu predicción está enviada · [Editar]" (informativo).

#### Estado 3: Partido en vivo
- Form deshabilitado (read-only).
- Hero cambia a "🔴 EN VIVO · Min 67' · Marcador 2-1".
- Sticky CTA: "📺 Ver evento en vivo →" linkea a `/live-match`.

#### Estado 4: Partido finalizado, predicción evaluada
- Form muestra resultado: cada mercado con check ✓ verde si acertó o ✗ rojo si falló.
- Hero muestra resultado final.
- Sticky CTA: "🏅 Ver leaderboard del mes →" linkea a `/comunidad`.
- Después del partido, mostrar puntos finales obtenidos: "+15 puntos sumados · Pos. actual: #156".

### Variantes según estado del usuario

| Estado | Sección Premium | Sticky bottom | Diferencias |
|---|---|---|---|
| Free | `<PremiumInline>` visible "8 de los Top 10 usan Premium" | "🏆 Enviar mi predicción" | Estándar |
| FTD | `<PremiumInline>` con copy "Tu acierto X% → 65% con Premium" | "🏆 Enviar mi predicción" | Premium teaser más agresivo |
| Premium | `<PremiumInline>` OCULTO. En su lugar: `<PickPremiumDesbloqueado>` mostrando el pick aprobado del editor para este partido | "🏆 Enviar mi predicción" | Acceso a pick desbloqueado |

### Loading / Error / Empty

- Server component → render directo. Sin loading global.
- Si `partido.slug` no existe: `notFound()` (404).
- Si torneo aún no creado para el partido: mensaje "Este partido aún no tiene torneo. Te avisamos cuando se abra. [Activar notificación]" — usar lógica de notificaciones existente.
- Si cuotas no disponibles: `<AffiliateInline>` se oculta.
- Si pick Premium no disponible: la sección Premium muestra teaser estándar (no desbloqueado).

## Componentes que reutiliza

- `<MobileHeader variant="main">` (Lote A).
- `<BottomNav>` (Lote A).
- `<StickyCTABar>` (Lote A).
- `<CrossProductBanner>` (Lote A).
- Servicios: `tickets.service.ts`, `puntuacion.service.ts`, `leaderboard.service.ts` (Lote 0/5).

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- Mobile-first riguroso. Esta vista es donde el usuario hace conversión clave (enviar predicción).
- Touch targets ≥44px en todos los botones de mercados (los del form son grandes por diseño).
- Form server-side validation con Zod (schema ya existe en `tickets.schema.ts` Lote 0).
- Eventos analíticos:
  - `match_viewed` ya existe del Lote 6 — actualizar nombre a `partido_visto` o `torneo_visto` para diferenciar de la vista de partido.
  - `prediccion_enviada` ya existe (Lote 0/5).
  - `cross_product_navegado` cuando click en `<CrossProductBanner>` (NUEVO Lote B/C).
  - `casa_click_afiliado` cuando click en `<AffiliateInline>` (ya existe Lote 7).
- Cero hex hardcodeados.

## Mockup de referencia

`comunidad-torneo-slug.html` en este mismo folder.

También ver `00-design-system/mockup-actualizado.html` sección "05·06 · Productos B y C — sincronía mobile" (C en columna derecha).

## Pasos manuales para Gustavo post-deploy

Ninguno. Es código frontend reutilizando services existentes.

**Validación post-deploy:**
1. Asegurarse de estar logueado en `hablaplay.com`.
2. Abrir un partido próximo desde la home (click en card de partido) → debe navegar a `/comunidad/torneo/[slug]`.
3. Verificar que aparecen los 5 mercados.
4. Hacer una predicción y enviar.
5. Verificar que se guarda y aparece en `/mis-predicciones`.
6. Probar URL legacy: ir a `/torneo/[id]` (con un id real) → debe redirigir 301 a `/comunidad/torneo/[slug]`.
7. Verificar `<CrossProductBanner>` linkea a `/partidos/[slug]` (Producto B).
8. Verificar `<AffiliateInline>` linkea a `/go/[casa]?...` correctamente.

---

*Versión 1 · Abril 2026 · Producto C para Lote C*
