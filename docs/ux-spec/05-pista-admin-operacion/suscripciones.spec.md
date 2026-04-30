# Suscripciones admin `/admin/suscripciones`

Vista admin para gestionar las suscripciones Premium. Lista paginada con filtros, detalle de cada suscripción, gestión individual (reembolso, cancelación, cambio manual), historial de pagos.

## Lote responsable

**Lote F** — Admin desktop operación.

## Estado actual del repo

NUEVA — esta vista no existe. Depende de modelos `Suscripcion`, `PagoSuscripcion` creados en Lote E.

## Cambios necesarios

### Archivos a crear

- `apps/web/app/admin/suscripciones/page.tsx`:
  - Server component con lista paginada de suscripciones.
  - Filtros vía URL params: `?estado=ACTIVA|CANCELANDO|VENCIDA`, `?plan=mensual|trimestral|anual`, `?q=email_o_nombre`.

- `apps/web/app/admin/suscripciones/[id]/page.tsx`:
  - Vista de detalle de una suscripción específica.
  - Server component que carga suscripción + pagos + usuario + historial de eventos.

- `apps/web/components/admin/suscripciones/SuscripcionesStats.tsx`:
  - Grid 4 cards con stats agregados:
    - Total activas
    - MRR total (suma de precios mensualizados)
    - Cancelando este mes
    - Vencidas/fallidas último mes

- `apps/web/components/admin/suscripciones/FiltrosBar.tsx`:
  - Search bar + chips de estado + chips de plan + selector de rango.
  - Estado en URL params para compartir/bookmark.

- `apps/web/components/admin/suscripciones/SuscripcionesTabla.tsx`:
  - Tabla densa con columnas:
    - Email · Nombre · Plan · Estado · Iniciada · Próximo cobro · MRR · Acciones (botón "Ver detalle →")
  - Sortable por columnas (click header).
  - Paginación 50 por página.
  - Selección múltiple para acciones masivas (ej: enviar email a un subset).

- `apps/web/components/admin/suscripciones/SuscripcionDetalle.tsx`:
  - 4 secciones en `/admin/suscripciones/[id]`:
    - **Header:** datos del usuario + estado + plan + fecha
    - **Stats:** MRR, días totales activo, total pagado histórico, # de pagos
    - **Historial de pagos:** tabla con cada `PagoSuscripcion`
    - **Acciones admin:** botones (cancelar inmediato, procesar reembolso garantía, cambiar plan manual, ver en OpenPay dashboard)

- `apps/web/components/admin/suscripciones/AccionReembolsoModal.tsx`:
  - Modal de confirmación para reembolso:
    - Verifica si está en garantía (7 días).
    - Si NO: warning "Fuera de garantía. ¿Reembolsar igual?" (override admin posible).
    - Campo motivo (texto libre).
    - Botón "Confirmar reembolso" → llama `reembolsarEnGarantia(id)` o `reembolsarManual(id, motivo)`.

- `apps/web/components/admin/suscripciones/AccionCancelacionModal.tsx`:
  - Modal de confirmación para cancelación inmediata (override del flow normal):
    - Warning: "Esto cancela en OpenPay y remueve acceso ahora. ¿Estás seguro?"
    - Campo motivo (texto libre).

### Servicios

- `apps/web/lib/services/suscripciones.service.ts`:
  - Agregar función `listarSuscripciones(opts)` con paginación + filtros.
  - Agregar función `obtenerDetalleSuscripcion(id)` con join a usuario + pagos.
  - Función `cancelarInmediato(id, motivo)` — distinto a la cancelación normal del Lote E (que mantiene acceso hasta vencimiento).
  - Función `reembolsarManual(id, motivo)` — override de garantía.

### Archivos a modificar

Ninguno.

## Datos requeridos

```typescript
// apps/web/app/admin/suscripciones/page.tsx
export const dynamic = 'force-dynamic';

interface Props {
  searchParams?: { estado?: string; plan?: string; q?: string; page?: string };
}

export default async function SuscripcionesAdminPage({ searchParams }: Props) {
  const filtros = {
    estado: searchParams?.estado,
    plan: searchParams?.plan,
    q: searchParams?.q,
    page: parseInt(searchParams?.page ?? '1', 10),
    pageSize: 50,
  };

  const [stats, suscripciones] = await Promise.all([
    obtenerStatsSuscripciones(),
    listarSuscripciones(filtros),
  ]);

  return <SuscripcionesView stats={stats} suscripciones={suscripciones} filtros={filtros} />;
}
```

```typescript
// apps/web/app/admin/suscripciones/[id]/page.tsx
export const dynamic = 'force-dynamic';

export default async function SuscripcionDetallePage({ params }: { params: { id: string } }) {
  const detalle = await obtenerDetalleSuscripcion(params.id);
  if (!detalle) notFound();

  return <SuscripcionDetalleView detalle={detalle} />;
}
```

## Estados de UI

### Listing `/admin/suscripciones`

```
┌────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar (Operación · Suscripciones)           │
├─────────┴──────────────────────────────────────────────┤
│ <AdminPageHeader>                                       │
│  Title: Suscripciones                                   │
│  Desc: Gestión de Premium · 847 activas · MRR S/ 41.5K  │
│  Actions: [Exportar CSV]                                │
├─────────────────────────────────────────────────────────┤
│ <SuscripcionesStats> 4 cards                            │
├─────────────────────────────────────────────────────────┤
│ <FiltrosBar>                                            │
│  [Search] · [Estado: Todos ▾] · [Plan: Todos ▾]         │
├─────────────────────────────────────────────────────────┤
│ <SuscripcionesTabla>                                    │
│  Email │ Nombre │ Plan │ Estado │ Iniciada │ Próx │ ... │
│  ───────────────────────────────────────────────────    │
│  juan@ │ Juan M │ Anual│ Activa │ 30 abr   │30/abr│ →   │
│  ana@  │ Ana R  │ Mens │ Cancel.│ 15 mar   │ —    │ →   │
│  ...                                                    │
├─────────────────────────────────────────────────────────┤
│ Pagination · Mostrando 1-50 de 847 [<] [1] [2]...[18][>]│
└─────────────────────────────────────────────────────────┘
```

### Detalle `/admin/suscripciones/[id]`

```
┌────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar (Suscripciones · Juan Martínez)       │
├─────────┴──────────────────────────────────────────────┤
│ <Header>                                                │
│  Avatar + Nombre + Email                                │
│  Badge: Activa · Plan Anual · Próximo cobro: 30 abr 27  │
├─────────────────────────────────────────────────────────┤
│ <Stats> 4 cards (MRR, días activo, total pagado, #pagos)│
├─────────────────────────────────────────────────────────┤
│ <HistorialPagos>                                        │
│  Tabla con todos los PagoSuscripcion del usuario        │
├─────────────────────────────────────────────────────────┤
│ <AccionesAdmin>                                         │
│  [Cancelar inmediato] [Reembolsar] [Cambiar plan]       │
│  [Abrir en OpenPay dashboard ↗]                         │
└─────────────────────────────────────────────────────────┘
```

### Estados según contexto

- Suscripción activa → muestra todas las acciones.
- Suscripción CANCELANDO → solo "Reactivar" + "Reembolsar".
- Suscripción VENCIDA / FALLIDA → solo "Renovar" + "Reembolsar último pago".

### Loading

- Server component → render directo.
- Cache de stats con TTL 1 min.

### Empty

- Si filtros producen 0 resultados: "Sin suscripciones que coincidan con los filtros".

## Componentes que reutiliza

- `<AdminSidebar>`, `<AdminTopbar>`, `<AdminPageHeader>`, `<AdminCard>`, `<AdminTable>` (Lote F).
- `<Modal>` del design system.
- Servicios del Lote E (`suscripciones.service.ts`).

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- Desktop-only.
- **Confirmación obligatoria** en acciones destructivas (cancelar inmediato, reembolso fuera de garantía).
- **Logs de auditoría** en cada acción admin: quién, cuándo, qué cambió. Visible en `/admin/auditoria` (Lote G).
- **Idempotencia** en cancelaciones/reembolsos (chequear estado actual antes de procesar).
- Eventos analíticos:
  - `admin_suscripcion_cancelada_manual` (NUEVO Lote F)
  - `admin_reembolso_procesado` (NUEVO Lote F)
  - `admin_plan_cambiado` (NUEVO Lote F)

## Mockup de referencia

Sin mockup individual. Patrón visual: tabla densa estilo Lote 5/6 + detalle estilo `picks-premium.html` del 6A pero con stats cards arriba.

## Pasos manuales para Gustavo post-deploy

Ninguno. Es código frontend reutilizando services del Lote E.

**Validación post-deploy:**
1. Logueado como ADMIN, abrir `hablaplay.com/admin/suscripciones`.
2. Verificar stats con números reales.
3. Probar filtros de estado y plan.
4. Probar buscador (typing busca por email/nombre).
5. Click en una row → ir a detalle.
6. Probar reembolso de testing (con tarjeta de testing).
7. Verificar que se actualiza estado en BD + webhook OpenPay procesa el reembolso.
8. Verificar entry en `/admin/auditoria`.

---

*Versión 1 · Abril 2026 · Suscripciones admin para Lote F*
