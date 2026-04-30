# Premium landing `/premium`

Vista crítica de conversión de Habla! v3.1. Es donde el usuario decide suscribirse al producto Premium. Mobile-first riguroso. Diseñada con foco en convertir visitantes (anónimos o free) en suscriptores activos.

## Lote responsable

**Lote D** — Premium WhatsApp Channel UI usuario.

## Estado actual del repo

NUEVA — esta vista no existe en el repo actual. Se crea desde cero en Lote D.

Componentes que sí existen y se reutilizan:
- `<NewsletterCTA>` (Lote 10) para CTA secundario "Avísame si no estoy listo".
- Tokens Premium del design system v3.1 (Lote A).

## Cambios necesarios

### Archivos a crear

- `apps/web/app/(public)/premium/page.tsx`:
  - Server component público (accesible sin auth, pero con personalización si auth).
  - Renderiza `<PremiumLandingView>`.
  - `dynamic = 'force-dynamic'` por personalización.

- `apps/web/components/premium/PremiumHero.tsx`:
  - Hero oscuro con gradient `bg-premium-hero-gradient`.
  - Crown icon dorado grande arriba (60×60 con shadow gold).
  - Title: "Picks de valor en tu WhatsApp" con "en tu WhatsApp" en `text-gold`.
  - Sub: "Recibe 2-4 picks/día generados con datos y validados por nuestro editor. Directo en tu canal privado."

- `apps/web/components/premium/WhatsAppChannelMockup.tsx`:
  - Visualización del WhatsApp Channel (decorativo, no funcional).
  - Header con icono Habla! + "Habla! Picks ✓" + "Canal · X suscriptores" donde X es count real.
  - 2 picks de ejemplo con timestamp + emoji 🔥 con count + checks azules.
  - Background `bg-whatsapp-chat-pattern`.
  - Border verde oscuro `border-whatsapp-green-darker` simulando el frame de WhatsApp.
  - Datos: count real de suscriptores activos (query a `prisma.suscripcion.count({ activa: true })`). Si `< 50`: ocultar count para no transmitir falta de social proof.

- `apps/web/components/premium/InclusionesPremium.tsx`:
  - Sección con título "Lo que recibes".
  - 5 items con check ✓ verde + texto:
    1. **2-4 picks/día** con razonamiento estadístico (datos H2H, forma reciente, EV+)
    2. **Casa con mejor cuota** incluida en cada pick — link directo
    3. **Alertas en vivo** durante partidos top (cambios de cuotas, oportunidades)
    4. **Bot de FAQ 24/7** en WhatsApp para resolver dudas al instante
    5. **Resumen semanal** los lunes con performance de los picks

- `apps/web/components/premium/PlanesPremium.tsx`:
  - 3 cards verticales con los planes:
    - **Mensual**: S/ 49/mes · "Cancela cuando quieras"
    - **Anual** (popular): S/ 399/año · "Ahorra 32% · S/ 33.2/mes" — destacado con `card-premium` + badge "Más popular"
    - **Trimestral**: S/ 119/3 meses · "Ahorra 19% · S/ 39.6/mes"
  - Click en plan: scroll smooth a sticky CTA con plan pre-seleccionado.

- `apps/web/components/premium/GarantiaCard.tsx`:
  - Banner `bg-status-green` ancho completo: "✓ Garantía de 7 días · sin compromiso".
  - Sub: "Si no te gusta, te devolvemos el 100% sin preguntas."

- `apps/web/components/premium/SocialProofPremium.tsx`:
  - Sección con stats de social proof:
    - **65%** acierto promedio último mes
    - **847** suscriptores activos (oculto si <50)
    - **+12%** ROI promedio último mes
  - Si los números todavía son bajos (mes 1): ocultar la sección y reemplazar por testimonios curados (text-only).

- `apps/web/components/premium/TestimoniosPremium.tsx`:
  - 3 testimonios curados (text + nombre/inicial, no fotos para no exponer privacidad).
  - Si en mes 1 sin testimonios reales: usar quotes del editor o casos de uso aspiracionales claramente marcados como "Ejemplo".

- `apps/web/components/premium/FAQPremium.tsx`:
  - Accordion con 5 FAQs frecuentes Premium:
    1. ¿Cómo recibo los picks?
    2. ¿Puedo cancelar cuando quiera?
    3. ¿Qué pasa si no acierto?
    4. ¿Comparten mis datos con las casas?
    5. ¿Cuánto tiempo me demora seguir un pick?
  - Reutiliza `<FAQAccordion>` del Lote 0 (refactor mobile-first).

- `apps/web/components/premium/StickyPremiumCTA.tsx`:
  - Sticky bottom específico de Premium landing.
  - Si plan no seleccionado: "⚡ Suscribirme con OpenPay" → linkea a `/premium/checkout?plan=anual` (default).
  - Si plan seleccionado por scroll a un plan: cambia a "⚡ Suscribirme [Plan] · S/ X" con el plan elegido.

### Archivos a modificar

Ninguno. Es una vista nueva.

### Archivos a eliminar

Ninguno.

## Datos requeridos

```typescript
// apps/web/app/(public)/premium/page.tsx
export const dynamic = 'force-dynamic';

export default async function PremiumLandingPage() {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  // Estado del usuario para personalizar
  const estadoUsuario = await detectarEstadoUsuario(userId);

  // Si ya es Premium activo: redirect a /premium/mi-suscripcion
  if (estadoUsuario === 'premium') {
    redirect('/premium/mi-suscripcion');
  }

  // Social proof: count de suscriptores activos
  const suscriptoresCount = await prisma.suscripcion.count({
    where: { activa: true },
  }).catch(() => 0);  // Fallback 0 si Lote E aún no creó el modelo

  // Últimos 3 picks aprobados para preview público (sin valores sensibles)
  const picksPreview = await prisma.pickPremium.findMany({
    where: { aprobado: true },
    orderBy: { fechaPublicacion: 'desc' },
    take: 3,
    select: {
      partido: { select: { local: true, visitante: true } },
      mercado: true,
      // NO incluir cuotaSugerida ni razonamiento (eso es Premium)
    },
  }).catch(() => []);

  return (
    <PremiumLandingView
      estadoUsuario={estadoUsuario}
      suscriptoresCount={suscriptoresCount}
      picksPreview={picksPreview}
    />
  );
}
```

### Servicios necesarios

- `detectarEstadoUsuario` (Lote B nuevo).
- `prisma.suscripcion.count` (Lote E — fallback 0).
- `prisma.pickPremium.findMany` (Lote E — fallback []).

## Estados de UI

### Estructura completa

```
┌──────────────────────────────────┐
│ <MobileHeader variant="public">  │
├──────────────────────────────────┤
│ <PremiumHero>                    │
│   - Crown icon                   │
│   - Title con "en tu WhatsApp"   │
│   - Sub                          │
├──────────────────────────────────┤
│ <WhatsAppChannelMockup>          │  ← visual decorativo
├──────────────────────────────────┤
│ <SocialProofPremium>             │
├──────────────────────────────────┤
│ <InclusionesPremium>             │
├──────────────────────────────────┤
│ <PlanesPremium>                  │
│   - Mensual                      │
│   - Anual (popular)              │
│   - Trimestral                   │
├──────────────────────────────────┤
│ <GarantiaCard>                   │
├──────────────────────────────────┤
│ <TestimoniosPremium>             │
├──────────────────────────────────┤
│ <FAQPremium>                     │
├──────────────────────────────────┤
│ Footer "¿No estás listo?         │
│  Te avisamos cuando lo estés"    │
│  + <NewsletterCTA fuente="...">  │
├──────────────────────────────────┤
│ <Footer> + <BottomNav>           │
└──────────────────────────────────┘

<StickyPremiumCTA>  ← bottom
```

### Variantes según estado del usuario

| Estado | Hero copy | StickyCTA copy | Inclusiones |
|---|---|---|---|
| Anónimo | Genérico | "⚡ Crear cuenta y suscribirme" → `/auth/signup?next=/premium/checkout` | Estándar |
| Free | "Hola Juan · Picks de valor..." | "⚡ Suscribirme con OpenPay" → `/premium/checkout` | Estándar |
| FTD | "Tu acierto: X% · Premium llega a 65%" | "⚡ Suscribirme · ahorra 32% con anual" | Estándar |
| Premium | (redirect a /premium/mi-suscripcion) | (no aplica) | (no aplica) |

### Loading

- Server component → render directo.
- Si `prisma.suscripcion` o `prisma.pickPremium` no existen aún (Lote E pendiente): los componentes muestran placeholders.

### Empty / Error

- Si Lote E aún no creó el modelo `PickPremium`: `<WhatsAppChannelMockup>` muestra picks de ejemplo hardcodeados con label claro "Ejemplo" o "Próximos picks".
- Si OpenPay aún no está configurado (env vars vacías): el `<StickyPremiumCTA>` cambia a "⚡ Próximamente · Avísame" linkeando al newsletter de espera.

## Componentes que reutiliza

- `<MobileHeader>` (Lote A).
- `<BottomNav>` (Lote A).
- `<Card>`, `<Button>`, `<Badge>` del design system.
- `<FAQAccordion>` (Lote 0, refactor mobile-first).
- `<NewsletterCTA>` (Lote 10).
- Tokens Premium del Lote A (premium-surface, premium-border, etc.).
- Tokens WhatsApp del Lote A (whatsapp-green, whatsapp-chat-bg, etc.).

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- Mobile-first riguroso. Esta es la vista de conversión más importante de Premium.
- Lighthouse Mobile target >90.
- LCP <2.5s — el `<WhatsAppChannelMockup>` puede ser pesado, optimizar con `loading="lazy"` para imágenes y `next/image` cuando aplique.
- Touch targets ≥44px en cards de planes y CTAs.
- Cero hex hardcodeados.
- Eventos analíticos:
  - `premium_landing_visto` en mount (NUEVO Lote D).
  - `premium_plan_seleccionado` cuando click en card de plan (NUEVO Lote D).
  - `premium_checkout_iniciado` cuando click en sticky CTA (NUEVO Lote D, también disparado en `/premium/checkout`).

## Mockup de referencia

`premium-landing.html` en este mismo folder.

También ver `00-design-system/mockup-actualizado.html` sección "07 · Premium landing" como referencia secundaria.

## Pasos manuales para Gustavo post-deploy

**Antes del primer deploy de esta vista:**

1. Configurar OpenPay BBVA (ver `suscripciones-backend.spec.md` del Paquete 5B). Sin OpenPay funcional, el sticky CTA muestra fallback "Próximamente".
2. Crear el WhatsApp Channel privado *Habla! Picks*:
   - Abrir WhatsApp en tu teléfono.
   - Ir a "Actualizaciones" (pestaña inferior).
   - Tap en el ícono "+" arriba a la derecha → "Crear canal".
   - Nombre: `Habla! Picks`
   - Descripción: `Picks de valor con razonamiento. Solo suscriptores Premium.`
   - Subir el ícono del canal: usa el logo Habla! cuadrado (te lo paso por separado).
   - Configuración → Visibilidad: **No discoverable** (privado).
   - Click en "Crear".
   - Una vez creado, copia el link de invitación del canal.
   - Pegarlo en Railway como variable `WHATSAPP_CHANNEL_PREMIUM_INVITE_LINK`.
3. Subir 3-5 picks históricos de ejemplo al canal antes de abrir suscripciones (para que los primeros suscriptores no encuentren un canal vacío).

**Validación post-deploy:**
1. Abrir `hablaplay.com/premium` (sin login).
2. Verificar hero, mockup WA, planes, garantía, FAQ.
3. Verificar que `<SocialProofPremium>` muestra count real (o se oculta si <50).
4. Probar click en plan → scroll a sticky CTA con plan seleccionado.
5. Click en sticky CTA → debe ir a `/premium/checkout?plan=anual` (o lo que hayas seleccionado).
6. Si OpenPay aún no configurado: verificar que el sticky muestra fallback "Próximamente".
7. Loguearte como Premium (cuando exista flujo): verificar redirect automático a `/premium/mi-suscripcion`.

---

*Versión 1 · Abril 2026 · Premium landing para Lote D*
