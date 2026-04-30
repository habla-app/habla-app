# Channel WhatsApp `/admin/channel-whatsapp`

Vista admin para monitorear el WhatsApp Channel privado *Habla! Picks*. Muestra métricas de membresía, engagement, lecturas/envíos, alertas de leaks, y herramientas para gestionar la rotación del invite link cada 6 meses.

## Lote responsable

**Lote F** — Admin desktop operación.

## Estado actual del repo

NUEVA — esta vista no existe. Depende de modelos `Suscripcion`, `MiembroChannel`, `PickPremium` creados en Lote E.

## Cambios necesarios

### Archivos a crear

- `apps/web/app/admin/channel-whatsapp/page.tsx`:
  - Server component que carga métricas del Channel.
  - URL: `/admin/channel-whatsapp`.

- `apps/web/components/admin/channel/MembresiaStatsGrid.tsx`:
  - Grid 4 cards con stats de membresía:
    - Suscriptores activos (debería estar en Channel)
    - Miembros confirmados en Channel (estado UNIDO)
    - Pendientes de unirse (estado INVITADO/REINVITADO con >24h)
    - Removidos último mes (estado REMOVIDO)

- `apps/web/components/admin/channel/EngagementChart.tsx`:
  - Gráfica line de "% lecturas/envíos" últimos 30 días.
  - Recharts. Eje Y: 0-100%. Eje X: días.
  - Target line en 80% (línea horizontal).
  - Si engagement <60% por 3+ días: indicador alerta.

- `apps/web/components/admin/channel/PicksRecientesTable.tsx`:
  - Tabla con últimos 20 picks enviados al Channel:
    - Fecha · Partido · Recomendación · Estado envío · Reads (% del total)
  - Click en row → `/admin/picks-premium?id=...` con detalle.

- `apps/web/components/admin/channel/AccionesRotacionLink.tsx`:
  - Card con info: "El invite link rota cada 6 meses (próxima rotación: 30 octubre 2026)."
  - Botón "Iniciar rotación ahora" (manual).
  - Lista de pasos al hacer click (modal con instrucciones).

- `apps/web/components/admin/channel/AlertasLeak.tsx`:
  - Card destacada si se detecta leak potencial:
    - Si N suscriptores cancelaron y aún están en Channel (cron sync no procesó)
    - Si miembros UNIDOS > suscripciones activas (alguien con link viejo)
  - Botones de acción: "Forzar sync" + "Ver lista a remover".

- `apps/web/components/admin/channel/UltimoSyncInfo.tsx`:
  - Card pequeña con info del último cron de sync:
    - Última corrida: hace X minutos
    - Items procesados: N
    - Errores: 0 / X
    - Próxima corrida: en X minutos

### Servicios necesarios

- `apps/web/lib/services/channel-whatsapp.service.ts`:
  - `obtenerStatsMembresia()` — counts de cada estado.
  - `obtenerEngagementUltimos30d()` — devuelve array de `{ fecha, lecturas, envios, pct }`.
  - `obtenerPicksEnviadosRecientes(take)` — picks aprobados con métricas de envío.
  - `obtenerUltimoSync()` — última corrida del cron.
  - `forzarSyncMembresia()` — server action que dispara el cron manualmente.

### Archivos a modificar

Ninguno.

## Datos requeridos

```typescript
// apps/web/app/admin/channel-whatsapp/page.tsx
export const dynamic = 'force-dynamic';

export default async function ChannelWhatsAppPage() {
  const [
    statsMembresia,
    engagement,
    picksRecientes,
    ultimoSync,
    alertasLeak,
  ] = await Promise.all([
    obtenerStatsMembresia(),
    obtenerEngagementUltimos30d(),
    obtenerPicksEnviadosRecientes({ take: 20 }),
    obtenerUltimoSync(),
    obtenerAlertasLeakChannel(),
  ]);

  return (
    <ChannelWhatsAppView
      statsMembresia={statsMembresia}
      engagement={engagement}
      picksRecientes={picksRecientes}
      ultimoSync={ultimoSync}
      alertasLeak={alertasLeak}
    />
  );
}
```

### Métricas calculadas

Engagement % se calcula con datos de WhatsApp Business API webhook (status updates `read`):

```typescript
async function obtenerEngagementUltimos30d() {
  const dias = [];
  for (let i = 29; i >= 0; i--) {
    const fecha = subDays(new Date(), i);
    const inicio = startOfDay(fecha);
    const fin = endOfDay(fecha);

    // Mensajes enviados al Channel ese día
    const enviados = await prisma.pickPremium.count({
      where: { enviadoEn: { gte: inicio, lte: fin }, enviadoAlChannel: true },
    });

    // Lecturas confirmadas (de webhook status updates)
    const lecturas = await prisma.statusMensajeBot.count({
      where: { fecha: { gte: inicio, lte: fin }, status: 'read' },
    });

    const totalSuscriptores = await prisma.suscripcion.count({
      where: { activa: true, iniciada: { lte: fin } },
    });

    const lecturasPosibles = enviados * totalSuscriptores;
    const pct = lecturasPosibles > 0 ? (lecturas / lecturasPosibles) * 100 : 0;

    dias.push({ fecha, lecturas, envios: enviados, pct });
  }
  return dias;
}
```

## Estados de UI

### Estructura

```
┌────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar (Operación · Channel WhatsApp)        │
├─────────┴──────────────────────────────────────────────┤
│ <AdminPageHeader>                                       │
│  Title: Channel WhatsApp                                │
│  Desc: Habla! Picks · 847 suscriptores activos          │
│  Actions: [Forzar sync] [Rotación link]                 │
├─────────────────────────────────────────────────────────┤
│ <AlertasLeak> (si hay)                                  │
├─────────────────────────────────────────────────────────┤
│ <MembresiaStatsGrid> 4 cards                            │
├─────────────────────────────────────────────────────────┤
│ <EngagementChart> 30 días                               │
├─────────────────────────────────────────────────────────┤
│ <PicksRecientesTable>                                   │
├─────────────────────────────────────────────────────────┤
│ <AccionesRotacionLink>  +  <UltimoSyncInfo>             │
└─────────────────────────────────────────────────────────┘
```

### Estados de UI

#### Sin alertas de leak
- `<AlertasLeak>` oculto.
- Resto del layout normal.

#### Con leak detectado (1+ suscriptores cancelados aún en Channel)
- Banner amber arriba con "X usuarios deben ser removidos manualmente del Channel".
- Botón "Ver lista" abre modal con detalles.

#### Engagement bajo persistente
- Banner info en sección de gráfica: "Engagement por debajo del 80% target. Posibles causas: [link a guía]".

#### Rotación próxima
- Banner info en `<AccionesRotacionLink>`: "Rotación recomendada en 30 días."

### Loading

- Server component → render directo.
- Cache de stats con TTL 5 min en Redis para no recalcular cada visita.

## Componentes que reutiliza

- `<AdminSidebar>`, `<AdminTopbar>`, `<AdminPageHeader>` (Lote F · 00-layout).
- `<AdminCard>` (Lote F).
- `<AdminTable>` (Lote F).
- Recharts (Lote 6).

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- Desktop-only.
- Cache de queries pesadas (engagement 30d) con TTL 5 min.
- Eventos analíticos:
  - `admin_channel_visto` (NUEVO Lote F).
  - `admin_sync_membresia_forzado` cuando click en "Forzar sync".

## Mockup de referencia

Sin mockup individual. Patrón visual basado en `dashboard.html` del Paquete 6A (sidebar + topbar + KPI cards) + tabla densa.

## Pasos manuales para Gustavo post-deploy

### Cuando aparezca alerta de leak

Si el banner muestra "X usuarios deben ser removidos manualmente":

1. Click en "Ver lista" → modal con nombres + emails + motivo.
2. Abrir WhatsApp → Channel "Habla! Picks" → Channel info → Members.
3. Por cada usuario en la lista: tap nombre → Remove.
4. Volver al admin y click "Marcar como removidos" para limpiar la alerta.

### Rotación cada 6 meses

Cuando se acerque la fecha de rotación (banner info te avisa):

1. Click en "Iniciar rotación ahora".
2. Modal con instrucciones paso-a-paso.
3. Crear nuevo Channel "Habla! Picks v2" en WhatsApp móvil.
4. Subir 3-5 picks históricos.
5. Pegar el nuevo invite link en el modal.
6. Click "Confirmar rotación" → el sistema:
   - Actualiza `WHATSAPP_CHANNEL_PREMIUM_INVITE_LINK` (instructivo de cómo cambiar en Railway en el modal).
   - Marca todos los `MiembroChannel.estado=INVITADO` → cron del próximo día les envía el nuevo invite via bot 1:1.
7. Esperar 7-14 días → la mayoría migra al Channel nuevo.
8. Eliminar el Channel viejo cuando ya no haya actividad.

**Validación post-deploy:**
1. Logueado como ADMIN, abrir `hablaplay.com/admin/channel-whatsapp`.
2. Verificar membresía stats con counts reales.
3. Verificar gráfica de engagement con curva razonable.
4. Verificar tabla de últimos 20 picks con sus métricas.
5. Click en "Forzar sync" → verificar Railway logs que el cron corre.
6. Si tienes cancelaciones recientes pero usuarios aún en Channel: verificar alerta de leak.

---

*Versión 1 · Abril 2026 · Channel WhatsApp admin para Lote F*
