# Comunidad — Leaderboard mensual `/comunidad`

Vista del leaderboard mensual de Liga Habla! con Top 100 + posición del usuario + premios visibles + meses cerrados accesibles. Es la "Tabla de posiciones" del Producto C.

## Lote responsable

**Lote C** — Reauditoría móvil de la capa autenticada.

## Estado actual del repo

- `apps/web/app/(main)/comunidad/page.tsx` (Lote 5): hero con mes en curso + total tipsters + premio del 1° lugar, tabla Top 100, "Mi posición" destacada, tarjeta Top 10 con premios visibles, link a meses cerrados.
- `apps/web/components/comunidad/LeaderboardMensualTable.tsx` (Lote 5): tabla con server-render.
- Constantes: `PREMIO_PRIMER_PUESTO`, `TABLA_PREMIOS_MENSUAL`, `TOTAL_PREMIO_MENSUAL` exportadas desde `leaderboard.service.ts`.

## Cambios necesarios

Refactor mobile-first de la tabla y mejora del descubrimiento de meses cerrados.

### Archivos a modificar

- `apps/web/app/(main)/comunidad/page.tsx`:
  - Mantener queries existentes.
  - Agregar `<MisStatsMini>` arriba de la tabla cuando el usuario está logueado (3 stats: pts del mes, posición, deltaSemana).
  - Reorganizar layout: Hero → Top 10 destacado → Tabla Top 100 (collapsable mostrando 20 por default + "Ver más") → Footer con meses cerrados.

- `apps/web/components/comunidad/LeaderboardMensualTable.tsx`:
  - Refactor mobile-first: en mobile, cada fila es una card stacked (no tabla densa).
  - Posiciones del podio (1, 2, 3) con avatares más grandes y medallas visuales.
  - Línea de premio decorativa entre pos. 10 y 11 (solo visible si tabla muestra >10).
  - Fila "Tu posición" siempre visible si autenticado (sticky a posición real, o en top si fuera del Top 100).

### Archivos a crear

- `apps/web/components/comunidad/PremiosMensualesCard.tsx`:
  - Card visible al pie del hero que lista los 10 premios mensuales:
    - 1° S/ 500
    - 2°-3° S/ 200 c/u
    - 4°-10° S/ 50 c/u
    - Total: S/ 1,250
  - Si Premium: nota "Suscriptores Premium pueden duplicar premios via picks de calidad".

- `apps/web/components/comunidad/MisStatsMini.tsx`:
  - Card destacada para usuarios autenticados con 3 stats:
    - Puntos este mes
    - Tu posición
    - Delta vs semana anterior
  - Click → linkea a `/mis-predicciones`.

- `apps/web/components/comunidad/MesesCerradosLink.tsx`:
  - Sección al pie con grid 2-col de meses cerrados (últimos 6).
  - Cada item: "Marzo 2026 · Ganador: CarlosR · S/ 500".
  - Click → linkea a `/comunidad/mes/[mes]`.

### Archivos a eliminar

Ninguno.

## Datos requeridos

```typescript
// apps/web/app/(main)/comunidad/page.tsx
export const dynamic = 'force-dynamic';

export default async function ComunidadPage() {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const [leaderboard, mesesCerrados, miStatsMensuales] = await Promise.all([
    obtenerLeaderboardMesActual({ take: 100 }),
    listarLeaderboardsCerrados({ take: 6 }),
    userId ? obtenerMisStatsMensuales(userId) : Promise.resolve(null),
  ]);

  const miPosicion = userId
    ? leaderboard.find((row) => row.usuarioId === userId) ?? null
    : null;

  // Si autenticado pero no en Top 100, query separada para su posición real
  const miPosicionFueraDeTop100 = userId && !miPosicion
    ? await obtenerMiPosicion(userId)
    : null;

  return (
    <ComunidadPage
      leaderboard={leaderboard}
      mesesCerrados={mesesCerrados}
      miStatsMensuales={miStatsMensuales}
      miPosicion={miPosicion ?? miPosicionFueraDeTop100}
      tablaPremios={TABLA_PREMIOS_MENSUAL}
      totalPremio={TOTAL_PREMIO_MENSUAL}
    />
  );
}
```

### Servicios usados

- `obtenerLeaderboardMesActual` (Lote 5, ya existe).
- `listarLeaderboardsCerrados` (Lote 5, ya existe).
- `obtenerMisStatsMensuales` (Lote 5, ya existe).
- `obtenerMiPosicion` (Lote 5, ya existe).
- Constantes `TABLA_PREMIOS_MENSUAL`, `TOTAL_PREMIO_MENSUAL` (Lote 5, ya existen).

## Estados de UI

### Estructura

```
┌──────────────────────────────────┐
│ <MobileHeader variant="main">    │
├──────────────────────────────────┤
│ Hero                             │
│   - "Liga Habla! · Abril 2026"   │
│   - Stats: tipsters totales,     │
│     premio total, días restantes │
├──────────────────────────────────┤
│ <PremiosMensualesCard>           │
├──────────────────────────────────┤
│ <MisStatsMini> (si auth)         │
├──────────────────────────────────┤
│ Section "🏅 Top 10 del mes"      │
│   - <LeaderboardMensualTable     │
│      take=10 podio>              │
├──────────────────────────────────┤
│ Section "🏆 Top 100"             │
│   - <LeaderboardMensualTable     │
│      take=20 con "Ver más">      │
├──────────────────────────────────┤
│ <MesesCerradosLink>              │
├──────────────────────────────────┤
│ <BottomNav>                      │
└──────────────────────────────────┘
```

### Estados de UI

#### Usuario en Top 100
- Su fila aparece destacada en la tabla con `bg-blue-50` y borde azul.
- `<MisStatsMini>` muestra su posición real arriba.

#### Usuario fuera de Top 100
- Banner sticky bajo el hero: "Tu posición: #347 · 89 puntos para entrar al Top 100".
- Tabla muestra Top 100 sin destacar fila del usuario (no está ahí).

#### Usuario sin predicciones aún en el mes
- `<MisStatsMini>` muestra empty state: "Aún no participas este mes. [Hacer primera predicción →]".

#### Mes recién cerrado (días 1-3 del mes nuevo)
- Banner amarillo arriba: "🎉 Cerró Marzo 2026. [Ver ganadores →]" linkeando a `/comunidad/mes/2026-03`.

### Loading

- Server component → render directo. Sin loading global.
- Tabla puede paginar client-side si el usuario click "Ver más" (top 20 → 50 → 100).

## Componentes que reutiliza

- `<MobileHeader>` (Lote A).
- `<BottomNav>` (Lote A).
- `<Avatar>`, `<Badge>`, `<Card>` del design system base.

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- Mobile-first riguroso (la tabla densa de Lote 5 era desktop-first).
- ISR no aplica — `force-dynamic` por la fila "Mi posición" personalizada.
- Touch targets ≥44px en filas clickables (cada fila linkea al perfil público del tipster).
- Eventos analíticos: `comunidad_leaderboard_visto` ya existe del Lote 6 — confirmar que se dispara en mount.

## Mockup de referencia

Sin mockup individual. Patrón visual basado en:
- `00-design-system/mockup-actualizado.html` sección "05·06" (panel C derecho con leaderboard preview).
- `comunidad-torneo-slug.html` del Paquete 4A (lb-row, podio, línea de premio).

## Pasos manuales para Gustavo post-deploy

Ninguno.

**Validación post-deploy:**
1. Logueado, abrir `hablaplay.com/comunidad`.
2. Verificar hero con mes en curso + tipsters + premio total.
3. Verificar `<PremiosMensualesCard>` con los 10 premios.
4. Verificar `<MisStatsMini>` con tus stats reales.
5. Verificar Top 10 con podio destacado.
6. Verificar tu fila destacada en Top 100 (si estás).
7. Click en un tipster del leaderboard → debe navegar a `/comunidad/[username]`.
8. Verificar `<MesesCerradosLink>` con últimos 6 meses cerrados.
9. Click en un mes cerrado → debe navegar a `/comunidad/mes/[mes]`.

---

*Versión 1 · Abril 2026 · Comunidad para Lote C*
