# Mis predicciones `/mis-predicciones`

Histórico de predicciones del usuario (rename de `/mis-combinadas`). Stats agregadas + lista de tickets agrupados por torneo + tab "Mes en curso".

## Lote responsable

**Lote C** — Reauditoría móvil de la capa autenticada.

## Estado actual del repo

- `apps/web/app/(main)/mis-combinadas/page.tsx` (Lote 5): stats + tickets agrupados por torneo + tab "Mes en curso".
- Datos: `obtenerTicketsDeUsuario(userId)`, `obtenerStatsDeUsuario(userId)` (Lote 0/5).

## Cambios necesarios

Rename de URL + reescritura visual mobile-first + agregado de gráfica de evolución y filtros.

### Decisión arquitectónica

**Rename `/mis-combinadas` → `/mis-predicciones`**. El nombre "combinadas" es jerga de apuestas múltiples, confunde. "Predicciones" es claro y alineado con el modelo v3.1 (no se hacen "combinadas" en la app, se hacen predicciones de mercados puntuales).

### Archivos a modificar

- `apps/web/app/(main)/mis-combinadas/page.tsx`: ELIMINAR después de migración.

### Archivos a crear

- `apps/web/app/(main)/mis-predicciones/page.tsx`:
  - Server component que carga stats + tickets paginados + filtros opcionales.
  - Misma lógica de carga que `/mis-combinadas` actual.

- `apps/web/components/mis-predicciones/StatsHero.tsx`:
  - Hero con 3 stats principales: Predicciones / Acierto % / Pos. del mes.
  - Background gradient navy → blue.
  - Sub: "Mes en curso · Cierra en 12 días".

- `apps/web/components/mis-predicciones/EvolucionChart.tsx`:
  - Gráfica simple line chart de "Puntos por mes" últimos 6 meses.
  - Usa Recharts (ya está como dependencia del Lote 6).
  - Si no hay datos suficientes (< 2 meses): ocultar.

- `apps/web/components/mis-predicciones/FiltrosTabs.tsx`:
  - Tabs horizontales: "Todas" | "Mes en curso" | "Ganadas" | "Pendientes" | "Falladas".
  - Estado en URL param `?tab=...`.
  - Default "Todas".

- `apps/web/components/mis-predicciones/PrediccionListItem.tsx`:
  - Item de la lista: partido + tu predicción + resultado + puntos sumados.
  - Si pendiente: chip "⏳ En vivo" o "📅 Próximo".
  - Si finalizado: chip "✓ +15 pts" verde o "✗ 0 pts" rojo.
  - Click → linkea a `/comunidad/torneo/[slug]`.

- `apps/web/components/mis-predicciones/EmptyState.tsx`:
  - Estado vacío para usuarios sin predicciones aún.
  - CTA "Hacer mi primera predicción →" linkea a partido próximo.

### Redirect del URL legacy

En `next.config.js`:
```js
{
  source: '/mis-combinadas',
  destination: '/mis-predicciones',
  permanent: true,
}
```

### Archivos a eliminar

- `apps/web/app/(main)/mis-combinadas/page.tsx`.

## Datos requeridos

```typescript
// apps/web/app/(main)/mis-predicciones/page.tsx
export const dynamic = 'force-dynamic';

interface Props {
  searchParams?: { tab?: string; page?: string };
}

export default async function MisPrediccionesPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/signin?callbackUrl=/mis-predicciones');

  const userId = session.user.id;
  const tab = searchParams?.tab ?? 'todas';
  const page = Math.max(1, parseInt(searchParams?.page ?? '1', 10));

  const [stats, tickets, evolucion] = await Promise.all([
    obtenerStatsDeUsuario(userId),
    obtenerTicketsDeUsuario(userId, { tab, page, pageSize: 20 }),
    obtenerEvolucionMensual(userId, { meses: 6 }),
  ]);

  return (
    <MisPredicciones
      stats={stats}
      tickets={tickets.items}
      evolucion={evolucion}
      pagination={tickets.pagination}
      currentTab={tab}
    />
  );
}
```

### Servicios

- `obtenerStatsDeUsuario` (Lote 0/5, ya existe).
- `obtenerTicketsDeUsuario` (Lote 0, refactor para soportar tab + paginación).
- `obtenerEvolucionMensual` (NUEVO):
  - Lee tickets finalizados agrupados por mes (ISO `YYYY-MM`).
  - Devuelve `[{ mes, puntosTotal, predicciones, aciertoPct }]` últimos N meses.
  - Vivir en `apps/web/lib/services/stats-semana.service.ts` o crear `stats-mensuales.service.ts`.

## Estados de UI

### Estructura

```
┌──────────────────────────────────┐
│ <MobileHeader variant="main">    │
├──────────────────────────────────┤
│ <StatsHero>                      │
│   - 3 stats principales          │
│   - "Mes en curso · 12 días"     │
├──────────────────────────────────┤
│ <EvolucionChart> (si N≥2 meses) │
├──────────────────────────────────┤
│ <FiltrosTabs>                    │
├──────────────────────────────────┤
│ Lista de predicciones            │
│   - <PrediccionListItem> x N     │
│   - Paginación inferior          │
├──────────────────────────────────┤
│ <BottomNav>                      │
└──────────────────────────────────┘
```

### Empty state

Si `tickets.length === 0`:
- Hero stats igual (todos 0).
- Mensaje grande: "Aún no tienes predicciones."
- CTA "Hacer mi primera predicción →" linkea al próximo partido top (query a BD: próximo partido en próximas 24h con torneo activo).

### Loading

- Server component → render directo.
- Skeleton para `<EvolucionChart>` solo si los datos demoran (raro, ya que es agregación).

## Componentes que reutiliza

- `<MobileHeader>` (Lote A).
- `<BottomNav>` (Lote A).
- `<HorizontalScrollChips>` (Lote 9, Lote A) para los tabs.
- `<Card>`, `<Badge>` del design system.

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- Mobile-first.
- Touch targets ≥44px en tabs y items de la lista.
- Cero hex hardcodeados.

## Mockup de referencia

`mis-predicciones.html` en este mismo folder.

## Pasos manuales para Gustavo post-deploy

Ninguno. Solo migración de URL via Next.js redirects.

**Validación post-deploy:**
1. Logueado, abrir `hablaplay.com/mis-predicciones`.
2. Verificar stats hero con números reales.
3. Verificar gráfica de evolución (si tienes datos de 2+ meses).
4. Probar tabs (cambian la lista visible).
5. Click en una predicción → debe navegar a `/comunidad/torneo/[slug]`.
6. Probar URL legacy `hablaplay.com/mis-combinadas` → debe redirigir 301 a `/mis-predicciones`.

---

*Versión 1 · Abril 2026 · Mis predicciones para Lote C*
