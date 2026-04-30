# KPIs detallado `/admin/kpis`

Vista de drill-down individual por KPI. Desde el dashboard del Lote F, click en cualquier KPI card lleva aquí con `?metric=<id>` para ver tendencia histórica, breakdown por dimensión, comparación contra targets, y posibles causas de variación.

## Lote responsable

**Lote G** — Admin desktop análisis.

## Estado actual del repo

NUEVA — esta vista no existe. Depende del sistema de KPIs definido en `dashboard.spec.md` del Lote F.

## Cambios necesarios

### Archivos a crear

- `apps/web/app/admin/kpis/page.tsx`:
  - Server component que carga KPI activo según `?metric=<id>` con sus datos históricos.
  - Si no `?metric=` → muestra grid con todos los KPIs disponibles para selección.

- `apps/web/components/admin/kpis/KPISelectorGrid.tsx`:
  - Grid 4 columnas con todos los KPIs agrupados por categoría (Captación / Productos / Conversión / Retención / Económicos).
  - Click en uno → navega a `?metric=<id>`.

- `apps/web/components/admin/kpis/KPIDetailView.tsx`:
  - Vista de detalle con 5 secciones:
    1. **Header KPI:** label + valor actual + status semáforo + target + tendencia
    2. **Historico chart:** línea temporal últimos 90 días (default) con toggle 7d/30d/90d/365d
    3. **Breakdown:** desglose por dimensión relevante (ej: vistas de partido por liga, conversión por casa)
    4. **Comparación contra periodo anterior:** dual line chart
    5. **Posibles causas y acciones:** sección curada con tips para mejorar el KPI

- `apps/web/components/admin/kpis/KPIChart.tsx`:
  - Componente Recharts con línea temporal del KPI.
  - Target line horizontal en color del status (verde/ámbar/rojo).
  - Tooltip con valor + fecha al hover.

- `apps/web/components/admin/kpis/BreakdownTabla.tsx`:
  - Tabla con desglose por dimensión:
    - Para "Conversión Click→Registro casa": casas en filas, % conversión por casa
    - Para "Predicciones por partido top": ligas en filas, predicciones promedio
    - Etc

- `apps/web/components/admin/kpis/AccionesSugeridas.tsx`:
  - Card con tips contextuales según el KPI:
    - Si KPI es ROJO: lista de posibles causas + 2-3 acciones recomendadas
    - Si AMBER: lista corta de "vigilar"
    - Si VERDE: copy "Sigue así, monitoreo regular"

### Servicios

- `apps/web/lib/services/analytics.service.ts`:
  - Agregar `obtenerKPIDetalle(metricId, rango)` que devuelve:
    ```typescript
    {
      meta: { label, target, formato, status },
      historico: [{ fecha, valor }],
      breakdown: [{ dimension, valor, contribucionPct }],
      comparacionPeriodoAnterior: [{ fecha, actual, anterior }]
    }
    ```

### Archivos a modificar

Ninguno. Es vista nueva.

## Datos requeridos

```typescript
// apps/web/app/admin/kpis/page.tsx
export const dynamic = 'force-dynamic';

interface Props {
  searchParams?: { metric?: string; rango?: string };
}

export default async function KPIsAdminPage({ searchParams }: Props) {
  const metricId = searchParams?.metric;
  const rango = searchParams?.rango ?? '90d';

  if (!metricId) {
    // Mostrar grid de selección
    const todosKpis = await obtenerListadoKPIs();
    return <KPISelectorView kpis={todosKpis} />;
  }

  const detalle = await obtenerKPIDetalle(metricId, rango);
  return <KPIDetailView detalle={detalle} rango={rango} />;
}
```

### KPIs disponibles (ID → función)

Los IDs son los mismos del dashboard (Lote F):

| ID | Categoría | Breakdown principal |
|---|---|---|
| `visitantes_unicos_mes` | Captación | Source: organic / social / direct / referral |
| `registros_nuevos_mes` | Captación | Origen: home / blog / partido / referido |
| `tasa_rebote` | Captación | Página de entrada |
| `conversion_visita_registro` | Captación | Source de tráfico |
| `vistas_partido_dia` | Productos | Liga |
| `predicciones_partido_top` | Productos | Liga + tipo partido |
| `cross_link_b_c` | Productos | Origen del click |
| `tipsters_activos_mes` | Productos | Nivel de actividad (1-5/5+/10+ predicciones) |
| `ctr_afiliados_global` | Conversión | Casa |
| `click_registro_casa` | Conversión | Casa + bono |
| `registro_ftd_casa` | Conversión | Casa |
| `free_premium` | Conversión | Source del registro |
| `mrr_premium` | Retención | Plan |
| `churn_mensual` | Retención | Plan + cohorte de mes |
| `dau_mau_ratio` | Retención | (no breakdown — métrica simple) |
| `engagement_channel` | Retención | Tipo de mensaje (pick / alerta / resumen) |
| `revenue_mes` | Económicos | Fuente: Premium / afiliación |
| `margen_operativo` | Económicos | Categoría de costo |
| `cac_promedio` | Económicos | Canal de adquisición |
| `ltv_cac` | Económicos | Cohorte |

## Estados de UI

### Grid selector (sin metric en URL)

```
┌────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar (Análisis · KPIs)                     │
├─────────┴──────────────────────────────────────────────┤
│ Sección "📥 Captación"                                  │
│   ┌─────┬─────┬─────┬─────┐                            │
│   │ KPI │ KPI │ KPI │ KPI │ click → drill-down         │
│   └─────┴─────┴─────┴─────┘                            │
├─────────────────────────────────────────────────────────┤
│ ... (otras 4 secciones similares)                       │
└─────────────────────────────────────────────────────────┘
```

### Detail view (con `?metric=...`)

```
┌────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar (Análisis · KPIs · Conversión Click→Reg)│
├─────────┴──────────────────────────────────────────────┤
│ <KPIHeader>                                             │
│  ● Conversión Click→Registro casa                       │
│  18% · status ROJO · target 25% · ↘ -7 pts vs mes ant.  │
├─────────────────────────────────────────────────────────┤
│ <KPIChart> 90 días con target line                      │
├─────────────────────────────────────────────────────────┤
│ <BreakdownTabla>                                        │
│  Casa   │ Clicks │ Registros │ % Conv │ ↑/↓             │
│  Betano │ 1,205  │   142     │ 11.8%  │ ↘ -3pts          │
│  Stake  │   872  │    98     │ 11.2%  │ ↘ -2pts          │
│  Betsson│   543  │    72     │ 13.3%  │ ↗ +1pt           │
├─────────────────────────────────────────────────────────┤
│ <ComparacionAnterior> dual line chart                   │
├─────────────────────────────────────────────────────────┤
│ <AccionesSugeridas>                                     │
│  🔴 Status ROJO. Posibles causas:                       │
│   • Tracking de bono Betano roto                        │
│   • Cookie de afiliación expirando antes de tiempo      │
│  Acciones recomendadas:                                 │
│   1. Verificar tracking integration con Betano          │
│   2. Probar registro con cookie clean                   │
│   3. Solicitar reporte de su panel afiliado             │
└─────────────────────────────────────────────────────────┘
```

### Loading / Error

- Server component → render directo.
- Cache de cada KPI con TTL 5-15 min según costo de query.

## Componentes que reutiliza

- `<AdminSidebar>`, `<AdminTopbar>`, `<AdminPageHeader>` (Lote F).
- `<AdminCard>`, `<AdminTable>` (Lote F).
- Recharts (Lote 6).

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- Desktop-only.
- Cache pesada con TTL 5-15 min.
- Eventos analíticos:
  - `admin_kpi_drill_down_visto` con metricId (NUEVO Lote G).
  - `admin_kpi_rango_cambiado` con nuevo rango (NUEVO Lote G).

## Mockup de referencia

Sin mockup individual. Patrón visual: dashboard del 6A + tabla densa + 1-2 charts grandes.

## Pasos manuales para Gustavo post-deploy

Ninguno.

**Validación post-deploy:**
1. Abrir `hablaplay.com/admin/kpis` (sin metric) → ver grid de selección.
2. Click en un KPI → navega a `?metric=...` con drill-down.
3. Cambiar rango (7d / 30d / 90d) → re-render con datos.
4. Verificar breakdown por dimensión.
5. Verificar acciones sugeridas según status.

---

*Versión 1 · Abril 2026 · KPIs detallado para Lote G*
