# Premios mensuales `/admin/premios-mensuales`

Vista admin para procesar el pago mensual de premios de Liga Habla! a los Top 10 ganadores. Refactor visual del Lote 5 + adaptación al sidebar nuevo + flujo guiado mes-por-mes.

## Lote responsable

**Lote F** — Admin desktop operación.

## Estado actual del repo

- `apps/web/app/admin/premios-mensuales/page.tsx` (Lote 5): listing de premios con estado de pago.
- Modelo `PremioMensual` (Lote 5) con campos: `usuarioId`, `mes`, `posicion`, `monto`, `estadoPago`, `pagadoEn`, `notas`.

## Cambios necesarios

Refactor visual + flujo guiado para procesar el cierre mensual.

### Decisión arquitectónica

El cierre mensual de Liga Habla! requiere acciones secuenciales:
1. Verificar Top 10 final del mes (puntos congelados al cierre).
2. Crear filas `PremioMensual` para cada uno (en estado PENDIENTE).
3. Solicitar datos bancarios al ganador (si no los tiene).
4. Hacer transferencia bancaria manual (off-platform — BCP, Interbank, etc).
5. Marcar como PAGADO en BD con comprobante.
6. Notificar al ganador por email + WhatsApp.

La vista `/admin/premios-mensuales` guía este flujo paso a paso por mes.

### Archivos a modificar

- `apps/web/app/admin/premios-mensuales/page.tsx`:
  - Mantener listing.
  - Refactor visual al patrón Lote F.
  - Agregar selector de mes (default: mes recién cerrado).
  - Para cada premio: estado visual + botón de acción según estado.

### Archivos a crear

- `apps/web/components/admin/premios/PremiosMesHeader.tsx`:
  - Header con: mes seleccionado · total de ganadores · monto total · monto pagado · monto pendiente.

- `apps/web/components/admin/premios/PremiosMesTabla.tsx`:
  - Tabla con cada uno de los Top 10:
    - Posición (medalla 1/2/3 + número resto)
    - Avatar + nombre + email
    - Puntos del mes
    - Monto premio
    - Estado pago (badge)
    - Acción según estado (botón contextual)

- `apps/web/components/admin/premios/AccionPremio.tsx`:
  - Componente de "siguiente acción" según estado:
    - **PENDIENTE_DATOS**: "Solicitar datos bancarios" (envía email)
    - **PENDIENTE_PAGO** (datos recibidos): "Marcar como pagado" → modal con campos
    - **PAGADO**: "Ver comprobante" / "Reenviar comprobante"
    - **RECHAZADO**: "Reintentar" (vuelve a PENDIENTE_PAGO)

- `apps/web/components/admin/premios/MarcarPagadoModal.tsx`:
  - Modal con campos:
    - Banco origen
    - Banco destino del ganador
    - Número de cuenta del ganador
    - Monto transferido (debe coincidir con monto premio)
    - Fecha de transferencia
    - Número de operación
    - Comprobante (file upload — opcional pero recomendado)
    - Notas
  - Botón "Confirmar pago" → marca PAGADO + envía email al ganador con confirmación.

- `apps/web/components/admin/premios/SolicitarDatosModal.tsx`:
  - Modal para enviar email al ganador pidiendo datos bancarios.
  - Template del email pre-renderizado en el modal.
  - Botón "Enviar email" → trigger Resend.

- `apps/web/app/admin/premios-mensuales/[mes]/page.tsx`:
  - Vista detallada de un mes específico (drill-down desde el listing).

### Servicios

- `apps/web/lib/services/premios-mensuales.service.ts`:
  - Mantener funciones existentes (Lote 5).
  - Agregar `obtenerPremiosPorMes(mes)`.
  - Agregar `marcarPremioPagado(id, datos)` — atómico con creación de log de auditoría.
  - Agregar `solicitarDatosBancarios(premioId)` — envía email.

### Modelo Prisma extendido

Si no existe ya, extender `PremioMensual`:

```prisma
model PremioMensual {
  // ... campos del Lote 5 ...
  estadoPago        EstadoPagoPremio  @default(PENDIENTE_DATOS)
  bancoDestino      String?
  cuentaDestino     String?
  fechaTransfer     DateTime?
  numeroOperacion   String?
  comprobanteUrl    String?
  notas             String?
  pagadoPor         String?            // userId admin que marcó pagado
  emailEnviadoAt    DateTime?          // último email solicitando datos
}

enum EstadoPagoPremio {
  PENDIENTE_DATOS    // No tenemos datos bancarios del ganador
  DATOS_RECIBIDOS    // Tenemos datos, listos para pagar
  PAGADO             // Pago confirmado
  RECHAZADO          // Pago rechazado por banco u otra razón
}
```

### Archivos a eliminar

Ninguno.

## Datos requeridos

```typescript
// apps/web/app/admin/premios-mensuales/page.tsx
export const dynamic = 'force-dynamic';

interface Props {
  searchParams?: { mes?: string };
}

export default async function PremiosAdminPage({ searchParams }: Props) {
  const mesActual = searchParams?.mes ?? obtenerMesRecienCerrado();

  const [premiosDelMes, mesesDisponibles] = await Promise.all([
    obtenerPremiosPorMes(mesActual),
    listarMesesConPremios(),
  ]);

  return (
    <PremiosAdminView
      mes={mesActual}
      premios={premiosDelMes}
      mesesDisponibles={mesesDisponibles}
    />
  );
}
```

## Estados de UI

### Estructura

```
┌────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar (Operación · Premios mensuales)       │
├─────────┴──────────────────────────────────────────────┤
│ <AdminPageHeader>                                       │
│  Title: Premios mensuales                               │
│  Desc: Gestión de pagos de Liga Habla!                  │
│  Actions: [Mes: Marzo 2026 ▾] [Exportar mes]            │
├─────────────────────────────────────────────────────────┤
│ <PremiosMesHeader>                                      │
│  Marzo 2026 · 10 ganadores · S/ 1,250 total             │
│  Pagado: S/ 800 (8/10) · Pendiente: S/ 450              │
├─────────────────────────────────────────────────────────┤
│ <PremiosMesTabla>                                       │
│  Pos │ Ganador        │ Pts │ Monto │ Estado │ Acción   │
│  ─────────────────────────────────────────────────────  │
│  🥇 1 │ Juan Martínez  │ 187 │ S/500 │ Pagado │ Ver     │
│  🥈 2 │ Ana Rodríguez  │ 175 │ S/200 │ Pagado │ Ver     │
│  🥉 3 │ Carlos R.      │ 168 │ S/200 │ Pend.  │ Marcar  │
│   4   │ Diana M.       │ 152 │ S/ 50 │ Pend.  │ Datos   │
│  ...                                                    │
└─────────────────────────────────────────────────────────┘
```

### Estados de cada premio

| Estado | Visual | Acción disponible |
|---|---|---|
| PENDIENTE_DATOS | Badge gris "Sin datos" | "Solicitar datos" (email) |
| DATOS_RECIBIDOS | Badge ámbar "Listo para pagar" | "Marcar pagado" |
| PAGADO | Badge verde "✓ Pagado [fecha]" | "Ver comprobante" |
| RECHAZADO | Badge rojo "Rechazado" | "Reintentar" |

### Email al ganador (template)

Cuando admin click "Solicitar datos bancarios":

```
Asunto: 🎉 Felicidades [Nombre], ganaste S/ [Monto] en Liga Habla!

Hola [Nombre],

¡Felicidades! Quedaste en posición #[N] del mes de [Mes] en Liga Habla! con [puntos] puntos.

Tu premio: S/ [Monto]

Para procesar tu pago necesitamos los siguientes datos bancarios. Responde este email con:

1. Banco (BCP / BBVA / Interbank / Scotiabank / etc)
2. Tipo de cuenta (Ahorros / Corriente)
3. Número de cuenta (no el CCI)
4. Nombre completo del titular
5. DNI del titular

Plazo: tienes 30 días para enviar los datos. Después se transfiere al fondo del próximo mes.

Te transferimos en máximo 5 días hábiles después de recibir tus datos.

¡Sigue compitiendo!
Equipo Habla!
```

Cuando admin click "Marcar pagado":

```
Asunto: ✅ Pago confirmado · S/ [Monto] · Liga Habla! [Mes]

Hola [Nombre],

Tu premio de S/ [Monto] por la posición #[N] de [Mes] ha sido transferido.

Detalles:
- Banco: [Banco origen] → [Banco destino]
- Operación: [Número operación]
- Fecha: [Fecha transferencia]

Adjunto el comprobante.

Gracias por participar.
Equipo Habla!
```

### Loading

- Server component → render directo.

## Componentes que reutiliza

- `<AdminSidebar>`, `<AdminTopbar>`, `<AdminPageHeader>`, `<AdminCard>`, `<AdminTable>` (Lote F).
- `<Modal>` del design system.
- Cliente Resend (Lote 10).
- Servicios del Lote 5.

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- Desktop-only.
- **Confirmación obligatoria** al marcar pagado (datos bancarios + monto deben coincidir).
- **Logs de auditoría** en cada acción admin (pagar, reenviar email, etc.).
- **Comprobante de transferencia recomendado** (file upload). Si no se sube, queda registrado en notas.
- **Idempotencia.** Si admin click "Marcar pagado" 2 veces seguidas: la 2da debe mostrar "Ya está pagado" en lugar de crear duplicate.
- Eventos analíticos:
  - `admin_premio_datos_solicitados` (NUEVO Lote F).
  - `admin_premio_marcado_pagado` (NUEVO Lote F).
  - `admin_premio_rechazado` (NUEVO Lote F).

## Mockup de referencia

Sin mockup individual. Patrón visual: tabla densa con badges de estado + acciones contextuales por row + modal para acciones complejas.

## Pasos manuales para Gustavo post-deploy

### Flujo mensual de procesamiento de premios

El cierre del mes de Liga Habla! ocurre el día 1 del mes siguiente a las 00:00 PE. El cron del Lote 5 ya cierra automáticamente el leaderboard. Tu trabajo manual:

#### Día 1-2 del mes nuevo (cierre del mes anterior)

1. Abrir `hablaplay.com/admin/premios-mensuales`.
2. Selector de mes muestra el mes recién cerrado (default).
3. Verificar que aparecen 10 ganadores con sus puntos y monedas.
4. Para cada uno con estado **PENDIENTE_DATOS**: click "Solicitar datos" → envía email automático.

#### Día 2-7 del mes (recibir datos)

5. Esperar respuestas por email.
6. Cuando recibes datos: editar el premio → guardar datos bancarios → estado pasa a **DATOS_RECIBIDOS**.

#### Día 5-12 del mes (procesar pagos)

7. Hacer transferencias bancarias desde tu BCP / Interbank / etc al ganador.
8. Para cada premio pagado: click "Marcar pagado" → modal → llenar:
   - Número de operación
   - Fecha
   - Comprobante (subir imagen del recibo)
9. Click "Confirmar" → email automático al ganador con comprobante.

#### Día 30 del mes (recordatorio para pendientes)

10. Si algún ganador no respondió con datos: enviar 2do recordatorio manual.
11. Si después de 30 días no responde: el premio se rolea al fondo del próximo mes.

**Validación post-deploy:**
1. Abrir `/admin/premios-mensuales`.
2. Verificar que el mes recién cerrado aparece con sus 10 ganadores.
3. Probar flujo: solicitar datos → marcar pagado de testing.
4. Verificar emails llegan correctamente.
5. Verificar entry en `/admin/auditoria` por cada acción.

---

*Versión 1 · Abril 2026 · Premios mensuales admin para Lote F*
