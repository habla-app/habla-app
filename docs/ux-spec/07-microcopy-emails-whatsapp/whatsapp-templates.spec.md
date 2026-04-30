# WhatsApp templates (Meta Business API)

Spec del catálogo completo de plantillas WhatsApp Business API que Habla! envía a usuarios. Cada plantilla con su body, categoría Meta, idioma, variables, y proceso de aprobación.

## Lote responsable

**Lote H** — Microcopy + emails + WhatsApp templates.

## Estado actual del repo

- Cliente WhatsApp Business API configurado en Lote E (`whatsapp-channel-flow.spec.md`).
- Sin templates registradas en Meta Business Manager — se crean en este lote.

## Contexto crítico

### Diferencia entre mensajes libres y templates

WhatsApp Business API tiene 2 tipos de mensajes salientes:

1. **Mensajes libres (free-form):** solo permitidos dentro de **24h después** de que el usuario te escribió. Tono libre, sin aprobación previa.
2. **Templates (HSM):** mensajes proactivos fuera de la ventana de 24h. **DEBEN ser pre-aprobados por Meta** antes de poder enviarse.

Habla! usa templates para:
- Notificaciones de pagos (factura, fallo)
- Recordatorios de renovación
- Alertas críticas (cambio en suscripción)

Habla! NO necesita templates para:
- Picks Premium → se envían dentro de la ventana 24h del usuario (cada vez que el usuario abre el bot, la ventana se reabre).
- Bot FAQ → el usuario inicia la conversación, todo lo que respondes es free-form.
- Mensajes al Channel → no van por API en absoluto, los publica el admin manualmente.

### Categorías Meta

Cada template tiene una categoría que afecta el costo y las reglas de uso:

| Categoría | Uso | Ejemplo |
|---|---|---|
| **UTILITY** | Notificaciones transaccionales (cobros, status updates) | "Tu suscripción se renovó" |
| **MARKETING** | Promociones, recordatorios de venta | "Tu Premium vence pronto" |
| **AUTHENTICATION** | OTP, códigos de verificación | "Tu código es 123456" |

**Costo:** UTILITY ≈ S/0.10 / mensaje, MARKETING ≈ S/0.15, AUTHENTICATION ≈ S/0.04. Importante para presupuestar.

### Proceso de aprobación

Las templates se registran en Meta Business Manager y pasan revisión:

1. Crear template en Meta Business Manager.
2. Esperar aprobación (típicamente 1-3 días hábiles).
3. Si aprobada → puedes enviarla via API.
4. Si rechazada → Meta da motivo (ej: "promocional en categoría UTILITY"). Editar y resubmit.

**Por esto el Lote H debe ejecutarse antes del lanzamiento** — el lead time de aprobación puede causar bloqueos.

## Cambios necesarios

### Decisión arquitectónica

Toda la config de templates vive en `apps/web/lib/services/whatsapp/templates.ts`:

```typescript
export const WHATSAPP_TEMPLATES = {
  factura_premium: {
    name: 'factura_premium',           // Nombre interno (debe coincidir con Meta)
    category: 'UTILITY',
    language: 'es',                     // Spanish (any region)
    components: {
      body: 'Hola {{1}}, confirmamos tu pago de S/{{2}} por Habla! Premium. Operación: {{3}}.',
      // Variables: 1=nombre, 2=monto, 3=numeroOperacion
    },
  },
  // ...
};
```

Cada send a un template se hace con type `template`:

```typescript
await wa.enviarTemplate({
  to: '+51999...',
  templateName: 'factura_premium',
  variables: ['Juan', '49.00', 'op_abc123'],
});
```

### Catálogo de las 7 templates canónicas

| # | Template name | Categoría | Trigger | Prioridad |
|---|---|---|---|---|
| 1 | `factura_premium` | UTILITY | Pago Premium acreditado | Alta |
| 2 | `fallo_pago_premium` | UTILITY | Pago Premium falló > 3 intentos | Alta |
| 3 | `renovacion_recordatorio` | MARKETING | 7 días antes de renovación | Media |
| 4 | `cancelacion_efectiva` | UTILITY | Acceso al Channel finalizó | Media |
| 5 | `reembolso_confirmado` | UTILITY | Reembolso procesado | Alta |
| 6 | `premio_mensual_listo` | UTILITY | Top 10 con datos bancarios → pago listo | Media |
| 7 | `welcome_bot_inicial` | UTILITY | Primera vez que el user escribe al bot | Baja |

### Templates en detalle

#### 1. `factura_premium` (UTILITY)

**Trigger:** webhook OpenPay confirma cualquier pago Premium.

**Body:**
```
Hola {{1}} 👋

Confirmamos tu pago de S/{{2}} por Habla! Premium 💎

Detalles:
• Plan: {{3}}
• Próximo cobro: {{4}}
• Operación: {{5}}

Tu acceso al Channel sigue activo. Cualquier duda, responde este mensaje.
```

**Variables:**
- `{{1}}` — Nombre del usuario
- `{{2}}` — Monto en soles (formato "49.00")
- `{{3}}` — Plan ("Mensual" / "Trimestral" / "Anual")
- `{{4}}` — Fecha próximo cobro ("30/04/2027")
- `{{5}}` — Número operación OpenPay

**Ejemplo renderizado:**
```
Hola Juan 👋

Confirmamos tu pago de S/49.00 por Habla! Premium 💎

Detalles:
• Plan: Mensual
• Próximo cobro: 30/05/2026
• Operación: op_abc123def456

Tu acceso al Channel sigue activo. Cualquier duda, responde este mensaje.
```

#### 2. `fallo_pago_premium` (UTILITY)

**Trigger:** `procesarPagosFallidos` cron del Lote E detecta 3 fallos consecutivos.

**Body:**
```
Hola {{1}},

No pudimos procesar tu pago de S/{{2}} de Habla! Premium tras 3 intentos.

Tu acceso al Channel se pausó temporalmente.

Para reactivar:
1. Verifica que tu tarjeta tenga fondos
2. Actualízala aquí: {{3}}

Si necesitas ayuda, responde este mensaje.
```

**Variables:**
- `{{1}}` — Nombre
- `{{2}}` — Monto
- `{{3}}` — Link a `/premium/mi-suscripcion`

#### 3. `renovacion_recordatorio` (MARKETING)

**Trigger:** cron diario detecta suscripciones con renovación en exactamente 7 días.

**Body:**
```
Hola {{1}},

Tu Habla! Premium se renueva en 7 días por S/{{2}} 💎

Si quieres seguir recibiendo picks: no necesitas hacer nada.

Si quieres cancelar: {{3}}

Sigues acertando con nosotros 🎯
```

**Variables:**
- `{{1}}` — Nombre
- `{{2}}` — Monto próximo cobro
- `{{3}}` — Link a `/premium/mi-suscripcion`

**Importante:** esta es categoría **MARKETING**, no UTILITY. Es promocional aunque parezca un recordatorio. Meta es estricta con esa distinción.

#### 4. `cancelacion_efectiva` (UTILITY)

**Trigger:** cron sync membresía detecta cancelación con vencimiento ya pasado.

**Body:**
```
Hola {{1}},

Tu suscripción Habla! Premium finalizó hoy. Te removeremos del Channel pronto.

Gracias por haber sido parte 👋

Si quieres volver: {{2}}
```

**Variables:**
- `{{1}}` — Nombre
- `{{2}}` — Link a `/premium`

#### 5. `reembolso_confirmado` (UTILITY)

**Trigger:** admin procesa reembolso desde `/admin/suscripciones/[id]`.

**Body:**
```
Hola {{1}},

Procesamos tu reembolso de S/{{2}} de Habla! Premium ✅

Operación: {{3}}
El monto llegará a tu tarjeta en 5-10 días hábiles.

Cualquier duda, responde este mensaje.
```

**Variables:**
- `{{1}}` — Nombre
- `{{2}}` — Monto reembolsado
- `{{3}}` — Número de operación reembolso

#### 6. `premio_mensual_listo` (UTILITY)

**Trigger:** admin click "Marcar pagado" en `/admin/premios-mensuales`.

**Body:**
```
🏆 Felicidades {{1}}!

Te transferimos S/{{2}} por la posición #{{3}} de Liga Habla! en {{4}}.

Detalles:
• Banco destino: {{5}}
• Operación: {{6}}
• Fecha: {{7}}

¡Sigue compitiendo! 🎯
```

**Variables:**
- `{{1}}` — Nombre
- `{{2}}` — Monto premio
- `{{3}}` — Posición (1-10)
- `{{4}}` — Mes (ej: "Marzo 2026")
- `{{5}}` — Banco destino del usuario
- `{{6}}` — Número operación
- `{{7}}` — Fecha transferencia

#### 7. `welcome_bot_inicial` (UTILITY)

**Trigger:** primer mensaje que recibe el bot de un teléfono nuevo (sin conversación previa).

**Body:**
```
Hola {{1}}! 👋

Soy el bot de Habla!. Respondo dudas sobre:
• Cómo funciona Premium
• Liga Habla! y premios
• Casas autorizadas en Perú
• EV+, stake, apuesta responsable

Pregúntame lo que necesites. Para temas urgentes derivamos a un humano.

(Solo respondo a suscriptores Premium activos.)
```

**Variables:**
- `{{1}}` — Nombre del usuario

### Header opcional

Algunas templates pueden tener header con imagen, video, o documento. Habla! NO usa headers actualmente para mantener simplicidad y evitar rechazos.

### Footer opcional

Algunas templates incluyen footer con disclaimer:

```
Habla! · Apuesta responsable · 0800-19009
```

Footer va en TODAS las templates de categoría MARKETING.

### Function helper para enviar templates

```typescript
// apps/web/lib/services/whatsapp/wa-business-client.ts (agregar método)

export class WhatsAppBusinessClient {
  // ... métodos existentes ...

  async enviarTemplate(input: {
    to: string;
    templateName: string;
    variables: string[];
    languageCode?: string;
  }): Promise<{ messageId: string }> {
    const language = input.languageCode ?? 'es';

    const response = await fetch(
      `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: input.to,
          type: 'template',
          template: {
            name: input.templateName,
            language: { code: language },
            components: [
              {
                type: 'body',
                parameters: input.variables.map((v) => ({ type: 'text', text: v })),
              },
            ],
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`WhatsApp template error: ${error}`);
    }

    const data = await response.json();
    return { messageId: data.messages[0].id };
  }
}
```

### Catálogo central tipado

```typescript
// apps/web/lib/services/whatsapp/templates.ts

export const WHATSAPP_TEMPLATES = {
  factura_premium: {
    name: 'factura_premium',
    category: 'UTILITY' as const,
    language: 'es' as const,
    variables: ['nombre', 'monto', 'plan', 'proximoCobro', 'operacion'] as const,
  },
  fallo_pago_premium: {
    name: 'fallo_pago_premium',
    category: 'UTILITY' as const,
    language: 'es' as const,
    variables: ['nombre', 'monto', 'linkActualizar'] as const,
  },
  // ... resto
} as const;

// Helper tipado
export async function enviarTemplate<K extends keyof typeof WHATSAPP_TEMPLATES>(
  templateKey: K,
  to: string,
  vars: Record<typeof WHATSAPP_TEMPLATES[K]['variables'][number], string>,
) {
  const tmpl = WHATSAPP_TEMPLATES[templateKey];
  const orderedVars = tmpl.variables.map((k) => vars[k]);

  const wa = new WhatsAppBusinessClient();
  return wa.enviarTemplate({
    to,
    templateName: tmpl.name,
    variables: orderedVars,
    languageCode: tmpl.language,
  });
}

// Uso:
await enviarTemplate('factura_premium', '+51999999999', {
  nombre: 'Juan',
  monto: '49.00',
  plan: 'Mensual',
  proximoCobro: '30/05/2026',
  operacion: 'op_abc123',
});
```

## Datos requeridos

Variables de entorno (ya configuradas en Lote E):

```bash
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_ACCESS_TOKEN
META_BUSINESS_ID
```

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- **Cero MARKETING en horario inoportuno.** Templates MARKETING solo se envían entre 9 AM y 8 PM hora Lima. Templates UTILITY pueden enviarse 24/7.
- **Verify firma** de webhook (ya documentado en Lote E).
- **Watermark NO aplica** en templates (van por categorías Meta, no es contenido editorial). El watermark sí aplica a mensajes free-form de picks (Lote E `pick-formato.spec.md`).
- **Variables sin `\n` entre `{{N}}`** — Meta requiere texto plano. Saltos de línea solo en texto fijo.
- **Idempotencia** en envíos. Si el sistema reintenta, no duplicar.
- **Logs detallados** en cada envío con templateName + recipient + variables (sin PII en logs!).
- **Política de privacidad clara:** los suscriptores aceptan recibir mensajes WhatsApp en el flow de checkout (campo opcional teléfono — si lo proveen, consienten).
- Eventos analíticos:
  - `wa_template_enviado` con `templateName` + `messageId` (NUEVO Lote H)
  - `wa_template_falla_envio` con error code (NUEVO Lote H)
  - `wa_template_aprobada_meta` cuando Meta aprueba/rechaza (manual, opcional)

## Mockup de referencia

Sin mockup. Los templates renderizan directo en WhatsApp del usuario.

## Pasos manuales para Gustavo

### Crear cada template en Meta Business Manager

Para cada uno de los 7 templates canónicos:

1. Ir a https://business.facebook.com/wa/manage/message-templates/.
2. Click "Create template".
3. Configurar:
   - **Name:** copiar el `name` del catálogo (ej: `factura_premium`). Importante: igual al código exacto.
   - **Category:** según tabla del catálogo.
   - **Language:** "Spanish (any region)" (ES).
4. Body: copy-paste del catálogo manteniendo `{{1}}`, `{{2}}`, etc.
5. Add example values para que Meta valide:
   - `{{1}}` = "Juan"
   - `{{2}}` = "49.00"
   - Etc.
6. Submit for approval.
7. Esperar 1-3 días hábiles.
8. Si aprobado: ✅ ya se puede enviar via API.
9. Si rechazado: revisar el motivo + ajustar + resubmit.

### Si Meta rechaza una template

Razones comunes:
- "Promotional content in UTILITY category" → cambiar a MARKETING.
- "Variable count mismatch" → verificar que `{{N}}` corresponda al # de example values.
- "Vague or generic content" → agregar detalles específicos en el body.
- "Footer/Header complejos" → simplificar.

Si el rechazo persiste y bloquea el lanzamiento: contactar soporte de WhatsApp Business via Meta Business Manager.

### Monitorear approval status

Las templates pueden ser **revocadas** post-aprobación si Meta detecta uso inapropiado (ej: muchos usuarios reportan spam). Mejores prácticas:

1. Solo enviar a usuarios que consintieron explícitamente.
2. Respetar opt-out (preferencias notif).
3. No abusar de MARKETING (max 1 mensaje promocional/semana por usuario).

**Validación post-deploy:**

1. Para cada template, hacer test:
   - Disparar el trigger correspondiente (con datos de testing).
   - Verificar que llega el mensaje al teléfono de testing.
   - Verificar que se renderiza con variables correctas.
   - Verificar que NO hay typos.
2. Verificar Railway logs: `wa_template_enviado` con messageId.
3. Si una template es rechazada por Meta a pesar de submit: ese trigger queda **deshabilitado** hasta aprobación. No bloquea el resto del sistema.

---

*Versión 1 · Abril 2026 · WhatsApp templates para Lote H*
