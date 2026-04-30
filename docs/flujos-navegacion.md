# Flujos de Navegación — Habla! v3.1

Diagramas de cómo el usuario transita entre vistas según su estado. Cada flujo describe los CTAs prominentes, las decisiones de routing y los puntos donde se dispara conversión a la siguiente etapa.

## Estados del usuario

Habla! reconoce 5 estados que determinan la jerarquía de CTAs y el contenido visible:

| Estado | Detección técnica | CTA dominante en B y C |
|---|---|---|
| **0. Visitante anónimo** | Sin session, sin cookie de tracking | 🏆 Liga Habla! ("Compite gratis") |
| **1. Registrado free** | Session válida, no hay `prisma.suscripcion.activa`, no hay `prisma.clickAfiliado` reciente con FTD reportado | 💎 Premium ("Pick bloqueado") |
| **2. FTD activo (no Premium)** | Session válida + cookie de afiliado + flag `usuario.ftdReportado` + sin suscripción activa | 💎 Premium ("Tu acierto puede subir") |
| **3. Suscriptor Premium** | Session válida + `prisma.suscripcion.activa = true` + miembro del Channel | 💰 Cross-sell de afiliado ("Apostar en X casa") |
| **4. Admin** | Session válida + `usuario.rol = 'ADMIN'` | (no aplica — admin no es target de conversión) |

---

## 1. Flujo del visitante anónimo (Estado 0)

Es el flujo más importante porque representa el 80%+ del tráfico durante el Mundial. La meta es convertirlo a Estado 1 (registro) o Estado 2 (FTD directo si ya tenía cuenta en una casa).

```
┌─────────────────────────────────────────────────────────────────┐
│  ENTRADA EXTERNA                                                │
│  • TikTok / IG / Pauta paga → /partidos/[slug] (B)              │
│  • SEO orgánico → /casas, /guias, /blog                         │
│  • SEO de partido → /partidos/[slug] (B) directamente           │
│  • Word of mouth → / o /comunidad/torneo/[slug] (C)             │
└────────────────────┬────────────────────────────────────────────┘
                     │
            ┌────────┴────────┐
            ▼                 ▼
    ┌──────────────┐  ┌──────────────┐
    │  /  (Home)   │  │ Vistas SEO   │
    │              │  │ /casas, /blog│
    │ Hero +       │  │ /guias       │
    │ próximos     │  │              │
    │ partidos +   │  │ Cross-link   │
    │ Liga +       │  │ a /partidos/ │
    │ Premium      │  │              │
    └──────┬───────┘  └──────┬───────┘
           │                 │
           ▼                 ▼
    ┌──────────────────────────────────┐
    │  /partidos/[slug]  (PRODUCTO B)  │
    │                                  │
    │  ┌────────────────────────────┐  │
    │  │ Análisis editorial gratis  │  │
    │  │ Comparador de cuotas       │  │ ← CTA AFILIADO
    │  │ Pronóstico Habla! gratis   │  │   (botón → /go/[casa])
    │  │ Pick Premium 🔒 (FOMO)     │  │ ← CTA PREMIUM
    │  │ Widget Liga Habla! 234     │  │ ← CTA REGISTRO
    │  │   tipsters compitiendo     │  │
    │  └────────────────────────────┘  │
    │                                  │
    │  Sticky bottom CTA:              │
    │  💰 Apostar en Betano @ 2.05    │
    └──────────┬───────────────────────┘
               │
        ┌──────┼──────┐──────────────┐
        ▼      ▼      ▼              ▼
    [Click   [Click  [Click       [Click
     Liga]   Prem]   Afiliado]   Cross-link C]
        │      │      │              │
        ▼      ▼      ▼              ▼
   /auth/  /premium  /go/[casa]   /comunidad/
   signup            (redirect    torneo/[slug]
   (con              + cookie     (PRODUCTO C)
   "Compite          afiliado)
   por S/500"
   como
   motivador)
```

**Puntos críticos:**

1. **Producto A nunca aparece en hero ni navegación principal.** Solo aparece como link contextual ("¿qué es BTTS? →") al pie del análisis en B y C.
2. **El CTA dominante visible en sticky bottom es el más cercano a conversión:** afiliado en B, predicción en C. Pero los 3 CTAs (Liga, Premium, Afiliado) están todos visibles en el cuerpo de la vista.
3. **Cuando el visitante anónimo hace click a una casa, se dispara `/go/[casa]`** que registra `ClickAfiliado` con UTM y cookie de tracking de 30 días. Si ese mismo dispositivo regresa y se registra después, se atribuye al click original.

---

## 2. Flujo del registrado free (Estado 1)

Una vez registrado, la meta es que haga FTD (Estado 2) o se suscriba a Premium (Estado 3).

```
┌─────────────────────────────────────────────────────────────────┐
│  ENTRADA POR SESSION                                            │
│  El usuario llega a la app ya logueado (cookie de session)      │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
            ┌────────────────────┐
            │  /  (Home          │
            │   personalizada)   │
            │                    │
            │  - Saludo: "Hola   │
            │    Juan"           │
            │  - Próximo partido │
            │    con tu          │
            │    predicción      │
            │    ya enviada      │
            │  - Tu pos. en Liga │
            │    "#156 → Top 100"│
            │  - Pick Premium    │
            │    bloqueado       │
            │    (CTA dominante) │
            │  - Banner casa     │
            │    "Bono S/100"    │
            └─────────┬──────────┘
                      │
            ┌─────────┴──────────┐
            ▼                    ▼
   ┌──────────────────┐ ┌──────────────────┐
   │ Predecir partido │ │ Apostar en casa  │
   │ → /comunidad/    │ │ → /go/[casa]     │
   │   torneo/[slug]  │ │                  │
   │                  │ │ (después FTD →   │
   │ Form 5 mercados  │ │  Estado 2)       │
   │ + Leaderboard    │ │                  │
   │ + CTA Premium    │ │                  │
   │   inline         │ │                  │
   │ + CTA afiliado   │ │                  │
   │   "Mejor cuota:  │ │                  │
   │   Betano 2.05"   │ │                  │
   └─────────┬────────┘ └──────────────────┘
             │
             ▼
   [Click "Apostar en Betano"]
             │
             ▼
   /go/betano?subid=torneo-{id}
   (genera ClickAfiliado + cookie 30d)
             │
             ▼
   [Casa de apuestas externa]
             │
             ▼
   [Si deposita → casa reporta FTD a Habla!]
   [→ Usuario pasa a Estado 2]
```

**Puntos críticos:**

1. **El registrado free ve la home con CTAs invertidos respecto al anónimo.** Liga Habla! pasa a CTA secundario (ya está dentro), Premium pasa a CTA dominante.
2. **La predicción en Producto C nunca cobra dinero al usuario.** El stake de la apuesta real (si decide apostar) ocurre en la casa externa vía `/go/[casa]`.
3. **Email automation se dispara al registro:** newsletter de bienvenida + email "Tu primer pronóstico" + recordatorios semanales (Lote 10 ya tiene Resend cableado).

---

## 3. Flujo del FTD activo no Premium (Estado 2)

El usuario apuesta regularmente en al menos una casa pero no es suscriptor Premium. Es el target principal del CTA Premium.

```
┌──────────────────────────────────────────────────────────────────┐
│  CTAs PERSONALIZADOS POR ESTADO 2                                │
│                                                                  │
│  /  (Home)                                                       │
│   • Hero: "Llevas 2 meses con nosotros. Tu acierto: 47%."        │
│   • Banner persistente: "Premium llega a 65%. Prueba 7 días"     │
│   • Pick Premium bloqueado (más prominente que Estado 1)         │
│   • Cross-sell de casa: "¿Probaste Stake? Bono S/100 nuevo"      │
│     (NO muestra Betano si ya tiene cuenta ahí)                   │
└──────────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                ▼                           ▼
       ┌────────────────┐         ┌────────────────┐
       │ /premium       │         │ Cross-sell     │
       │ (suscribirse)  │         │ de casa nueva  │
       │                │         │ → /go/[stake]  │
       │ Hero + WA      │         │                │
       │ mockup + 3     │         │ Cookie nueva   │
       │ planes +       │         │ + segunda      │
       │ garantía       │         │ casa = más     │
       │                │         │ RevShare       │
       │ Sticky CTA:    │         │                │
       │ "Suscribirme   │         │                │
       │  con OpenPay"  │         │                │
       └───────┬────────┘         └────────────────┘
               │
               ▼
       /premium/checkout
       (form OpenPay embebido)
               │
               ▼
       [OpenPay procesa pago]
               │
               ▼
       Webhook OpenPay → Habla!
               │
               ▼
       Crea prisma.suscripcion(activa=true)
               │
               ▼
       Email automatizado:
       "¡Bienvenido a Premium!"
       + Link único al WhatsApp Channel privado
       + Watermark con email del usuario
               │
               ▼
       /premium/exito
       (deep link a WhatsApp)
               │
               ▼
       [Usuario pasa a Estado 3]
```

**Puntos críticos:**

1. **Segmentación de cross-sell:** `prisma.usuario.casasConectadas` registra qué casas tiene activas. Los banners de afiliado en la app filtran esa lista para mostrar solo casas distintas. Esto requiere agregar columna `casas` o tabla `UsuarioCasa` en Lote D/E.
2. **El email post-pago contiene el link único al WhatsApp Channel privado.** El link está en una env var rotada cada 6 meses. Después de la rotación, el cron Job Q reenvía link nuevo a todos los suscriptores activos.
3. **El sticky CTA en /premium siempre dice "Suscribirme con OpenPay".** No usar "Comprar" ni "Pagar" — "Suscribirme" comunica recurrencia de forma transparente.

---

## 4. Flujo del suscriptor Premium (Estado 3)

El usuario ya está suscrito y recibe picks por WhatsApp. La meta ahora es retención (reducir churn) y afiliación cruzada (que abra cuentas en 2-3 casas distintas).

```
┌──────────────────────────────────────────────────────────────────┐
│  EXPERIENCIA PRIMARIA: WhatsApp Channel privado                  │
│                                                                  │
│  El usuario consume Habla! mayormente desde WhatsApp:            │
│  • 2-4 picks/día con razonamiento                                │
│  • Cada pick incluye link directo a casa con mejor cuota         │
│  • Alertas en vivo durante partidos top                          │
│  • Bot de FAQ 1:1 vía Business API                               │
│                                                                  │
│  La app web es secundaria pero sigue siendo importante:          │
│  • Validar perfil, gestión de suscripción                        │
│  • Histórico de picks, performance del editor                    │
│  • Liga Habla! (sigue compitiendo gratis)                        │
└──────────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴────────────┐
                ▼                          ▼
       ┌─────────────────┐        ┌────────────────────┐
       │  WhatsApp App   │        │  hablaplay.com     │
       │  (móvil)        │        │  (móvil/desktop)   │
       │                 │        │                    │
       │  Channel privado│        │  /premium/         │
       │  picks + alerts │        │  contenido         │
       │                 │        │  (sección Premium  │
       │  Bot 1:1 chat   │        │   del sitio)       │
       │  para FAQ       │        │                    │
       │                 │        │  /premium/         │
       │  Reaccion emoji │        │  mi-suscripcion    │
       │  📈 si ganaron  │        │  (gestión, próximo │
       │  con el pick    │        │   cobro, cancelar) │
       └────────┬────────┘        └─────────┬──────────┘
                │                           │
                ▼                           ▼
       [Click link en pick]          [Cross-sell casa]
                │                           │
                ▼                           ▼
       /go/[casa]?subid=                /go/[casa-nueva]
       channel-pick-{id}                (con bono Premium
       (registra click                   exclusivo)
        + tag "premium")
                │                           │
                ▼                           ▼
       [Apuesta exitosa]            [Abre cuenta en
                │                    casa adicional]
                ▼                           │
       [Reporta ganancia                    ▼
        casa → más RevShare           [Estado 4: Usuario
        para Habla!]                   ideal · Premium +
                                       afiliado activo en
                                       2-3 casas]
```

**Puntos críticos:**

1. **El admin tiene visibilidad total:** `/admin/channel-premium` muestra qué picks tienen más reacciones (datos para mejorar), `/admin/picks-premium/historico` muestra % acierto agregado público (importante para retener suscriptores).
2. **Cancelación de suscripción:** desde `/premium/mi-suscripcion`. Al cancelar, el cron Job Q remueve del Channel en menos de 1 hora. El usuario sigue siendo registrado free (Estado 1) y mantiene su histórico de Liga Habla!.
3. **Cross-sell agresivo de casas:** cada pick recomienda explícitamente "Mejor cuota: X casa". Si el suscriptor no tiene cuenta ahí, es un afiliado natural. Esto multiplica el RevShare por usuario.

---

## 5. Flujo del admin (Estado 4)

El admin opera desde desktop. Su flujo es muy distinto: tablas densas, filtros, atajos. No es target de conversión, es operador del negocio.

```
┌──────────────────────────────────────────────────────────────────┐
│  ENTRADA: /auth/signin (mismo flujo que usuario)                 │
│  Detección post-login: usuario.rol === 'ADMIN' → redirect a     │
│  /admin/dashboard                                                │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ▼
       ┌─────────────────────────────────────┐
       │  /admin/dashboard                   │
       │                                     │
       │  Sidebar fijo (desktop):            │
       │  ▸ Dashboard                        │
       │  ▸ Operación                        │
       │    • Picks Premium (cola)           │
       │    • Channel WhatsApp               │
       │    • Suscripciones                  │
       │    • Afiliados / Conversiones       │
       │    • Newsletter                     │
       │    • Premios mensuales              │
       │  ▸ Análisis                         │
       │    • KPIs                           │
       │    • Cohortes                       │
       │    • Mobile vitals                  │
       │    • Finanzas                       │
       │    • Alarmas                        │
       │  ▸ Contenido                        │
       │    • Editor MDX                     │
       │    • Partidos                       │
       │    • Casas                          │
       │  ▸ Sistema                          │
       │    • Logs                           │
       │    • Auditoría                      │
       │    • Usuarios                       │
       │                                     │
       │  Contenido principal:               │
       │  - 5 grupos de KPIs (cards)         │
       │  - Alarmas activas                  │
       │  - Atajo: "Validar 4 picks pdtes"   │
       └──────────────┬──────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
   ┌─────────┐  ┌──────────┐  ┌──────────┐
   │ Validar │  │ Revisar  │  │ Investigar│
   │ picks   │  │ alarma   │  │ KPI rojo │
   │ Premium │  │ activa   │  │          │
   │ (cola)  │  │          │  │ /admin/  │
   │         │  │          │  │ cohortes │
   │ Vista 2 │  │ /admin/  │  │ o        │
   │ paneles:│  │ alarmas  │  │ /admin/  │
   │ izq=cola│  │          │  │ finanzas │
   │ der=    │  │          │  │          │
   │ pick    │  │          │  │          │
   │ actual  │  │          │  │          │
   └─────────┘  └──────────┘  └──────────┘
```

**Puntos críticos del admin:**

1. **Sidebar siempre visible** (desktop optimizado). Permite navegar sin volver al dashboard.
2. **Atajos de teclado** en validación de picks: `A` aprobar, `R` rechazar, `E` editar, `Esc` cerrar. Esto reduce el tiempo de validación a <2min/pick.
3. **Dashboard es la vista de inicio** y muestra alarmas. Si hay un KPI en rojo, aparece banner superior persistente con CTA "Ver acción correctiva".
4. **Tablas densas con filtros:** todas las tablas admin tienen filtros por fecha, estado, búsqueda. Pagina de 50 filas por defecto en desktop.

---

## 6. Flujo cross-product B↔C (sincronía clave del modelo v3.1)

```
                  PARTIDO: Alianza vs Universitario
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
   ┌─────────────────────┐         ┌─────────────────────┐
   │ /partidos/          │         │ /comunidad/torneo/  │
   │ alianza-vs-uni      │ ◄─────► │ alianza-vs-uni      │
   │ (PRODUCTO B)        │         │ (PRODUCTO C)        │
   │                     │         │                     │
   │ Análisis editorial  │         │ Form de predicción  │
   │ Comparador cuotas   │         │ Leaderboard preview │
   │ Pronóstico Habla!   │         │ Tu posición         │
   │ Pick Premium 🔒     │         │ Premio del mes      │
   │                     │         │                     │
   │ [Widget cross]      │         │ [Widget cross]      │
   │ "🏆 Compite por     │         │ "📊 Ver análisis    │
   │  este partido en    │         │  completo y cuotas  │
   │  la Liga Habla!     │         │  comparadas →"      │
   │  234 tipsters"      │         │                     │
   │                     │         │ [Widget afiliado]   │
   │ Sticky bottom:      │         │ "💰 Mejor cuota:    │
   │ 💰 Apostar Betano   │         │  Betano 2.05 →"     │
   │ @ 2.05              │         │                     │
   │                     │         │ Sticky bottom:      │
   │                     │         │ 🏆 Enviar predic.   │
   └─────────────────────┘         └─────────────────────┘
              ▲                               ▲
              │                               │
              └─── El usuario rebota ─────────┘
                   entre vistas durante
                   su sesión: aumenta
                   tiempo en sitio +
                   genera más
                   exposición a CTAs
```

**Implementación técnica de la sincronía:**

- Cada `Partido` en BD tiene `partidoSlug` que sirve para ambas URLs.
- Componente `<CrossProductBanner>` (NUEVO en Lote A) recibe prop `direccion: 'B-to-C' | 'C-to-B'` y renderiza el widget correcto.
- El link en el banner cross apunta directamente a la URL del otro producto, preservando query params relevantes (UTM, etc.).

---

## 7. Reglas de visibilidad de CTAs por estado

Esta tabla es el manual de implementación para la lógica de personalización de CTAs en B y C:

| CTA | Estado 0 (anónimo) | Estado 1 (free) | Estado 2 (FTD) | Estado 3 (Premium) |
|---|---|---|---|---|
| 🏆 **Liga Habla!** | DOMINANTE (sticky + grande) | secundario (mini) | secundario (mini) | secundario (mini) |
| 💎 **Premium pick bloqueado** | secundario | DOMINANTE (grande + FOMO) | DOMINANTE (banner persistente "tu acierto X% → 65%") | OCULTO (ya es Premium) |
| 💰 **Afiliado** (cuotas + casa) | secundario | secundario | secundario (cross-sell de casa NUEVA solo) | DOMINANTE (cross-sell agresivo) |
| 📊 **Cross-link a otro producto B↔C** | siempre visible | siempre visible | siempre visible | siempre visible |
| 📰 **Newsletter** | secundario en footer | OCULTO (ya está suscrito por defecto al registrarse) | OCULTO | OCULTO |

**Implementación:** componente `<CTAJerarquico>` (NUEVO en Lote A) recibe prop `estadoUsuario` y renderiza el CTA correcto con el estilo correspondiente (dominante = sticky bottom + tamaño XL; secundario = inline + tamaño M; oculto = no renderiza).

---

## 8. Estados de error y casos borde

| Caso | Comportamiento esperado |
|---|---|
| Usuario sin session intenta acceder a `/comunidad/torneo/[slug]` | Redirigir a `/auth/signin?callbackUrl=/comunidad/torneo/[slug]` |
| Usuario free intenta acceder a `/premium/mi-suscripcion` | Redirigir a `/premium` con mensaje "Aún no eres Premium" |
| Suscriptor activo cancela suscripción | Cambia a Estado 1, sigue accediendo a `/premium/mi-suscripcion` por gracia hasta fin del período pagado |
| Cookie de afiliado expira (>30 días) | Si el usuario regresa, no se atribuye al click anterior. Si hace click nuevo, se genera ClickAfiliado nuevo. |
| Casa pierde licencia MINCETUR (cron K detecta) | Casa se desactiva (`activo=false`). Endpoints `/go/[casa]` devuelven 404 con HTML "Casa no disponible". Componentes `<CasaCTA>` no la renderizan. Email crítico al admin. |
| OpenPay webhook falla | Cron de retry cada 5 min hasta 6 intentos. Después escalación al admin via email. La suscripción NO se activa hasta que el webhook se procese exitosamente. |
| Pick Premium falla en envío al WhatsApp Channel | Reintentar 3 veces con backoff. Si falla, log nivel critical → admin alert. El pick queda en cola para reenvío manual desde `/admin/picks-premium`. |

---

## 9. Eventos analíticos disparados en cada flujo

Lista de referencia para Claude Code: cada vista/acción dispara `analytics.track()` con el evento canónico correspondiente. Lote 6 ya cableó muchos; los nuevos van en Lotes B-J.

| Evento | Cuándo se dispara | Estado actual | Lote |
|---|---|---|---|
| `signup_started` | Mount de `/auth/signup` | ✅ Lote 6 | - |
| `signup_completed` | POST `/auth/signup` ok | ✅ Lote 6 | - |
| `email_verified` | events.signIn ok | ✅ Lote 6 | - |
| `match_viewed` | Mount de `/torneo/[id]` | ✅ Lote 6 (renombrar a `partido_visto` en B/C nuevos) | B |
| `prediccion_enviada` | POST `/tickets` ok | ✅ Lote 6 | - |
| `comunidad_leaderboard_visto` | Mount de `/comunidad` | ✅ Lote 6 | - |
| `articulo_visto` | Mount de `/blog/[slug]` | ✅ Lote 8 | - |
| `casa_click_afiliado` | Click en `/go/[casa]` | ✅ Lote 7 | - |
| `cuotas_comparator_visto` | Mount de `<CuotasComparator>` | ✅ Lote 9 | - |
| `newsletter_suscripcion` | POST `/api/v1/newsletter/suscribir` | ✅ Lote 10 | - |
| `pick_premium_blocked_visto` ⭐ | Mount del componente `<PickBloqueadoTeaser>` en B o C | ⏳ NUEVO | B |
| `premium_landing_visto` ⭐ | Mount de `/premium` | ⏳ NUEVO | D |
| `premium_checkout_iniciado` ⭐ | Mount de `/premium/checkout` | ⏳ NUEVO | D |
| `premium_checkout_completado` ⭐ | Webhook OpenPay éxito | ⏳ NUEVO | D |
| `premium_cancelado` ⭐ | POST `/api/v1/admin/suscripciones/[id]/cancelar` (auto del usuario) | ⏳ NUEVO | F |
| `whatsapp_channel_link_entregado` ⭐ | Email de bienvenida con link enviado | ⏳ NUEVO | E |
| `whatsapp_pick_distribuido` ⭐ | Pick aprobado y enviado al Channel | ⏳ NUEVO | E |
| `cross_product_navegado` ⭐ | Click en banner cross B↔C | ⏳ NUEVO | B/C |
| `referido_invitacion_compartida` | Compartir link de referido | TODO en Lote 6 | C |

---

*Versión 1 · Abril 2026 · Flujos base para Lotes A-J*
