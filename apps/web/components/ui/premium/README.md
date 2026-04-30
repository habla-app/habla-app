# `components/ui/premium/` — pendiente Lote D

Carpeta reservada para componentes específicos de la suscripción Premium
(WhatsApp Channel privado + bot FAQ vía Business API). Creada en Lote A
para fijar la estructura del Design System v3.1, queda vacía hasta el
Lote D donde se construyen los componentes de la pista usuario Premium.

Los tokens visuales de Premium ya están operativos desde Lote A:

- **Colores**: `premium-surface`, `premium-surface-2`, `premium-border`,
  `premium-border-soft`, `premium-text-on-dark`, `premium-text-muted-on-dark`,
  `premium-text-soft-on-dark`, `premium-watermark`, `premium-blur-content`.
- **Backgrounds**: `bg-premium-card-gradient`, `bg-premium-hero-gradient`,
  `bg-premium-lock-overlay`, `bg-gold-soft-glow`, `bg-whatsapp-chat-pattern`.
- **Sombras**: `shadow-premium-card`, `shadow-premium-cta`, `shadow-premium-locked`.
- **Utility CSS**: `.premium-watermark` (overlay con email del usuario).
- **Variante de `<Card>` base**: `<Card variant="premium">`.

## Componentes que vienen en Lote D

Según `docs/ux-spec/04-pista-usuario-premium/`:

| Componente | Spec |
|---|---|
| `<PickWrapper>` | Reusable; renderiza un pick Premium con razonamiento estadístico, casa con mejor cuota, watermark del email del usuario. |
| `<PickBloqueadoTeaser>` | Pick Premium con paywall — overlay blur + lock icon + CTA "Probar 7 días gratis". |
| `<WhatsAppMockup>` | Mockup visual del Channel privado (con `bg-whatsapp-chat-pattern`) usado en `/premium` landing. |
| `<PremiumBadge>` | Badge dorado/oscuro `💎 PREMIUM` (la variante `premium` de `<Badge>` base ya cubre el caso simple). |
| `<PremiumCTACard>` | CTA dorado con shadow `premium-cta` y border `premium-border` para conversión. |
| `<PlanSelector>` | Selector de planes Mensual/Trimestral/Anual con highlight del más popular. |

Hasta el Lote D, los lotes B y C que necesiten un teaser Premium pueden
componer manualmente con `<Card variant="premium">` + `<Button>` y los
tokens ya disponibles.
