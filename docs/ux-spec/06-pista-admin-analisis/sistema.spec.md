# Sistema · Logs + Auditoría + Usuarios

3 vistas auxiliares del panel admin para troubleshooting, compliance y gestión interna. Se consolidan en un spec para ahorrar tokens — todas siguen patrones idénticos del Lote F.

## Lote responsable

**Lote G** — Admin desktop análisis.

## Vistas cubiertas

| Vista | Ruta | Función |
|---|---|---|
| Logs | `/admin/logs` | Listing de errores y eventos del sistema |
| Auditoría | `/admin/auditoria` | Trail de acciones admin (compliance) |
| Usuarios | `/admin/usuarios` | Gestión interna de usuarios (búsqueda, ban, edición de rol) |

## Estado actual del repo

- `apps/web/app/admin/logs/page.tsx` (Lote 6): listing de errores con filtros básicos.
- `apps/web/lib/services/logs.service.ts` (Lote 6): query a `LogError`.
- `apps/web/app/admin/usuarios/page.tsx` (existe): búsqueda básica.
- `apps/web/app/admin/leaderboard/page.tsx` (Lote 5): gestión leaderboard manual (ya está bien, sin cambios).
- Sin vista `/admin/auditoria` — se crea desde cero.

## Cambios necesarios

### Vista 1: `/admin/logs`

Refactor visual del Lote 6 + filtros mejorados.

**Archivos a modificar:**

- `apps/web/app/admin/logs/page.tsx`:
  - Mantener queries a `LogError`.
  - Refactor visual al patrón Lote F.
  - Filtros: severidad (info / warn / error / fatal), source (api / cron / webhook), rango fechas.
  - Tabla con columnas: timestamp · severidad · source · mensaje · userId opcional · acciones.
  - Click en row → modal con stack trace completo + contexto.

**Archivos a crear:**

- `apps/web/components/admin/logs/LogDetailModal.tsx`:
  - Modal con stack trace + contexto JSON formateado.
  - Botón "Copiar al clipboard" para troubleshooting.

- `apps/web/components/admin/logs/LogsStats.tsx`:
  - 4 cards arriba: errores 24h / errores 7d / fatal 24h / source más frecuente.

### Vista 2: `/admin/auditoria` (NUEVA)

Trail completo de acciones administrativas para compliance y troubleshooting interno.

**Modelo Prisma nuevo:**

```prisma
model EntradaAuditoria {
  id            String    @id @default(cuid())
  adminId       String
  admin         Usuario   @relation(fields: [adminId], references: [id])
  accion        String                          // "premio.marcar_pagado" | "suscripcion.reembolsar" | etc
  recurso       String?                          // "premio_mensual:abc123"
  cambios       Json?                            // { antes: {...}, despues: {...} }
  contexto      Json?                            // request meta, IP, etc
  fecha         DateTime  @default(now())

  @@index([adminId, fecha])
  @@index([accion, fecha])
  @@map("entradas_auditoria")
}
```

**Helper para escribir entradas:**

```typescript
// apps/web/lib/services/auditoria.service.ts
export async function logAuditoria(input: {
  adminId: string;
  accion: string;
  recurso?: string;
  cambios?: { antes?: any; despues?: any };
  contexto?: any;
}) {
  await prisma.entradaAuditoria.create({ data: input });
}
```

**Cómo se invoca:**

Cada acción admin de Lote F llama `logAuditoria(...)` automáticamente:
- `aprobarPick` → `logAuditoria({ accion: 'pick_premium.aprobar', recurso: 'pick:abc123', ... })`
- `marcarPremioPagado` → `logAuditoria({ accion: 'premio.pagar', recurso: 'premio:xyz', cambios: { antes, despues } })`
- `reembolsarSuscripcion` → `logAuditoria({ accion: 'suscripcion.reembolsar', ... })`

**Vista:**

- `apps/web/app/admin/auditoria/page.tsx`:
  - Listing paginado con filtros: por admin, por acción, por rango.
  - Cada row: timestamp · admin · acción · recurso · "Ver cambios" link.
  - Click → modal con diff antes/después.

- `apps/web/components/admin/auditoria/CambiosDiffModal.tsx`:
  - Modal con vista diff (líneas verdes nuevas / rojas eliminadas / amarillas modificadas).
  - Formato JSON syntax highlight.

### Vista 3: `/admin/usuarios`

Refactor + funcionalidades nuevas.

**Archivos a modificar:**

- `apps/web/app/admin/usuarios/page.tsx`:
  - Search bar + tabla densa.
  - Columnas: avatar · nombre · username · email · rol · estado · fecha registro · acciones.
  - Filtros: rol (JUGADOR / ADMIN), estado (activo / banned / soft-deleted).

**Archivos a crear:**

- `apps/web/app/admin/usuarios/[id]/page.tsx`:
  - Detalle de usuario con secciones:
    - Header: avatar + datos básicos + estado
    - Stats: predicciones, % acierto, suscripción activa, FTDs reportados, etc.
    - Acciones admin: cambiar rol, banear, soft-delete (con confirmación).

- `apps/web/components/admin/usuarios/UsuarioAccionesModal.tsx`:
  - Modal con acciones: ban / cambiar rol / soft-delete.
  - Cada acción requiere motivo (logged en auditoría).

### Servicios

- `apps/web/lib/services/auditoria.service.ts`:
  - `logAuditoria()` — escribir.
  - `obtenerAuditoria(filtros)` — leer paginado.

- `apps/web/lib/services/usuarios.service.ts`:
  - `buscarUsuarios(query, filtros)`.
  - `obtenerDetalleUsuario(id)`.
  - `cambiarRol(usuarioId, nuevoRol, motivo)`.
  - `banearUsuario(usuarioId, motivo)`.

## Datos requeridos

Cada vista carga sus datos en server components con paginación + filtros vía URL params.

## Estados de UI

Las 3 vistas siguen el patrón estándar del Lote F:

```
┌────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar                                       │
├─────────┴──────────────────────────────────────────────┤
│ <AdminPageHeader>                                       │
├─────────────────────────────────────────────────────────┤
│ <StatsCards> 4 cards arriba                             │
├─────────────────────────────────────────────────────────┤
│ <FiltrosBar>                                            │
├─────────────────────────────────────────────────────────┤
│ <AdminTable> densa con paginación                       │
└─────────────────────────────────────────────────────────┘
```

## Componentes que reutiliza

- `<AdminSidebar>`, `<AdminTopbar>`, `<AdminPageHeader>`, `<AdminCard>`, `<AdminTable>` (Lote F).
- `<Modal>` del design system.

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- Desktop-only.
- **Logs** sample 100% para errores, 1-10% para info/warn (configurable).
- **Auditoría** se escribe en cada acción admin destructiva. NO sample — 100% retention.
- **Usuarios** acciones destructivas (ban, soft-delete) requieren motivo + confirmación + se registran en auditoría.
- **Privacidad:** soft-delete anonimiza PII (Lote 8 ya lo hace para `/perfil/eliminar`). Admin NO puede deshacer un soft-delete.
- Eventos analíticos:
  - `admin_logs_visto` (NUEVO Lote G)
  - `admin_auditoria_visto` (NUEVO Lote G)
  - `admin_usuario_baneado` con motivo (NUEVO Lote G)
  - `admin_usuario_rol_cambiado` (NUEVO Lote G)
  - `admin_usuario_soft_deleted` (NUEVO Lote G)

## Mockup de referencia

Sin mockup individual. Patrón visual idéntico a `dashboard.html` del 6A + tabla densa.

## Pasos manuales para Gustavo post-deploy

### Después del primer mes

Revisar `/admin/logs` semanalmente para identificar errores recurrentes y crear issues en GitHub para cada uno. Ajustar sampling de logs si BD crece mucho:

- Si BD `LogError` >100k filas: reducir sampling de info/warn a 1%.

### Compliance

`/admin/auditoria` es la fuente de verdad para responder preguntas de compliance:

- "¿Quién canceló esa suscripción?"
- "¿Por qué se cambió ese usuario a ADMIN?"
- "¿Qué cambios se hicieron en los premios de marzo?"

Mantener data al menos 2 años (Ley de Protección de Datos Perú).

### Acciones destructivas de usuarios

Antes de banear o soft-delete:

1. Verificar el caso (revisar predicciones, conversaciones bot, etc).
2. Considerar si advertencia es suficiente vs ban directo.
3. Documentar el motivo claramente — quedará en auditoría permanente.
4. Si soft-delete: NO se puede deshacer.

**Validación post-deploy:**

1. Disparar un error intencional en testing → verificar entrada en `/admin/logs`.
2. Hacer una acción admin (aprobar pick) → verificar entrada en `/admin/auditoria`.
3. Buscar usuario en `/admin/usuarios` → ir a detalle → probar acción ban (de testing) → verificar logged.

---

*Versión 1 · Abril 2026 · Sistema (logs + auditoría + usuarios) para Lote G*
