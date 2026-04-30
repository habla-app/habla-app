# Alarmas `/admin/alarmas`

Sistema de alarmas que se disparan cuando un KPI cae bajo su threshold o cuando algo crítico ocurre. Vista para gestionar alarmas activas, configurar thresholds, y ver histórico.

## Lote responsable

**Lote G** — Admin desktop análisis.

## Estado actual del repo

NUEVA — sin sistema de alarmas. El banner del dashboard del Lote F (`AlarmaBanner`) consume datos de `obtenerAlarmasActivas()` que se define aquí.

## Cambios necesarios

### Decisión arquitectónica

3 tipos de alarmas:

1. **KPI thresholds** — automáticas. Cron horario evalúa si algún KPI clave salió de target durante N períodos consecutivos.
2. **Eventos críticos** — automáticas. Webhook OpenPay con error masivo, falla persistente de envío al WhatsApp Channel, etc.
3. **Manuales** — admin puede crear alarmas custom para tracking interno (ej: "recordatorio fin de trimestre fiscal").

Cada alarma tiene severidad: `info` / `warning` / `critical`. Critical dispara email al admin.

### Modelo Prisma

```prisma
model Alarma {
  id            String    @id @default(cuid())
  tipo          TipoAlarma                // KPI_THRESHOLD | EVENTO_CRITICO | MANUAL
  severidad     SeveridadAlarma           // INFO | WARNING | CRITICAL
  titulo        String
  descripcion   String   @db.Text
  metricId      String?                    // Si tipo=KPI_THRESHOLD
  contexto      Json?                      // Datos contextuales para troubleshooting

  activa        Boolean   @default(true)
  desactivadaEn DateTime?
  desactivadaPor String?
  motivoDesactivacion String?

  creadaEn      DateTime  @default(now())

  @@index([activa, severidad])
  @@map("alarmas")
}

enum TipoAlarma {
  KPI_THRESHOLD
  EVENTO_CRITICO
  MANUAL
}

enum SeveridadAlarma {
  INFO
  WARNING
  CRITICAL
}

model AlarmaConfiguracion {
  id            String   @id @default(cuid())
  metricId      String   @unique             // 'conversion_visita_registro' etc.
  thresholdMin  Float?                       // Por debajo de esto: alarma
  thresholdMax  Float?                       // Por encima de esto: alarma
  duracionMinutos Int    @default(60)         // Tiempo bajo threshold para disparar
  severidad     SeveridadAlarma
  habilitada    Boolean  @default(true)

  @@map("alarmas_config")
}
```

### Archivos a crear

- `apps/web/app/admin/alarmas/page.tsx`:
  - Server component que carga alarmas activas + configuración.

- `apps/web/components/admin/alarmas/AlarmasActivasList.tsx`:
  - Lista de alarmas activas ordenadas por severidad (CRITICAL → WARNING → INFO).
  - Por cada alarma: titulo + descripción + tiempo desde creación + acción "Desactivar" (con motivo).

- `apps/web/components/admin/alarmas/AlarmasConfigTabla.tsx`:
  - Tabla de configuración de thresholds:
    - KPI · Threshold min · Threshold max · Duración mins · Severidad · Habilitada · Editar.
  - Editar abre modal con form.

- `apps/web/components/admin/alarmas/AlarmasHistoricoTabla.tsx`:
  - Tabla de alarmas pasadas (desactivadas):
    - Tipo · Severidad · Título · Activa por · Desactivada en · Motivo desactivación.

- `apps/web/components/admin/alarmas/CrearAlarmaManualModal.tsx`:
  - Modal para crear alarma manual (recordatorio interno).

### Servicios

- `apps/web/lib/services/alarmas.service.ts`:
  - `obtenerAlarmasActivas()` — consume del banner del dashboard del Lote F.
  - `desactivarAlarma(id, motivo)`.
  - `crearAlarmaManual(input)`.
  - `obtenerHistoricoAlarmas(rango)`.
  - `obtenerConfigThresholds()`.
  - `actualizarConfigThreshold(metricId, input)`.

### Cron de evaluación

`apps/web/lib/cron/evaluar-alarmas.ts`:

Corre cada hora. Para cada `AlarmaConfiguracion` habilitada:
1. Calcula el valor actual del KPI.
2. Compara contra threshold.
3. Si fuera de threshold por `duracionMinutos`: crea/mantiene alarma activa.
4. Si vuelve dentro: marca alarma como desactivada automáticamente.

```typescript
export async function evaluarAlarmas() {
  const configs = await prisma.alarmaConfiguracion.findMany({ where: { habilitada: true } });

  for (const config of configs) {
    const valorActual = await obtenerValorKPI(config.metricId);
    const fueraDeThreshold = (
      (config.thresholdMin && valorActual < config.thresholdMin) ||
      (config.thresholdMax && valorActual > config.thresholdMax)
    );

    if (fueraDeThreshold) {
      // Crear alarma si no existe ya activa
      await prisma.alarma.upsert({
        where: { /* buscar activa con metricId */ },
        create: { /* datos */ },
        update: {},  // Idempotente
      });

      if (config.severidad === 'CRITICAL') {
        await enviarEmailAlerta(...);
      }
    } else {
      // Desactivar alarma activa con metricId si existe
      await prisma.alarma.updateMany({
        where: { metricId: config.metricId, activa: true, tipo: 'KPI_THRESHOLD' },
        data: {
          activa: false,
          desactivadaEn: new Date(),
          motivoDesactivacion: 'Auto-desactivada: KPI volvió a target',
        },
      });
    }
  }
}
```

### Endpoint del cron

`apps/web/app/api/v1/crons/evaluar-alarmas/route.ts` — auth con CRON_SECRET.

### Schedule

```json
{
  "crons": [{
    "path": "/api/v1/crons/evaluar-alarmas",
    "schedule": "0 * * * *"
  }]
}
```

## Datos requeridos

```typescript
// apps/web/app/admin/alarmas/page.tsx
export const dynamic = 'force-dynamic';

export default async function AlarmasPage() {
  const [activas, config, historico] = await Promise.all([
    obtenerAlarmasActivas(),
    obtenerConfigThresholds(),
    obtenerHistoricoAlarmas('30d'),
  ]);

  return <AlarmasView activas={activas} config={config} historico={historico} />;
}
```

## Estados de UI

### Estructura

```
┌────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar (Análisis · Alarmas)                  │
├─────────┴──────────────────────────────────────────────┤
│ <AdminPageHeader>                                       │
│  Title: Alarmas                                         │
│  Desc: 1 activa · 3 últimos 7 días                      │
│  Actions: [+ Alarma manual]                             │
├─────────────────────────────────────────────────────────┤
│ Sección "🔴 Activas (1)"                                │
│   <AlarmasActivasList>                                  │
├─────────────────────────────────────────────────────────┤
│ Sección "⚙ Configuración thresholds"                    │
│   <AlarmasConfigTabla>                                  │
├─────────────────────────────────────────────────────────┤
│ Sección "📊 Histórico (últimos 30 días)"                │
│   <AlarmasHistoricoTabla>                               │
└─────────────────────────────────────────────────────────┘
```

### Estado de alarma activa

Cada alarma se muestra como card con:
- Icono según severidad: 🔴 critical / 🟡 warning / 🔵 info
- Título + descripción + tiempo activa
- Botón "Desactivar" → modal con campo "motivo" obligatorio

### Loading

- Server component → render directo.

## Componentes que reutiliza

- `<AdminSidebar>`, `<AdminTopbar>`, `<AdminPageHeader>`, `<AdminCard>`, `<AdminTable>` (Lote F).
- `<Modal>` del design system.

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- Desktop-only.
- **Email al admin solo en CRITICAL.** Warning e Info solo en BD.
- **Desactivación requiere motivo.** Para auditoría.
- **Idempotencia** del cron — no crear alarmas duplicadas.
- Eventos analíticos:
  - `admin_alarma_visto` (NUEVO Lote G).
  - `admin_alarma_desactivada` con metricId + motivo (NUEVO Lote G).
  - `admin_alarma_manual_creada` (NUEVO Lote G).

## Mockup de referencia

Sin mockup individual.

## Pasos manuales para Gustavo post-deploy

### Configurar thresholds iniciales

Después del primer deploy, configurar thresholds iniciales para los KPIs críticos:

1. Abrir `/admin/alarmas` → tabla de configuración.
2. Por cada KPI clave, click "Editar" → setear:
   - `thresholdMin` (si caer abajo dispara alarma)
   - `thresholdMax` (si subir arriba dispara — útil para errores 500)
   - `duracionMinutos` (60-180 razonable para KPIs estables)
   - `severidad` (CRITICAL solo para los que requieren acción inmediata)
3. Habilitar.

Ejemplos:
- `conversion_visita_registro` < 2% por 24h → CRITICAL
- `engagement_channel` < 60% por 3 días → WARNING
- `errores_5xx_hora` > 50 → CRITICAL

**Validación post-deploy:**
1. Abrir `/admin/alarmas`.
2. Configurar 1 threshold de testing.
3. Forzar valor del KPI fuera de threshold (manualmente en BD).
4. Esperar a próxima corrida del cron (cada hora).
5. Verificar que la alarma aparece activa.
6. Si severidad CRITICAL: verificar que llega email a `ADMIN_EMAIL`.
7. Restaurar valor → próxima corrida del cron auto-desactiva.

---

*Versión 1 · Abril 2026 · Alarmas para Lote G*
