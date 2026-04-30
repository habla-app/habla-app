# Newsletter admin `/admin/newsletter`

Vista admin para gestionar suscripciones del newsletter, ver stats de envíos, y disparar campañas manuales. Refactor visual del Lote 10 + adaptación al sidebar nuevo.

## Lote responsable

**Lote F** — Admin desktop operación.

## Estado actual del repo

- `apps/web/app/admin/newsletter/page.tsx` (Lote 10): listing de suscriptores con stats.
- `apps/web/lib/services/newsletter.service.ts` (Lote 10): CRUD + envío.

## Cambios necesarios

Refactor visual al patrón Lote F + nuevas funcionalidades de envío.

### Archivos a modificar

- `apps/web/app/admin/newsletter/page.tsx`:
  - Mantener queries existentes.
  - Refactor visual al patrón Lote F (sidebar + topbar).
  - Agregar `<NewsletterStatsAgregadas>` arriba.
  - Agregar tabla de suscriptores con filtros.
  - Agregar sección "Últimos envíos" con métricas.

- `apps/web/lib/services/newsletter.service.ts`:
  - Agregar función `crearCampana(input)` que prepara una campaña en estado BORRADOR.
  - Agregar función `enviarCampana(id)` que dispara envío masivo.
  - Agregar tracking de aperturas/clicks via Resend webhook (next step para incrementar engagement metrics).

### Archivos a crear

- `apps/web/app/admin/newsletter/campanas/page.tsx`:
  - Lista de campañas (BORRADOR / PROGRAMADA / ENVIADA).
  - Stats por campaña: enviados, entregados, abiertos, clickeados.

- `apps/web/app/admin/newsletter/campanas/nueva/page.tsx`:
  - Form para crear campaña:
    - Subject
    - Preview text (el snippet que aparece en el inbox)
    - Body (textarea con preview MDX/HTML)
    - Segmento (Todos / Free / Premium / Casas-conectadas)
    - Programada o "Enviar ahora"
  - Botón "Vista previa" que abre modal con el email renderizado.
  - Botón "Enviar test a mi email" antes de envío masivo.

- `apps/web/components/admin/newsletter/NewsletterStatsAgregadas.tsx`:
  - 4 cards:
    - Suscriptores activos
    - Confirmados (doble opt-in completo)
    - Open rate promedio último mes
    - Click rate promedio último mes

- `apps/web/components/admin/newsletter/SuscriptoresTabla.tsx`:
  - Tabla con email · estado · fecha suscripción · último envío recibido · acciones.
  - Filtros por estado (CONFIRMADO / PENDIENTE / DESUSCRITO).

- `apps/web/components/admin/newsletter/CampanasTabla.tsx`:
  - Tabla de campañas con métricas.

- `apps/web/components/admin/newsletter/CampanaPreview.tsx`:
  - Modal con preview del email renderizado en iframe sandbox.

### Modelo nuevo en Prisma (opcional)

Si no existe ya en Lote 10, agregar:

```prisma
model CampanaNewsletter {
  id              String    @id @default(cuid())
  subject         String
  previewText     String?
  body            String   @db.Text  // HTML del email
  segmento        SegmentoCampana    // TODOS | FREE | PREMIUM | CASAS_CONECTADAS
  estado          EstadoCampana      // BORRADOR | PROGRAMADA | ENVIANDO | ENVIADA | FALLIDA
  programadaPara  DateTime?
  enviadaEn       DateTime?

  enviados        Int       @default(0)
  entregados      Int       @default(0)
  abiertos        Int       @default(0)
  clickeados      Int       @default(0)

  creadoPor       String                 // userId admin
  creadoEn        DateTime  @default(now())

  @@map("campanas_newsletter")
}

enum SegmentoCampana {
  TODOS
  FREE
  PREMIUM
  CASAS_CONECTADAS
}

enum EstadoCampana {
  BORRADOR
  PROGRAMADA
  ENVIANDO
  ENVIADA
  FALLIDA
}
```

### Archivos a eliminar

Ninguno.

## Datos requeridos

```typescript
// apps/web/app/admin/newsletter/page.tsx
export default async function NewsletterAdminPage() {
  const [stats, suscriptores, ultimasCampanas] = await Promise.all([
    obtenerStatsNewsletter(),
    listarSuscriptores({ pageSize: 50 }),
    listarUltimasCampanas({ take: 10 }),
  ]);
  return <NewsletterAdminView ... />;
}
```

## Estados de UI

### Listing principal

```
┌────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar (Operación · Newsletter)              │
├─────────┴──────────────────────────────────────────────┤
│ <AdminPageHeader>                                       │
│  Title: Newsletter                                      │
│  Desc: 3,180 suscriptores activos · OR 42% · CR 8%      │
│  Actions: [+ Nueva campaña] [Ver campañas]              │
├─────────────────────────────────────────────────────────┤
│ <NewsletterStatsAgregadas> 4 cards                      │
├─────────────────────────────────────────────────────────┤
│ <UltimasCampanasResumen>                                │
│  Tabla pequeña con últimas 5 campañas + métricas        │
├─────────────────────────────────────────────────────────┤
│ <SuscriptoresTabla>                                     │
└─────────────────────────────────────────────────────────┘
```

### Crear campaña

```
┌────────────────────────────────────────────────────────┐
│ <AdminPageHeader>                                       │
│  Title: Nueva campaña                                   │
│  Actions: [Vista previa] [Test a mi email]              │
├─────────────────────────────────────────────────────────┤
│ Form:                                                   │
│  Subject: [____________________________________]        │
│  Preview text: [_____________________________]          │
│  Body: [textarea con MDX/HTML]                          │
│  Segmento: [Todos ▾]                                    │
│  Cuándo: ( ) Enviar ahora  ( ) Programar para [fecha]  │
├─────────────────────────────────────────────────────────┤
│  [Guardar borrador] [Enviar campaña]                    │
└─────────────────────────────────────────────────────────┘
```

### Estados según campaña

- **BORRADOR:** se puede editar y borrar. No envía.
- **PROGRAMADA:** se puede cancelar antes del envío. Edición limitada.
- **ENVIANDO:** loading state. Se actualiza progresivamente.
- **ENVIADA:** read-only. Mostrar métricas.
- **FALLIDA:** mostrar errores + botón "Reintentar".

## Componentes que reutiliza

- `<AdminSidebar>`, `<AdminTopbar>`, `<AdminPageHeader>`, `<AdminCard>`, `<AdminTable>` (Lote F).
- `<Modal>` del design system.
- Cliente Resend del Lote 10.

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- Desktop-only.
- **Test antes de envío masivo.** El botón "Test a mi email" SIEMPRE debe usarse antes de "Enviar campaña". Documentar en el spec.
- **Confirmación obligatoria** antes de envío masivo (modal "Estás por enviar a X suscriptores. ¿Confirmar?").
- **Rate limit Resend.** Si el segmento >5000 destinatarios, el envío se debe procesar en chunks con delay para no triggear rate limit.
- Eventos analíticos:
  - `admin_newsletter_campana_creada` (NUEVO Lote F).
  - `admin_newsletter_campana_enviada` (NUEVO Lote F).
  - `newsletter_email_abierto` cuando webhook Resend reporta open (NUEVO Lote F, opcional).

## Mockup de referencia

Sin mockup individual. Patrón visual: tabla densa + form de campaña + cards de stats.

## Pasos manuales para Gustavo post-deploy

### Configurar webhook de Resend (opcional, para tracking de aperturas)

1. Ir a https://resend.com/webhooks.
2. Endpoint URL: `https://hablaplay.com/api/v1/resend/webhook`.
3. Suscribir eventos: `email.opened`, `email.clicked`, `email.bounced`.
4. Copiar webhook secret → variable `RESEND_WEBHOOK_SECRET` en Railway.

**Validación post-deploy:**
1. Abrir `/admin/newsletter`.
2. Click "+ Nueva campaña".
3. Llenar form con campaña de testing.
4. Click "Test a mi email" → verificar email llega.
5. Click "Enviar campaña" → modal de confirmación.
6. Confirmar → verificar Railway logs.
7. Esperar unos minutos → verificar métricas (entregados, abiertos) si configuraste webhook.

---

*Versión 1 · Abril 2026 · Newsletter admin para Lote F*
