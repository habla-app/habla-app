# Cohortes `/admin/cohortes`

Vista de análisis de cohortes mensuales: agrupa usuarios por mes de registro y mide su comportamiento a lo largo del tiempo (FTD, conversión a Premium, churn). Es la herramienta clave para entender si los nuevos usuarios mejoran o empeoran cohorte tras cohorte.

## Lote responsable

**Lote G** — Admin desktop análisis.

## Estado actual del repo

NUEVA — sin sistema de cohortes.

## Cambios necesarios

### Decisión arquitectónica

Una **cohorte** es un grupo de usuarios que comparten una característica temporal (ej: "todos los registrados en marzo 2026"). El análisis de cohortes responde:

- ¿Los usuarios de marzo se vuelven Premium más rápido que los de febrero?
- ¿El churn de la cohorte de enero es peor que el de febrero?
- ¿Una campaña de marketing en marzo mejoró la conversión a FTD?

El **funnel canónico** de Habla! (definido en plan v3.1) es:

```
Registro → Predicción 1ra → FTD reportado → Premium
```

Cada cohorte mensual se mide en cada etapa, día por día (Day 0 = registro, Day 1 = un día después, etc).

### Archivos a crear

- `apps/web/app/admin/cohortes/page.tsx`:
  - Server component con grid de cohortes.
  - URL params: `?metric=ftd|premium|prediccion` para cambiar la métrica medida.

- `apps/web/components/admin/cohortes/CohorteHeatmap.tsx`:
  - Heatmap visual con:
    - Filas: cohortes (último año por mes).
    - Columnas: días desde registro (Day 0, 7, 14, 30, 60, 90).
    - Celdas: % de la cohorte que llegó a la etapa medida en ese día.
    - Color del celda: gradient verde (alto %) → ámbar → rojo (bajo %).
  - Tooltip al hover con valores absolutos.

- `apps/web/components/admin/cohortes/MetricSelector.tsx`:
  - Tabs para cambiar la métrica:
    - Predicción (1ra predicción del usuario)
    - FTD (1er First Time Deposit reportado)
    - Premium (1ra suscripción Premium)
    - Activo (DAU en el período)

- `apps/web/components/admin/cohortes/CohorteResumenCards.tsx`:
  - 3 cards con conclusiones del análisis:
    - **Mejor cohorte:** "Marzo 2026 con X% conversión a FTD en Day 30"
    - **Peor cohorte:** "Diciembre 2025 con Y% (posible: temporada navideña)"
    - **Tendencia:** "↗ +5pts en últimos 3 meses" o "↘ -3pts"

- `apps/web/components/admin/cohortes/CohorteDetalleModal.tsx`:
  - Modal al click en una fila del heatmap:
    - Muestra el funnel completo de esa cohorte
    - Lista de top 10 usuarios más activos de la cohorte
    - Source de tráfico de la cohorte (organic / social / etc)

- `apps/web/components/admin/cohortes/CohorteSegmentos.tsx`:
  - Sub-grid abajo del heatmap principal para comparar segmentos:
    - Por source de tráfico (organic vs social vs paid)
    - Por canal del primer click (home vs blog vs partido)
    - Por edad del usuario
  - Útil para identificar qué segmentos convierten mejor.

### Servicios

- `apps/web/lib/services/cohortes.service.ts`:
  - `obtenerCohortesMensuales(metric, ultimosN=12)` que devuelve:
    ```typescript
    {
      cohortes: [
        {
          mes: '2026-03',
          totalUsuarios: 450,
          conversiones: {
            day0: 350,    // Registros completados ese día
            day1: 142,    // Hicieron predicción día siguiente
            day7: 87,
            day14: 67,
            day30: 45,
            day60: 38,
            day90: 32,
          },
          source: { organic: 60, social: 25, paid: 15 },
        },
        // ...
      ]
    }
    ```
  - Query pesada — cache TTL 30 min en Redis.

### Archivos a modificar

Ninguno.

## Datos requeridos

```typescript
// apps/web/app/admin/cohortes/page.tsx
export const dynamic = 'force-dynamic';

interface Props {
  searchParams?: { metric?: string };
}

export default async function CohortesPage({ searchParams }: Props) {
  const metric = searchParams?.metric ?? 'ftd';

  const [cohortes, segmentos] = await Promise.all([
    obtenerCohortesMensuales(metric, 12),
    obtenerCohortesPorSegmento(metric),
  ]);

  return <CohortesView cohortes={cohortes} segmentos={segmentos} metric={metric} />;
}
```

## Estados de UI

### Estructura

```
┌────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar (Análisis · Cohortes)                 │
├─────────┴──────────────────────────────────────────────┤
│ <AdminPageHeader>                                       │
│  Title: Análisis de Cohortes                            │
│  Desc: Comportamiento de usuarios agrupados por mes     │
│  Actions: <MetricSelector> [Exportar CSV]               │
├─────────────────────────────────────────────────────────┤
│ <CohorteResumenCards> 3 cards                           │
├─────────────────────────────────────────────────────────┤
│ <CohorteHeatmap>                                        │
│  Cohorte    │ D0  │ D1  │ D7  │ D14 │ D30 │ D60 │ D90  │
│  ─────────────────────────────────────────────────────  │
│  Abr 26 (en curso) │ 78% │ 32% │ ... │ ... │ ... │ ...│
│  Mar 26 (450 usr)  │ 78% │ 32% │ 19% │ 15% │ 10% │ 8% │ 7% │
│  Feb 26 (380 usr)  │ 79% │ 31% │ 18% │ 14% │ 9%  │ 7% │ 6% │
│  Ene 26 (320 usr)  │ 76% │ 28% │ 16% │ 12% │ 8%  │ 6% │ 5% │
│  Dic 25 (290 usr)  │ 72% │ 24% │ 14% │ 10% │ 6%  │ 5% │ 4% │
│  ...                                                    │
├─────────────────────────────────────────────────────────┤
│ <CohorteSegmentos> sub-grid por source                  │
└─────────────────────────────────────────────────────────┘
```

### Heatmap colors

- Verde fuerte (`bg-green-600`): celda en top 25% del periodo.
- Verde claro: 25-50%.
- Amber: 50-75%.
- Rojo claro: 75-90%.
- Rojo fuerte: bottom 10%.

(Percentiles relativos, no absolutos — un 5% de conversión a Premium puede ser "verde" si es el mejor de las cohortes mostradas.)

### Estado "cohorte en curso"

La cohorte del mes actual está incompleta (no tiene Day 30 si aún no pasaron 30 días). Mostrar las celdas futuras como "—" en gris.

### Loading / Error

- Server component → render directo.
- Si falta data de algún mes (cohorte muy pequeña <10 usuarios): mostrar "—" en lugar de %.

## Componentes que reutiliza

- `<AdminSidebar>`, `<AdminTopbar>`, `<AdminPageHeader>` (Lote F).
- `<AdminCard>` (Lote F).
- Recharts no aplica para heatmap — usar implementación custom con CSS Grid.

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- Desktop-only.
- Cache TTL 30 min (queries pesadas).
- **Privacy** en `<CohorteDetalleModal>`: top 10 usuarios mostrados solo con username/email truncado, no PII completa.
- Eventos analíticos:
  - `admin_cohortes_visto` (NUEVO Lote G).
  - `admin_cohorte_drill_down` (NUEVO Lote G).

## Mockup de referencia

Sin mockup individual. Heatmap es el componente visual clave — implementación con CSS Grid.

## Pasos manuales para Gustavo post-deploy

Ninguno.

**Validación post-deploy:**
1. Abrir `hablaplay.com/admin/cohortes`.
2. Verificar heatmap con 12 meses de cohortes.
3. Cambiar métrica (Predicción → FTD → Premium).
4. Click en una fila → modal con detalles.
5. Verificar que cohorte del mes actual muestra "—" en columnas futuras.

---

*Versión 1 · Abril 2026 · Cohortes para Lote G*
