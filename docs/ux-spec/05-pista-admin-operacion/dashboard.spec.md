# Admin Dashboard `/admin/dashboard`

Vista raíz del panel admin. Muestra KPIs agrupados en 5 secciones (Captación / Productos / Conversión / Retención / Económicos) con sistema de semáforo y alarmas activas. Es la "primera mirada" cada mañana.

## Lote responsable

**Lote F** — Admin desktop operación.

## Estado actual del repo

- `apps/web/app/admin/dashboard/page.tsx` (Lote 6): cards con visitas/día, registros/día, errores 24h. Funnel `$pageview → signup_completed → prediccion_enviada → casa_click_afiliado`. Selector de rango.
- `apps/web/lib/services/analytics.service.ts` (Lote 6): `obtenerVisitasPorDia`, `obtenerRegistrosPorDia`, `obtenerEventosTopPeriodo`, `obtenerFunnelConversion`.
- `apps/web/lib/services/logs.service.ts` (Lote 6): `obtenerStatsErroresUltimas24h`.

## Cambios necesarios

Reescritura completa para alinear con el modelo v3.1 que tiene KPIs específicos por categoría.

### Decisión arquitectónica

El dashboard del Lote 6 era genérico (visitas / signups / errores). En v3.1 se reorganiza por **5 categorías que reflejan el funnel del negocio**:

1. **Captación**: visitantes, registros, tasa rebote, conversión visita→registro.
2. **Productos B y C**: vistas de partido, predicciones, cross-link B↔C, tipsters activos.
3. **Conversión**: CTR afiliados, click→registro casa, registro→FTD, free→Premium.
4. **Retención**: MRR Premium, churn, DAU/MAU, engagement Channel.
5. **Económicos**: revenue mes, margen operativo, CAC, LTV/CAC.

Cada KPI tiene un **target** y un **semáforo** (verde si ≥target, ámbar si entre 80%-100% target, rojo si <80% target).

### Archivos a modificar

- `apps/web/app/admin/dashboard/page.tsx`:
  - Reescribir completamente.
  - Cargar 5 grupos de KPIs en paralelo con `Promise.all`.
  - Cargar alarmas activas (sistema definido en `alarmas.spec.md` del Lote G — Paquete 6C).
  - Renderizar `<DashboardView>`.

- `apps/web/lib/services/analytics.service.ts`:
  - Mantener funciones existentes (`obtenerVisitasPorDia` etc).
  - Agregar funciones agregadas:
    - `obtenerKpisCaptacion(rango)` — visitantes únicos, registros, tasa rebote, conversión.
    - `obtenerKpisProductos(rango)` — vistas partido, predicciones, cross-link, tipsters activos.
    - `obtenerKpisConversion(rango)` — CTR afiliados, click→registro, registro→FTD, free→Premium.
    - `obtenerKpisRetencion(rango)` — MRR, churn, DAU/MAU, engagement Channel.
    - `obtenerKpisEconomicos(rango)` — revenue mes, margen, CAC, LTV/CAC.

- `apps/web/lib/services/alarmas.service.ts`:
  - NUEVO. Spec completo en Lote G (`alarmas.spec.md`).
  - Por ahora exportar al menos `obtenerAlarmasActivas()` que devuelve `Alarma[]`.

### Archivos a crear

- `apps/web/components/admin/dashboard/AlarmaBanner.tsx`:
  - Banner rojo o ámbar arriba del dashboard si hay alarmas activas.
  - Si N=1: mensaje completo.
  - Si N>1: "X alarmas activas. [Ver todas →]" linkea a `/admin/alarmas`.
  - Auto-dismissible solo si `severidad: 'info'`.

- `apps/web/components/admin/dashboard/KPISeccion.tsx`:
  - Sección con título + grid 4 columnas de `<KPICard>`.
  - Header con sticky en scroll.

- `apps/web/components/admin/dashboard/KPICard.tsx`:
  - Card con: status dot (verde/ámbar/rojo) + label uppercase + valor grande Barlow + tendencia ↗/↘ con %.
  - Click → linkea a `/admin/kpis?metric=<id>` con detalle del KPI.

- `apps/web/components/admin/dashboard/RangoSelector.tsx`:
  - Selector de rango: "Últimos 7 días" / "Últimos 30 días" / "Mes en curso" / "Mes anterior".
  - Estado en URL param `?rango=...`.

### Archivos a eliminar

Ninguno. Solo refactor.

## Datos requeridos

```typescript
// apps/web/app/admin/dashboard/page.tsx
export const dynamic = 'force-dynamic';

interface Props {
  searchParams?: { rango?: string };
}

export default async function AdminDashboardPage({ searchParams }: Props) {
  const rango = searchParams?.rango ?? '30d';

  const [
    captacion,
    productos,
    conversion,
    retencion,
    economicos,
    alarmas,
  ] = await Promise.all([
    obtenerKpisCaptacion(rango),
    obtenerKpisProductos(rango),
    obtenerKpisConversion(rango),
    obtenerKpisRetencion(rango),
    obtenerKpisEconomicos(rango),
    obtenerAlarmasActivas(),
  ]);

  return (
    <DashboardView
      kpis={{ captacion, productos, conversion, retencion, economicos }}
      alarmas={alarmas}
      rango={rango}
    />
  );
}
```

### KPIs y targets canónicos

Definidos en el plan de negocios v3.1:

| Categoría | KPI | Target | Si <target |
|---|---|---|---|
| Captación | Visitantes únicos / mes | 30k+ post-launch | Verde si crece, Ámbar si plano, Rojo si decrece |
| Captación | Registros nuevos / mes | 1,500+ | Igual |
| Captación | Tasa rebote | <60% | Verde si <60%, Ámbar 60-70%, Rojo >70% |
| Captación | Conv. visita→registro | 4%+ | Verde si ≥4%, Ámbar 2-4%, Rojo <2% |
| Productos | Vistas de partido / día | 1k+ | Verde si crece |
| Productos | Predicciones / partido top | 100+ | Verde si ≥100 |
| Productos | Cross-link B↔C | 25%+ | Verde si ≥25% |
| Productos | Tipsters activos / mes | 30%+ | Verde si ≥30% del total |
| Conversión | CTR site-wide afiliados | 5%+ | Verde si ≥5% |
| Conversión | Click→Registro casa | 25%+ | Verde si ≥25% |
| Conversión | Registro→FTD | 25%+ | Verde si ≥25% |
| Conversión | Free→Premium | 1%+ | Verde si ≥1% |
| Retención | MRR Premium | growth+ | Verde si crece MoM |
| Retención | Churn mensual | <20% | Verde si <20% |
| Retención | DAU/MAU ratio | 15%+ | Verde si ≥15% |
| Retención | Engagement Channel | 80%+ | Verde si ≥80% lecturas/envíos |
| Económicos | Revenue mes | growth+ | Verde si crece MoM |
| Económicos | Margen operativo | 60%+ | Verde si ≥60% |
| Económicos | CAC | <S/50 | Verde si <S/50 |
| Económicos | LTV/CAC | 3x+ | Verde si ≥3x |

### Estructura de retorno de cada función `obtenerKpis...`

```typescript
interface KPI {
  id: string;
  label: string;
  valor: number | string;
  formato: 'number' | 'percent' | 'currency_pen' | 'multiplier';
  target: number;
  status: 'good' | 'amber' | 'red';  // Calculado server-side comparando vs target
  tendenciaPct?: number;  // % de cambio vs periodo anterior
  tendenciaDir?: 'up' | 'down' | 'flat';
}

interface KpisGrupo {
  titulo: string;
  kpis: KPI[];
}
```

## Estados de UI

### Estructura

```
┌────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar (Inicio · Dashboard)        [Export ▾]│
├─────────┴──────────────────────────────────────────────┤
│ <AdminPageHeader>                                       │
│  Title: Dashboard                                       │
│  Desc: Vista global · Última actualización hace 5 min   │
│  Actions: <RangoSelector> [Exportar reporte]            │
├─────────────────────────────────────────────────────────┤
│ <AlarmaBanner> (si hay alarmas activas)                │
├─────────────────────────────────────────────────────────┤
│ Sección "📥 Captación"                                  │
│   ┌─────┬─────┬─────┬─────┐                            │
│   │ KPI │ KPI │ KPI │ KPI │                            │
│   └─────┴─────┴─────┴─────┘                            │
├─────────────────────────────────────────────────────────┤
│ Sección "⚽ Productos B y C"                            │
│   ┌─────┬─────┬─────┬─────┐                            │
│   │ KPI │ KPI │ KPI │ KPI │                            │
│   └─────┴─────┴─────┴─────┘                            │
├─────────────────────────────────────────────────────────┤
│ Sección "💰 Conversión"                                 │
│   ┌─────┬─────┬─────┬─────┐                            │
│   │ KPI │ KPI │ KPI │ KPI │                            │
│   └─────┴─────┴─────┴─────┘                            │
├─────────────────────────────────────────────────────────┤
│ Sección "🔁 Retención"                                  │
│   ┌─────┬─────┬─────┬─────┐                            │
│   │ KPI │ KPI │ KPI │ KPI │                            │
│   └─────┴─────┴─────┴─────┘                            │
├─────────────────────────────────────────────────────────┤
│ Sección "📈 Económicos"                                 │
│   ┌─────┬─────┬─────┬─────┐                            │
│   │ KPI │ KPI │ KPI │ KPI │                            │
│   └─────┴─────┴─────┴─────┘                            │
└─────────────────────────────────────────────────────────┘
```

### Variantes según rango

- "Últimos 7 días": KPIs con tendencia vs semana anterior.
- "Últimos 30 días": tendencia vs mes anterior.
- "Mes en curso": tendencia vs mismo periodo del mes pasado.
- "Mes anterior": cerrado, sin tendencia.

### Loading / Error

- Server component → render directo después de Promise.all.
- Si una query falla: KPI muestra estado "—" en valor + status="red" con tooltip "Error cargando".
- Otros KPIs renderizan normalmente (graceful).

## Componentes que reutiliza

- `<AdminSidebar>`, `<AdminTopbar>`, `<AdminPageHeader>` (Lote F · 00-layout).
- `<AdminCard>` (Lote F).
- Tokens admin (Lote A).

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- Desktop-only.
- Cache de KPIs en Redis con TTL 5 min (queries pesadas a BD).
- Cero hex hardcodeados.
- Eventos analíticos:
  - `admin_dashboard_visto` en mount (NUEVO Lote F).
  - `admin_kpi_drill_down` cuando click en un KPI card → navega a vista de detalle (NUEVO Lote F).
  - `admin_alarma_clickeada` cuando click en alarma del banner (NUEVO Lote F).

## Mockup de referencia

`dashboard.html` en este mismo folder.

También ver `00-design-system/mockup-actualizado.html` sección "08 · Pista admin · Dashboard de KPIs" como referencia secundaria.

## Pasos manuales para Gustavo post-deploy

Ninguno.

**Validación post-deploy:**
1. Logueado como ADMIN, abrir `hablaplay.com/admin/dashboard` desde laptop.
2. Verificar las 5 secciones de KPIs con números reales.
3. Verificar semáforo (verde/ámbar/rojo) según los targets.
4. Verificar tendencia ↗/↘ con % vs periodo anterior.
5. Probar cambio de rango: "Últimos 7d" → "Últimos 30d" → re-render con nuevos números.
6. Si hay alarmas activas: verificar banner rojo arriba.
7. Click en alarma → navega a `/admin/alarmas` (Lote G).
8. Click en un KPI card → navega a `/admin/kpis?metric=...` (Lote G).

---

*Versión 1 · Abril 2026 · Dashboard admin para Lote F*
