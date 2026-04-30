# Mes cerrado `/comunidad/mes/[mes]`

Vista histórica de un mes cerrado del leaderboard. Muestra el Top 100 final del mes con premios pagados, ganador destacado, y opción de ir a `/comunidad/[username]` de cada tipster.

## Lote responsable

**Lote C** — Reauditoría móvil de la capa autenticada.

## Estado actual del repo

- `apps/web/app/(main)/comunidad/mes/[mes]/page.tsx` (Lote 5): tabla histórica del mes cerrado.
- Usa `Leaderboard` model con snapshot del mes (Lote 5).
- Servicios: `obtenerLeaderboardCerrado(mes)`.

## Cambios necesarios

Refactor visual mobile-first siguiendo el mismo patrón que `/comunidad`. Es una vista relativamente simple — espejo del leaderboard del mes en curso pero histórico.

### Archivos a modificar

- `apps/web/app/(main)/comunidad/mes/[mes]/page.tsx`:
  - Mantener carga del snapshot mensual existente.
  - Agregar query del Top 10 con datos de premio pagado (estado).
  - Validar formato `mes` como `YYYY-MM` (ej: `2026-03`).

### Archivos a crear

- `apps/web/components/comunidad/MesHero.tsx`:
  - Hero con título "Liga Habla! · Marzo 2026" + total tipsters + ganador (avatar + username + monto).
  - Background gradient retro (gris/azul oscuro para indicar histórico).

- `apps/web/components/comunidad/Top10Premiados.tsx`:
  - Grid del Top 10 con detalle de premio pagado:
    - Posición + avatar + username + puntos + premio + estado pago (✓ Pagado / ⏳ Pendiente / ✗ Rechazado).
  - Si soy admin: link "[Editar premio →]" para ir a `/admin/premios-mensuales` (solo visible si admin).

- `apps/web/components/comunidad/TablaCompletaCerrada.tsx`:
  - Tabla del Top 100 sin premios destacados (los premios están en `<Top10Premiados>`).
  - Misma lógica de fila destacada para el viewer si participó ese mes.

### Archivos a eliminar

Ninguno.

## Datos requeridos

```typescript
// apps/web/app/(main)/comunidad/mes/[mes]/page.tsx
export const revalidate = 86400;  // ISR 1 día (mes cerrado no cambia)

export default async function MesCerradoPage({ params }: { params: { mes: string } }) {
  // Validar formato YYYY-MM
  if (!/^\d{4}-\d{2}$/.test(params.mes)) notFound();

  const session = await auth();
  const viewerId = session?.user?.id ?? null;

  const leaderboard = await obtenerLeaderboardCerrado(params.mes);
  if (!leaderboard) notFound();

  // Premios mensuales (Lote 5)
  const premios = await prisma.premioMensual.findMany({
    where: { mes: params.mes },
    orderBy: { posicion: 'asc' },
    take: 10,
  });

  return (
    <MesCerradoView
      leaderboard={leaderboard}
      premios={premios}
      viewerId={viewerId}
      mes={params.mes}
    />
  );
}
```

### Servicios usados

- `obtenerLeaderboardCerrado` (Lote 5, ya existe).
- `prisma.premioMensual` (Lote 5, ya existe).

## Estados de UI

### Estructura

```
┌──────────────────────────────────┐
│ <MobileHeader variant="main">    │
├──────────────────────────────────┤
│ Breadcrumb:                      │
│  Comunidad › Marzo 2026          │
├──────────────────────────────────┤
│ <MesHero>                        │
│   - "Liga Habla! · Marzo 2026"   │
│   - Stats: tipsters, ganador     │
├──────────────────────────────────┤
│ <Top10Premiados>                 │
├──────────────────────────────────┤
│ Section "🏆 Top 100"             │
│   - <TablaCompletaCerrada>       │
├──────────────────────────────────┤
│ Footer "Ver otro mes:"           │
│   - Chips con meses cerrados     │
├──────────────────────────────────┤
│ <BottomNav>                      │
└──────────────────────────────────┘
```

### Estados de UI

#### Mes válido con datos
- Render normal.

#### Mes con formato inválido (ej: `2026-13` o `abril`)
- `notFound()` (404).

#### Mes sin leaderboard cerrado (ej: mes futuro o nunca cerrado)
- `notFound()`.

#### Premios aún no pagados todos
- Top 10 muestra estado pago real por fila.

#### Yo participé ese mes y soy Top 10
- Mi fila destacada en `<Top10Premiados>` con texto adicional "🎉 Tu posición".

#### Yo participé pero no fui Top 10
- Mi fila destacada en `<TablaCompletaCerrada>`.

#### Yo no participé ese mes
- Sin fila destacada del viewer.

### Loading

- ISR 1 día → render desde cache.
- Si Top 100 fue actualizado por admin (raro): purga manual o esperar 24h.

## Componentes que reutiliza

- `<MobileHeader>` (Lote A).
- `<BottomNav>` (Lote A).
- `<Avatar>`, `<Badge>`, `<Card>` del design system base.
- `<HorizontalScrollChips>` (Lote 9 / Lote A) para navegación entre meses.
- `<LeaderboardMensualTable>` adaptado (mismo del Lote 5 con prop `mes` para variar look "histórico").

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- Mobile-first.
- ISR `revalidate=86400` (mes cerrado no cambia frecuentemente).
- Touch targets ≥44px en filas clickables.
- Cero hex hardcodeados.

## Mockup de referencia

Sin mockup individual. Patrón visual idéntico a `/comunidad` (mes en curso) pero con look "histórico":
- Hero con tono más sobrio (sin countdown a cierre).
- Premios mostrando "Pagado ✓" en lugar de "Pendiente al cierre".
- Sin `<MisStatsMini>` (no aplica a mes histórico).

## Pasos manuales para Gustavo post-deploy

Ninguno.

**Validación post-deploy:**
1. Logueado, abrir cualquier `hablaplay.com/comunidad/mes/2026-03` (un mes cerrado real).
2. Verificar hero con ganador y monto.
3. Verificar `<Top10Premiados>` con estado de pagos.
4. Verificar `<TablaCompletaCerrada>` con Top 100.
5. Click en un tipster → navega a `/comunidad/[username]`.
6. Probar mes inválido (`/comunidad/mes/abril`) → debe 404.
7. Probar mes sin cerrar (mes en curso) → debe 404 o redirigir a `/comunidad`.

---

*Versión 1 · Abril 2026 · Mes cerrado para Lote C*
