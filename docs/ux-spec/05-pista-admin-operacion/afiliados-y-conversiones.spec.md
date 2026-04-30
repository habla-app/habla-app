# Afiliados y Conversiones admin

Vistas admin para gestionar las casas afiliadas y revisar las conversiones (FTDs reportados). Refactor visual del Lote 7 + adaptación al sidebar nuevo del Lote F.

## Lote responsable

**Lote F** — Admin desktop operación.

## Vistas cubiertas

| Vista | Ruta | Función |
|---|---|---|
| Listing afiliados | `/admin/afiliados` | Lista todos los afiliados con sus stats |
| Crear afiliado | `/admin/afiliados/nuevo` | Form para agregar casa nueva |
| Detalle afiliado | `/admin/afiliados/[id]` | Stats + edición + clicks + conversiones de la casa |
| Conversiones | `/admin/conversiones` | Lista de FTDs reportados con filtros |

## Estado actual del repo

- `apps/web/app/admin/afiliados/page.tsx` (Lote 7): listing con tabla.
- `apps/web/app/admin/afiliados/nuevo/page.tsx` (Lote 7): form crear.
- `apps/web/app/admin/afiliados/[id]/page.tsx` (Lote 7): detalle.
- `apps/web/app/admin/conversiones/page.tsx` (Lote 7): tabla de conversiones.
- `apps/web/lib/services/afiliacion.service.ts` (Lote 7): CRUD + métricas.

## Cambios necesarios

Refactor visual mobile-friendly → desktop-only del Lote F + agregado de gráficas de tendencia y stats agregados.

### Archivos a modificar

- `apps/web/app/admin/afiliados/page.tsx`:
  - Mantener queries existentes.
  - Agregar `<AfiliadosStatsAggregadas>` arriba de la tabla.
  - Refactor visual al patrón Lote F (sidebar + topbar).
  - Agregar gráfica de "Clicks/día últimos 30 días" inline.

- `apps/web/app/admin/afiliados/[id]/page.tsx`:
  - Mantener form de edición.
  - Agregar gráficas de tendencia: clicks/día, conversiones/día últimos 90 días.
  - Agregar tabla de últimas 100 conversiones con detalle.
  - Agregar sección "Estado MINCETUR": último check (Lote 10) + botón "Re-verificar manualmente".

- `apps/web/app/admin/afiliados/nuevo/page.tsx`:
  - Refactor visual al patrón Lote F.
  - Form sin cambios estructurales.

- `apps/web/app/admin/conversiones/page.tsx`:
  - Refactor visual.
  - Agregar filtros: por casa, por rango fechas, por estado (REPORTADO / VERIFICADO / RECHAZADO).
  - Agregar gráfica de conversiones/día últimos 30 días.
  - Agregar export CSV.

- `apps/web/components/admin/afiliados/AfiliadosTabla.tsx` (si existe del Lote 7):
  - Refactor con `<AdminTable>` del Lote F.
  - Columnas: Logo · Nombre · Slug · Estado · Clicks 7d · Conv 7d · Rate · Acciones.

### Archivos a crear

- `apps/web/components/admin/afiliados/AfiliadosStatsAggregadas.tsx`:
  - 4 cards con stats globales:
    - Total afiliados activos
    - Clicks total último mes
    - Conversiones último mes
    - Conversion rate promedio (clicks → FTD)

- `apps/web/components/admin/afiliados/AfiliadoStatsDetail.tsx`:
  - Component para `/admin/afiliados/[id]` con:
    - 6 cards: clicks 7d, clicks 30d, conv 7d, conv 30d, rate 30d, ingresos estimados 30d.
    - 2 gráficas line (clicks/día y conv/día) últimos 90 días.

- `apps/web/components/admin/afiliados/EstadoMincetur.tsx`:
  - Card con info del último check MINCETUR:
    - Última verificación: hace X días
    - Estado: Activa / Vencida / No encontrada
    - Próxima verificación automática: en X días (cron Lote 10)
    - Botón "Re-verificar manualmente" (server action)

- `apps/web/components/admin/conversiones/ConversionesFilters.tsx`:
  - Search bar + chips estado + selector rango.
  - URL params para state.

- `apps/web/components/admin/conversiones/ConversionesTable.tsx`:
  - Tabla densa con columnas:
    - Fecha · Casa · Usuario (email) · Cookie ID · Estado · Acciones (verificar / rechazar)

### Archivos a eliminar

Ninguno. Solo refactor.

## Datos requeridos

```typescript
// apps/web/app/admin/afiliados/page.tsx
export default async function AfiliadosListPage() {
  const [stats, afiliados, clicksUltimos30d] = await Promise.all([
    obtenerStatsAfiliadosAgregadas(),
    listarTodosAfiliados(),
    obtenerClicksUltimos30dGlobal(),
  ]);
  return <AfiliadosListView stats={stats} afiliados={afiliados} chartData={clicksUltimos30d} />;
}
```

```typescript
// apps/web/app/admin/conversiones/page.tsx
interface Props {
  searchParams?: { casa?: string; estado?: string; from?: string; to?: string; page?: string };
}

export default async function ConversionesPage({ searchParams }: Props) {
  const filtros = { /* ... */ };
  const [stats, conversiones, chartData] = await Promise.all([
    obtenerStatsConversiones(filtros),
    listarConversiones(filtros),
    obtenerConversionesUltimos30d(),
  ]);
  return <ConversionesView stats={stats} conversiones={conversiones} chartData={chartData} filtros={filtros} />;
}
```

## Estados de UI

### `/admin/afiliados` listing

```
┌────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar (Operación · Afiliados)               │
├─────────┴──────────────────────────────────────────────┤
│ <AdminPageHeader>                                       │
│  Title: Afiliados                                       │
│  Desc: Gestión de casas autorizadas                     │
│  Actions: [+ Nueva casa]                                │
├─────────────────────────────────────────────────────────┤
│ <AfiliadosStatsAggregadas> 4 cards                      │
├─────────────────────────────────────────────────────────┤
│ <ClicksDiariosChart> últimos 30d                        │
├─────────────────────────────────────────────────────────┤
│ <AfiliadosTabla>                                        │
└─────────────────────────────────────────────────────────┘
```

### `/admin/afiliados/[id]` detalle

```
┌────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar (Afiliados · Betano)                  │
├─────────┴──────────────────────────────────────────────┤
│ <AdminPageHeader>                                       │
│  Title: Betano                                          │
│  Desc: Slug · Activa · Verificada MINCETUR              │
├─────────────────────────────────────────────────────────┤
│ <AfiliadoStatsDetail> 6 cards                           │
├─────────────────────────────────────────────────────────┤
│ Charts (clicks/día + conversiones/día) 90 días          │
├─────────────────────────────────────────────────────────┤
│ <EstadoMincetur>                                        │
├─────────────────────────────────────────────────────────┤
│ Form de edición + Últimas 100 conversiones              │
└─────────────────────────────────────────────────────────┘
```

### `/admin/conversiones`

Similar a `/admin/suscripciones` pero más simple (sin detalles individuales — solo lista).

### Estados de afiliado

- **Activa + MINCETUR OK** → row verde, sin warnings.
- **Activa + MINCETUR vencida** → row con borde rojo + warning, status Lote 10.
- **Inactiva** → row gris, no aparece en pista pública.

### Estados de conversión

- **REPORTADO** (default): pendiente de verificar.
- **VERIFICADO**: admin confirmó que la casa pagó la comisión.
- **RECHAZADO**: la casa no acreditó (ej: usuario duplicado o fraude).

### Loading

- Server component → render directo.

## Componentes que reutiliza

- `<AdminSidebar>`, `<AdminTopbar>`, `<AdminPageHeader>`, `<AdminCard>`, `<AdminTable>` (Lote F).
- Recharts (Lote 6).

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- Desktop-only.
- Cache de stats con TTL 5 min.
- Eventos analíticos:
  - `admin_afiliado_creado` (NUEVO Lote F).
  - `admin_afiliado_editado` (NUEVO Lote F).
  - `admin_conversion_verificada` (NUEVO Lote F).
  - `admin_mincetur_reverificado_manual` (NUEVO Lote F).

## Mockup de referencia

Sin mockup individual. Patrón visual idéntico a `dashboard.html` del 6A + tabla densa.

## Pasos manuales para Gustavo post-deploy

Ninguno. Es refactor del Lote 7 con servicios existentes.

**Validación post-deploy:**
1. Abrir `hablaplay.com/admin/afiliados`.
2. Verificar stats agregados + gráfica + tabla.
3. Click en una casa → detalle con stats individuales.
4. Click "Re-verificar MINCETUR" → cron del Lote 10 corre manualmente.
5. Abrir `/admin/conversiones`.
6. Probar filtros + paginación.
7. Verificar exports a CSV funciona.

---

*Versión 1 · Abril 2026 · Afiliados y Conversiones admin para Lote F*
