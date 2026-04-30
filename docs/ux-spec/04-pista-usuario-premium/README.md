# Pista Usuario Premium — Lotes D + E

Specs y mockups de la capa Premium completa de Habla! v3.1. Esta carpeta es lo que Claude Code lee al ejecutar **Lote D (Premium WhatsApp Channel — UI usuario)** y **Lote E (Premium backend — automatización)** del roadmap A-J.

## Cómo lee este folder Claude Code

Cuando se ejecuten los Lotes D y/o E, leer en este orden:

1. Este `README.md` (visión general + dependencias).
2. La carpeta `00-design-system/` (tokens Premium en `tokens.md`, componentes en `componentes-mobile.md`).
3. Las carpetas `02-pista-usuario-publica/` y `03-pista-usuario-autenticada/` para entender los componentes embebidos `<PickBloqueadoTeaser>`, `<AlertasPremium>`, `<PremiumStatusCard>` que viven en B y C pero requieren el modelo `Suscripcion` de E.
4. Cada `.spec.md` de esta carpeta en el orden de implementación recomendado abajo.

## Decisión arquitectónica clave

**Premium se descompone en 2 lotes ejecutables en orden estricto:**

- **Lote D (Frontend de Premium):** todas las vistas `/premium/*` que el usuario navega. Depende del modelo `Suscripcion` que crea Lote E. Si Lote D corre antes que E, todas las queries devuelven `null` o vacío y los componentes muestran fallback "Próximamente".
- **Lote E (Backend de Premium):** modelos de BD, services, webhooks, crons, integración con OpenPay, WhatsApp Business API, Anthropic API. Sin UI directa pero crítico para que D funcione.

**Orden recomendado:** Lote E primero (modelos + services + integraciones), luego Lote D (UI). Esto evita que Lote D quede con muchos fallbacks visibles en producción.

**Excepción:** si Meta Business Account o OpenPay BBVA tardan más en aprobar de lo esperado, ejecutar Lote D primero con fallbacks claros y completar E cuando las credenciales estén listas. Esto permite que la landing `/premium` esté pública para captar early signups (newsletter de espera) aunque la suscripción real no esté activa todavía.

## Orden de implementación recomendado

### Lote E (Backend) — implementar primero si las APIs externas están listas

| # | Spec | Descripción |
|---|---|---|
| 1 | `suscripciones-backend.spec.md` | Modelos `Suscripcion`, `PagoSuscripcion`, services, OpenPay client, webhook |
| 2 | `picks-premium-generacion.spec.md` | Modelo `PickPremium`, generador con Claude API, flujo de aprobación |
| 3 | `whatsapp-channel-flow.spec.md` | Cliente WhatsApp Business, push al Channel, gestión membresía |
| 4 | `pick-formato.spec.md` | Plantilla del mensaje del pick en WhatsApp Channel |
| 5 | `bot-faq.spec.md` | Bot 1:1 vía Business API + Claude API + base de conocimiento |
| 6 | `cron-sync-membresia.spec.md` | Cron horario que sincroniza Channel ↔ suscripciones activas |

### Lote D (Frontend) — implementar después de E

| # | Spec | Mockup | Descripción |
|---|---|---|---|
| 1 | `premium-landing.spec.md` ⭐ | `premium-landing.html` | Vista `/premium` con hero + WA mockup + planes + garantía |
| 2 | `checkout.spec.md` | `checkout.html` | Vista `/premium/checkout` con OpenPay form embebido |
| 3 | `post-pago.spec.md` | `post-pago.html` | Vista `/premium/exito` con deep link a Channel |
| 4 | `mi-suscripcion.spec.md` | `mi-suscripcion.html` | Vista `/premium/mi-suscripcion` con gestión |
| 5 | `pick-bloqueado.spec.md` | (sin mockup individual) | Spec del componente `<PickBloqueadoTeaser>` reusable en B y C |

## Producto Premium del plan v3.1

Resumen del modelo (fuente de verdad: `Habla_Plan_de_Negocios_v3.1.md`):

- **Acceso primario:** WhatsApp Channel privado *Habla! Picks* (broadcast 1-a-N, no grupo, escala mejor).
- **Acceso secundario:** sección `/premium/contenido` del sitio (scope reducido para 8 mayo).
- **Bot 1:1:** WhatsApp Business API para FAQ usando Claude API + base curada.
- **Slogan:** *"Habla! Todas las fijas en una"*.
- **3 planes:**
  - Mensual: S/ 49/mes
  - Trimestral: S/ 119 (S/ 39.6/mes — ahorro 19%)
  - Anual: S/ 399 (S/ 33.2/mes — ahorro 32%) — **plan destacado**
- **Garantía:** 7 días sin compromiso, reembolso completo.
- **Inclusiones:**
  - 2-4 picks/día con razonamiento estadístico (datos H2H, forma reciente, EV+)
  - Casa con mejor cuota incluida en cada pick
  - Alertas en vivo durante partidos top
  - Bot FAQ 24/7
  - Resumen semanal lunes
- **Pasarela:** OpenPay BBVA (Perú).
- **Rotación de link Channel:** cada 6 meses para evitar leaks.
- **Watermark con email del usuario** en cada pick (decorativo, dificulta forwarding masivo).

## Métricas de éxito Premium (Lote G dashboard)

Lote E debe instrumentar eventos para que Lote G pueda mostrar:

- MRR Premium
- Tasa de conversión free → Premium
- Churn mensual (target <20%)
- Engagement Channel (lecturas/envíos)
- % acierto agregado de picks (target >55%)
- Reembolsos en garantía (target <5%)

## Variables de entorno nuevas (paso manual de Gustavo en Railway)

Cada spec lista las suyas. Resumen consolidado:

```bash
# OpenPay BBVA (Lote D)
OPENPAY_MERCHANT_ID
OPENPAY_PRIVATE_KEY
OPENPAY_PUBLIC_KEY
OPENPAY_PRODUCTION  # 'true' en prod

# WhatsApp Business API (Lote E)
META_BUSINESS_ID
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_ACCESS_TOKEN
WHATSAPP_VERIFY_TOKEN  # para webhook
WHATSAPP_CHANNEL_PUBLIC_ID
WHATSAPP_CHANNEL_PREMIUM_ID
WHATSAPP_CHANNEL_PREMIUM_INVITE_LINK  # rotable cada 6 meses

# Claude API (Lote E)
ANTHROPIC_API_KEY
ANTHROPIC_MODEL  # 'claude-opus-4-7' por default
```

## Convenciones

Cada `.spec.md` sigue la estructura canónica de 8 secciones definida en el README raíz de `docs/ux-spec/`.

## Reglas duras (extiende reglas 1-13 del CLAUDE.md raíz)

1. **Mobile-first riguroso** para vistas `/premium/*`.
2. **Reutilizar tokens Premium** del Lote A (`premium-surface`, `premium-border`, etc.).
3. **Cero ejecución local.** Validación pre-push: `pnpm tsc --noEmit` + `pnpm lint`.
4. **Webhooks con verificación de firma.** OpenPay y WhatsApp Business API ambos firman sus webhooks. Validar siempre.
5. **Tasa de retry para envíos críticos.** Pago no acreditado, pick no enviado al Channel: 3 reintentos con backoff exponencial. Después → log critical + alert al admin.
6. **Pasos manuales para Gustavo explícitos** (especialmente para configurar Meta Business y OpenPay).

## Estado de las specs del Lote D + E

| Spec | Paquete entrega | Estado |
|---|---|---|
| `premium-landing.spec.md` + `.html` ⭐ | 5A | ✅ |
| `checkout.spec.md` + `.html` | 5A | ✅ |
| `post-pago.spec.md` + `.html` | 5A | ✅ |
| `mi-suscripcion.spec.md` + `.html` | 5A | ✅ |
| `suscripciones-backend.spec.md` ⭐ | 5B | ⏳ |
| `picks-premium-generacion.spec.md` ⭐ | 5B | ⏳ |
| `whatsapp-channel-flow.spec.md` | 5B | ⏳ |
| `pick-bloqueado.spec.md` | 5C | ⏳ |
| `pick-formato.spec.md` | 5C | ⏳ |
| `bot-faq.spec.md` | 5C | ⏳ |
| `cron-sync-membresia.spec.md` | 5C | ⏳ |

---

*Versión 1 · Abril 2026 · Lotes D + E Premium*
