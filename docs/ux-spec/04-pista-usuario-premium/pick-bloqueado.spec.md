# Pick bloqueado — Componente `<PickBloqueadoTeaser>`

Spec del componente reutilizable que muestra un pick Premium bloqueado a usuarios no suscriptores. Se usa en múltiples lugares: home (`/`), Producto B (`/partidos/[slug]`), Producto C (`/comunidad/torneo/[slug]`), blog post (`/blog/[slug]` cuando el artículo cubre un partido con pick).

## Lote responsable

**Lote D** — Premium WhatsApp Channel UI usuario.

## Estado actual del repo

NUEVO — este componente no existe en el repo actual. Se crea desde cero en Lote D.

## Cambios necesarios

### Archivos a crear

- `apps/web/components/ui/premium/PickBloqueadoTeaser.tsx`:
  - Componente reusable con 2 modos según prop:
    - **`mode="card"`** (default): card oscura compacta tipo teaser de home.
    - **`mode="section"`**: sección completa para vistas de partido (más prominente, con razonamiento blureado visible).
  - Props:
    ```typescript
    interface PickBloqueadoTeaserProps {
      pick: {
        id: string;
        partido: { local: string; visitante: string };
        mercado: MercadoPick;
        outcome: string;
        cuotaSugerida: number;
        razonamiento?: string;  // Solo se muestra blureado si está presente
        evPctSugerido?: number;
      } | null;  // Si null, muestra fallback genérico "Próximamente"
      mode?: 'card' | 'section';
      copyVariant?: 'anonimo' | 'free' | 'ftd';  // Personaliza copy según estado
      utmSource: string;  // Para tracking del CTA
    }
    ```

- `apps/web/components/ui/premium/PickDesbloqueado.tsx`:
  - Componente que muestra el MISMO pick pero desbloqueado, para suscriptores Premium.
  - Mismo data shape, sin blur, con razonamiento completo, casa recomendada, CTA "Ir a la casa →".
  - Props sin `copyVariant` (Premium ya está suscrito, mismo copy para todos).

- `apps/web/components/ui/premium/PickWrapper.tsx`:
  - Wrapper inteligente que decide qué renderizar según el estado del usuario:
    - Si user es Premium → renderiza `<PickDesbloqueado>`.
    - Si NO Premium → renderiza `<PickBloqueadoTeaser>` con `copyVariant` correspondiente.
  - Props:
    ```typescript
    interface PickWrapperProps {
      pick: PickPremium | null;
      estadoUsuario: 'anonimo' | 'free' | 'ftd' | 'premium';
      mode?: 'card' | 'section';
      utmSource: string;
    }
    ```
  - Es el componente que el resto del código usa. `<PickBloqueadoTeaser>` y `<PickDesbloqueado>` son detalles de implementación.

### Archivos a modificar

Estos componentes consumen el `<PickWrapper>`:

- `apps/web/components/home/PremiumTeaserHome.tsx` (Lote B): renderiza `<PickWrapper mode="card" utmSource="home">`.
- `apps/web/components/partido/PickBloqueadoSeccion.tsx` (Lote B): renderiza `<PickWrapper mode="section" utmSource="partido">`.
- `apps/web/components/blog/PickPremiumPromo.tsx` (Lote B): renderiza `<PickWrapper mode="card" utmSource="blog">`.

## Datos requeridos

`<PickWrapper>` es un client component que recibe props ya cargados desde el server component padre. No hace queries propias.

```typescript
// El server component padre carga el pick:
const pickPremium = partido.id
  ? await prisma.pickPremium.findFirst({
      where: { partidoId: partido.id, aprobado: true },
      include: { casaRecomendada: true },
      orderBy: { fechaPublicacion: 'desc' },
    })
  : null;

// Y pasa al wrapper:
<PickWrapper
  pick={pickPremium}
  estadoUsuario={estadoUsuario}
  mode="section"
  utmSource="partido"
/>
```

## Estados de UI

### Variante `<PickBloqueadoTeaser mode="card">` (compact)

```
┌────────────────────────────────────┐
│ [💎 Pick Premium del día] S/49/mes │
├────────────────────────────────────┤
│  ┌──────────────────────────────┐  │
│  │ Real Madrid vs Man City     │  │
│  │ (blureado)                   │  │
│  │ Recomendación: BTTS Sí @1.85 │  │
│  └────────────🔒────────────────┘  │
│                                    │
│  [⚡ Desbloquear con Premium]      │
│                                    │
│  📊 65% acierto · 847 suscriptores │
└────────────────────────────────────┘
```

### Variante `<PickBloqueadoTeaser mode="section">` (full)

```
┌────────────────────────────────────┐
│ 💎 Pick Premium del editor         │
├────────────────────────────────────┤
│ ┌──────────────────────────────┐   │
│ │ Stake 3% · EV+ 14% (blureado)│   │
│ │ Ambos anotan: SÍ (blureado)  │   │
│ │ Razonamiento: Universitario  │   │
│ │ anotó en 8/10 últimos...     │   │
│ │ (todo blureado)              │   │
│ │            🔒                │   │
│ │ Solo para suscriptores       │   │
│ │ Premium                      │   │
│ └──────────────────────────────┘   │
│                                    │
│ [⚡ Probar 7 días gratis]          │
└────────────────────────────────────┘
```

### Variante `<PickDesbloqueado>` (Premium activo)

```
┌────────────────────────────────────┐
│ 💎 Pick Premium · APROBADO         │
├────────────────────────────────────┤
│ Mercado: BTTS Sí                   │
│ Cuota sugerida: 1.85               │
│ Stake: 3% · EV+ 14%                │
│                                    │
│ Razonamiento estadístico:          │
│ Universitario anotó en 8/10        │
│ últimos partidos como visitante.   │
│ Alianza recibió gol en 7/10        │
│ últimos en casa...                 │
│                                    │
│ 🏠 Mejor cuota: Betano             │
│ [💰 Apostar en Betano →]           │
└────────────────────────────────────┘
```

### Variantes de copy según `copyVariant`

#### `copyVariant="anonimo"` (Estado 0: visitante sin sesión)
- Title: "💎 Pick Premium del día"
- CTA: "⚡ Crear cuenta y desbloquear" → linkea a `/auth/signup?next=/premium`
- Sub-CTA: "847 suscriptores reciben este pick por WhatsApp"

#### `copyVariant="free"` (Estado 1: registrado sin FTD ni Premium)
- Title: "💎 Pick Premium del día"
- CTA: "⚡ Probar 7 días gratis" → linkea a `/premium?utm_source={utmSource}`
- Sub-CTA: "65% acierto el último mes · sin compromiso"

#### `copyVariant="ftd"` (Estado 2: con FTD reportado, sin Premium)
- Title: "💎 Tu acierto puede subir a 65%"
- CTA: "⚡ Probar Premium 7 días gratis" → linkea a `/premium?utm_source={utmSource}_ftd`
- Sub-CTA: "Tu acierto actual: X% · Premium llega a 65%"
- (X% se calcula del usuario real con `obtenerStatsDeUsuario`. Solo mostrar si tiene >10 predicciones.)

### Estado vacío (sin pick aprobado disponible)

Si `pick === null`:

```
┌────────────────────────────────────┐
│ 💎 Picks Premium llegan en horas   │
├────────────────────────────────────┤
│ Nuestro editor publica 2-4 picks   │
│ por día con razonamiento.          │
│                                    │
│ [Ver todos los picks pasados →]    │
└────────────────────────────────────┘
```

CTA → `/premium`. Mismo concepto pero con copy de "próximamente".

### Loading

- No aplica — es client component recibiendo props ya cargadas.

### Error

- Si props son inválidos: render fallback genérico "Próximamente picks Premium" con CTA a `/premium`.

## Componentes que reutiliza

- `<Card>` con variant `card-premium` del design system (Lote A).
- `<Button>` con variant `btn-gold` o `btn-blue`.
- `<Badge>` para `badge-premium` y `badge-info`.
- Tokens Premium del Lote A.

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- **Eficiente con tokens.** El componente recibe el pick ya cargado, NO hace fetch propio.
- **CSS blur con `filter: blur(5px)`** + overlay con gradient para que se vea desbloqueable visualmente.
- Touch targets ≥44px en CTA principal.
- Eventos analíticos (NUEVO Lote D):
  - `pick_premium_blocked_visto` cuando el componente entra en viewport (IntersectionObserver, dispatch 1 vez por sesión por componente). Importante para medir conversion funnel.
  - `pick_premium_blocked_clickeado` cuando user click en el CTA principal del componente.
  - Ambos eventos deben incluir `utmSource` en payload para diferenciar de qué vista vino.

## Mockup de referencia

Sin mockup individual. Visualización en mockups del Paquete 3A:
- `home.html` sección "premium-card-mock" (variante card)
- `partidos-slug.html` sección "psec" + "plock" (variante section)

Y en el design system general del Paquete 2B (`mockup-actualizado.html`).

## Pasos manuales para Gustavo post-deploy

Ninguno. Es código frontend puro.

**Validación post-deploy:**

1. Sin login, abrir `hablaplay.com/` → verificar que `<PickWrapper>` en home muestra teaser bloqueado con CTA "Crear cuenta".
2. Logueado pero sin Premium, abrir cualquier `/partidos/[slug]` → verificar que la sección "Pick Premium del editor" muestra blur + overlay + CTA "Probar 7 días gratis".
3. Suscribirse a Premium (con tarjeta de testing) → verificar que la misma vista ahora muestra el pick desbloqueado con razonamiento completo + casa recomendada + CTA "Apostar en Betano →".
4. Verificar el evento analytics `pick_premium_blocked_visto` se dispara solo 1 vez por sesión por componente.

---

*Versión 1 · Abril 2026 · PickBloqueadoTeaser para Lote D*
