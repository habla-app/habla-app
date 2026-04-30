# Componentes Mobile — Habla! v3.1 (Pista Usuario)

Componentes específicos de la pista usuario, optimizados para 375px-768px y experiencia de pulgar/touch. Viven en `apps/web/components/ui/mobile/`.

## Filosofía mobile-first

1. **Ancho base:** 375px (iPhone SE / Android estándar). Layout funciona desde aquí hacia arriba.
2. **Touch targets:** ≥44×44px en cualquier elemento interactivo.
3. **Sticky CTAs:** los CTAs primarios viven en barra inferior fija, dentro de la zona del pulgar.
4. **Scroll horizontal:** preferido sobre dropdowns/selects para listas (chips de ligas, casas, días).
5. **Bottom sheets:** preferidos sobre modales centrados para UI secundaria.
6. **Animaciones discretas:** `pulse` para LIVE, `slide-down` para entrar UI, `fade-in` para cambios de estado. Cero "wow factor".
7. **Carga rápida:** evitar dependencias pesadas en componentes mobile. Lazy-load todo lo que no esté above-the-fold.

## Inventario de componentes

### 1. `<MobileHeader>` — Header sticky superior

Reemplaza `<PublicHeader>` actual con versión optimizada mobile.

```tsx
interface MobileHeaderProps {
  variant: 'public' | 'main' | 'transparent';
  showBack?: boolean;
  showLogo?: boolean;
  rightActions?: ReactNode;  // Bell, menu, avatar
}
```

- Altura: 56px.
- Position: `sticky top-0 z-header`.
- Variant `public`: bg blanco con border bottom.
- Variant `main`: bg blanco con border bottom + avatar del usuario a la derecha.
- Variant `transparent`: sin fondo, sobre hero coloreado (vista de partido).

### 2. `<BottomNav>` — Barra de navegación inferior

5 ítems fijos según el plan v3.1:

```tsx
const items = [
  { href: '/', icon: '🏠', label: 'Inicio' },
  { href: '/cuotas', icon: '⚽', label: 'Partidos' },
  { href: '/comunidad', icon: '🏆', label: 'Liga' },
  { href: '/premium', icon: '💎', label: 'Premium' },
  { href: '/perfil', icon: '👤', label: 'Perfil' },  // Si no auth → /auth/signin
];
```

- Altura: 64px (con safe-area-inset-bottom).
- Position: `sticky bottom-0 z-sticky`.
- Active: ícono escala 1.1 + label en bold dark.
- Inactive: gris.
- Live indicator: dot rojo pequeño junto a "Inicio" cuando hay partido en vivo.

### 3. `<StickyCTABar>` — Barra de CTAs flotante encima del BottomNav

Container que contiene 1-2 botones primarios fijos al fondo.

```tsx
interface StickyCTABarProps {
  primary: { label: string; onClick: () => void; variant?: 'gold' | 'blue' };
  secondary?: { label: string; onClick: () => void };
  hideOnScroll?: boolean;  // Útil en vistas largas
}
```

- Position: `sticky bottom-[64px]` (sobre BottomNav).
- Padding: `px-4 py-3`.
- Background: `bg-card` con `shadow-nav-top`.
- Si hay 2 botones: secondary 30% / primary 70%.

**Reglas:**
- Solo en vistas con conversión (Producto B, Producto C, Premium landing, Checkout).
- Nunca en home, perfil, listings.

### 4. `<HorizontalScrollChips>` — Chips horizontales con scroll-x

Para filtros (ligas, días, mercados, casas).

```tsx
interface HorizontalScrollChipsProps {
  items: { id: string; label: string; icon?: ReactNode; count?: number }[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  showAll?: boolean;  // Botón "Todas" al inicio
}
```

- Container: `flex overflow-x-auto scrollbar-hide gap-2 px-4`.
- Chip: `h-9 px-3 rounded-full whitespace-nowrap text-body-sm font-semibold`.
- Selected: `bg-brand-blue-dark text-white`.
- Unselected: `bg-subtle text-body`.
- Snap scroll: `scroll-snap-type: x proximity`.

### 5. `<BottomSheet>` — Drawer inferior

Reemplazo mobile del modal centrado para UI secundaria.

```tsx
interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  initialHeight?: 'auto' | 'half' | 'full';
}
```

- Renderiza con `createPortal(document.body)`.
- Animación: `slide-up` 250ms.
- Drag handle visual arriba (5×40 píldora gris).
- Backdrop semi-transparente con click-to-close.
- Soporta swipe-down para cerrar (UX nativo).

**Casos de uso:**
- Filtros avanzados de `/casas`, `/cuotas`.
- Confirmación de predicción con resumen.
- Compartir predicción.
- Detalle de pick Premium (preview gratuito).

### 6. `<MatchCard>` — Card de partido (versión mobile-first)

Reescritura del actual con layout más compacto y CTAs claros.

```tsx
interface MatchCardProps {
  partido: {
    slug: string;
    liga: { nombre: string; icon: string };
    local: { nombre: string; logoUrl?: string };
    visitante: { nombre: string; logoUrl?: string };
    fechaInicio: Date;
    estado: 'PROGRAMADO' | 'EN_VIVO' | 'FINALIZADO';
    marcador?: { local: number; visitante: number };  // Si EN_VIVO o FINALIZADO
    minuto?: number;  // Si EN_VIVO
  };
  cuotasMejor?: {
    casa: string;        // slug
    casaNombre: string;
    valor: number;
    outcome: '1' | 'X' | '2';
  };
  variant?: 'compact' | 'expanded';  // Compact en home, expanded en /cuotas
  showLiga?: boolean;  // false cuando ya está agrupado por liga
}
```

**Layout compact (default):**

```
┌─────────────────────────────────────┐
│ 🏆 Liga 1  · ⏱ Cierra en 8min       │  ← chips
│                                     │
│  [A]  Alianza      VS      Univ. [U]│  ← teams
│                                     │
│ [Betano 2.05] [Betsson 2.00]  [→]   │  ← cuotas + CTA
│  ★ Mejor                             │
└─────────────────────────────────────┘
```

**Layout expanded (con análisis preview):**

Misma estructura + breve preview del análisis editorial + CTA "Ver análisis →".

### 7. `<CuotasComparator>` (mobile version)

El componente actual del Lote 9 funciona pero el layout debe optimizarse:

- Casa: 80px
- 1 / X / 2: cada uno flex-1 con `text-num-md` centrado
- Botón "→": círculo de 36×36 con flecha (touch target via padding del row)
- Dorado en la fila con mejor cuota (badge ★ flotante)

Mobile preferiblemente muestra solo top 4 casas. Las demás se ven con "Ver más casas →" que abre `<BottomSheet>`.

### 8. `<HeroPartido>` — Hero de vista de partido

Encabezado de `/partidos/[slug]`.

```tsx
interface HeroPartidoProps {
  partido: PartidoData;  // Mismo shape que MatchCard
  onShare?: () => void;
  onBookmark?: () => void;
}
```

- Background: gradiente `bg-stadium` con radial dorado en esquina.
- Color: text white.
- Layout:
  - Top: back button + share/bookmark.
  - Liga + countdown chips.
  - Equipos en grid 1fr+auto+1fr (logo + nombre / VS / nombre + logo).
  - Estadio + fecha + hora abajo.

### 9. `<PickBloqueadoTeaser>` — Pick Premium con paywall

Componente clave del modelo v3.1.

```tsx
interface PickBloqueadoTeaserProps {
  partidoId: string;
  isAuthenticated: boolean;
  isPremium: boolean;
  partialPreview?: {  // Para usuarios free, se muestra parcialmente
    mercado: string;
    cuotaSugerida: number;
    razonamientoPreview: string;  // Primeros 30-50 caracteres
  };
}
```

- Si `isPremium`: renderiza el pick completo con razonamiento + casa.
- Si NO: renderiza overlay con blur + lock icon + CTA "Probar 7 días gratis".
- Background: `bg-premium-card-gradient`.
- Border: `border-premium-border`.
- Padding: `p-4`.
- Watermark del email del usuario en esquina inferior si está logueado (opcional, decorativo).

```tsx
{!isPremium && (
  <div className="absolute inset-0 bg-premium-lock-overlay flex flex-col items-center justify-end p-4">
    <span className="text-2xl mb-2">🔒</span>
    <p className="text-display-sm text-white">Solo para Premium</p>
    <p className="text-body-xs text-premium-text-soft-on-dark mb-3">
      2-4 picks/día con análisis estadístico
    </p>
    <Button variant="gold" size="md" fullWidth>⚡ Probar 7 días gratis</Button>
  </div>
)}
```

### 10. `<CrossProductBanner>` — Sincronía B↔C

```tsx
interface CrossProductBannerProps {
  direction: 'B-to-C' | 'C-to-B';
  partidoSlug: string;
  competidores?: number;  // Para B-to-C: cuántos compiten
}
```

- En B (vista de partido): "🏆 Compite por este partido en la Liga Habla! · 234 tipsters compitiendo · [Hacer mi predicción]" → linkea a `/comunidad/torneo/[slug]`.
- En C (vista de torneo): "📊 Ver análisis completo y cuotas comparadas →" → linkea a `/partidos/[slug]`.
- Layout: card con icono + texto + arrow.

### 11. `<LeaderboardPreview>` (mobile)

Refactor del actual para mobile-first.

```tsx
interface LeaderboardPreviewProps {
  topN?: number;  // Default 5
  showMyPosition?: boolean;
  partidoId?: string;  // Si está en C, leaderboard del torneo de ese partido
  hrefVerCompleto: string;
}
```

- Filas compact: avatar + nombre + premium badge + puntos.
- "Línea de premio" decorativa entre top 10 y resto.
- Si `showMyPosition`: fila destacada del usuario actual con `bg-blue-50`.
- Footer: "Ver leaderboard completo →" `<Button variant="ghost" fullWidth>`.

### 12. `<PrediccionForm>` — Form de 5 mercados (Producto C)

Reusable de la lógica actual de `/torneo/[id]` con UX mobile.

```tsx
interface PrediccionFormProps {
  partido: PartidoData;
  prediccionExistente?: TicketData;  // Si ya predijo
  onSubmit: (prediccion: PrediccionData) => Promise<void>;
}
```

Layout: 5 secciones verticales, cada una con:
- Label arriba con puntos en badge dorado.
- Botones grandes (`market-opt`) o input numérico (marcador exacto).
- Estado seleccionado: `bg-brand-blue-main text-white border-brand-blue-dark`.

Sticky CTA bottom: "🏆 Enviar mi predicción" en `<Button variant="gold" size="xl" fullWidth>`.

### 13. `<AffiliateInline>` — CTA afiliado embebido

```tsx
interface AffiliateInlineProps {
  partidoId: string;
  recomendacion: { casa: string; cuota: number; outcome: string; mercado: string };
  variant: 'highlighted' | 'compact';  // highlighted con badge gold
}
```

- Card con borde dorado y badge "★ MEJOR CUOTA" arriba a la izquierda.
- Texto descriptivo + cuota grande.
- Botón derecho: "Apostar →" con `variant="dark"`.
- Linkea a `/go/[casa]?subid=...` con UTM apropiados.

### 14. `<NewsletterCTA>` (mobile, refactor del Lote 10)

Conservar lógica de suscripción del Lote 10. Optimizar visual mobile-first.

### 15. `<PWAInstallPrompt>` — Banner de instalación PWA

Aparece después de la 3ra visita o tras conversión exitosa.

```tsx
<PWAInstallPrompt
  trigger="post-prediction"  // o 'three-visits' | 'manual'
  onDismiss={...}
/>
```

- Card en bottom (encima del BottomNav) con título "📱 Instala Habla!" + descripción + CTA "Instalar".
- Usa `beforeinstallprompt` API. Solo aparece si el navegador la soporta.
- Una vez dismissada, no vuelve a aparecer en 30 días.

### 16. `<NivelProgressBar>`

Para perfil y mini-widgets.

```tsx
interface NivelProgressBarProps {
  nivelActual: number;
  puntosActuales: number;
  puntosParaSiguiente: number;
}
```

- Barra horizontal con fill dorado.
- Label "+47 puntos para Nivel 5" debajo.

### 17. `<MisCasasConectadas>` (perfil)

```tsx
interface MisCasasConectadasProps {
  casas: { slug: string; nombre: string; logoBg: string; apuestasMes: number }[];
  onAddCasa: () => void;
}
```

- Lista vertical de casas con info "Activa · 3 apuestas este mes".
- Footer CTA "➕ Conecta una nueva casa (bono S/100)" → linkea a `/casas` con segmentación.

### 18. `<EstadoUsuarioBanner>` — Banner de estado dinámico

Aparece en home según el estado del usuario:

| Estado | Banner |
|---|---|
| Anónimo | (no se muestra) |
| Free | "🏆 Compite gratis · Top 10 gana S/ 1,250" |
| FTD activo | "📊 Tu acierto: 47% · Premium llega a 65%" |
| Premium | "💎 Tu canal Premium · Próximo cobro 15 may" |

```tsx
interface EstadoUsuarioBannerProps {
  estado: 'anonimo' | 'free' | 'ftd' | 'premium';
  data?: { acierto?: number; proximoCobro?: Date; ... };
}
```

## Reglas de uso mobile

1. **Touch targets:** verificar visualmente que cada botón/link tenga ≥44×44px de área clickeable. Padding cuenta.
2. **Sticky CTAs únicos:** una vista solo tiene UN sticky CTA primario. Si hay dos acciones, una va inline en el cuerpo.
3. **Scroll behavior:** ningún componente bloquea el scroll vertical. Si necesita scroll horizontal, va en `<HorizontalScrollChips>` con clases adecuadas.
4. **Loading states:** todo componente que cargue datos async usa `<Skeleton>` mientras carga, no spinners centrados (que parecen errores de carga).
5. **Bottom sheets > modales:** UI secundaria abre como `<BottomSheet>`, no como `<Modal>` centrado.
6. **Tipografía:** solo escala mobile (`text-display-*`, `text-body-*`, `text-label-*`, `text-num-*`). Nunca usar clases admin aquí.

## Animaciones permitidas en mobile

| Animación | Uso |
|---|---|
| `animate-pulse` | LIVE indicator dot rojo |
| `animate-pulse-dot` | LIVE indicator con sombra expansiva |
| `animate-fade-in` | Cambios de estado (loading → loaded) |
| `animate-slide-down` | Toast nuevo, banner aparece |
| `animate-scale-in` | Modal/BottomSheet abre |
| `animate-shimmer` | Skeleton loading |
| `animate-shake` | Error en input |

Lo demás se reserva. Cero animaciones decorativas que prolonguen interacciones.

---

## Mapeo a archivos del repo

```
apps/web/components/ui/mobile/
├── MobileHeader.tsx
├── BottomNav.tsx              ← refactor del existente
├── StickyCTABar.tsx
├── HorizontalScrollChips.tsx  ← refactor del existente en matches/
├── BottomSheet.tsx
├── MatchCard.tsx              ← refactor del existente
├── HeroPartido.tsx
├── PickBloqueadoTeaser.tsx    ← NUEVO (clave del modelo v3.1)
├── CrossProductBanner.tsx     ← NUEVO
├── LeaderboardPreview.tsx     ← refactor del existente
├── PrediccionForm.tsx         ← refactor de form de torneo
├── AffiliateInline.tsx        ← NUEVO
├── NewsletterCTA.tsx          ← refactor del existente (Lote 10)
├── PWAInstallPrompt.tsx       ← NUEVO
├── NivelProgressBar.tsx
├── MisCasasConectadas.tsx     ← NUEVO
└── EstadoUsuarioBanner.tsx    ← NUEVO
```

**Nota:** componentes existentes (Lote 5, 8, 9, 10, 11) que cumplen su función se conservan en sus paths actuales (`apps/web/components/home/`, `apps/web/components/matches/`, etc.) y solo se refactoran visualmente. Los marcados como NUEVO son creación del Lote A o B según indique cada spec.

---

*Versión 1 · Abril 2026 · Componentes mobile para Lotes A-D*
