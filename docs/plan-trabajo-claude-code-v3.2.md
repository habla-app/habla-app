# Plan de Trabajo Claude Code · Habla! v3.2 — REESCRITO v3.0

**Fecha**: 2 mayo 2026
**Versión**: 3.0 (portación 100% literal del mockup)
**Deadline absoluto**: 8 de mayo de 2026

Este plan reemplaza al v2.0. La diferencia esencial es que el plan v2.0 le pidió a Claude Code "portar HTML del mockup" pero **le dejó libertad** para decidir qué portar y qué adaptar. El resultado: solo 46% del CSS portado, componentes globales (NavBar, NavLinks, Footer) reescritos con criterio propio, copy alterado, links faltantes ("Las Fijas", "Socios") y links inventados ("Pronósticos", "Blog").

El plan v3.0 elimina toda interpretación. Es **mecánico, literal, exhaustivo**.

---

## La regla absoluta del v3.0

**Todo HTML, CSS, copy, estructura de navegación y comportamiento que aparece en `docs/habla-mockup-v3.2.html` debe existir idéntico en la app. Punto.**

No hay excepción. No hay "esto se puede mejorar". No hay "este componente del repo ya hacía algo parecido". No hay "este copy es más claro". El mockup es ley.

Los únicos puntos donde la app puede divergir del mockup son:

1. **Datos**: donde el mockup tiene "Brentford vs West Ham", la app tiene `{partido.equipoLocal} vs {partido.equipoVisita}`.
2. **Navegación**: donde el mockup tiene `data-nav="liga-list"`, la app tiene `<Link href="/liga">`.
3. **Estado de auth**: donde el mockup tiene clases `visitor-only`, `socios-only`, `not-socios-only`, la app las renderiza con `<AuthGate>`.
4. **Lógica de negocio**: validación de formularios, llamadas a API, redirects post-login, etc.

**Todo lo demás —HTML, clases CSS, textos visibles, orden de elementos, tamaños, colores, fuentes, emojis, espaciados, animaciones, viewport— debe ser idéntico al mockup.**

---

## Cómo se verifica la fidelidad

Antes de cerrar cualquier vista o componente, Claude Code debe ejecutar este checklist mental viendo lado a lado el mockup y la implementación:

1. **¿La estructura HTML es idéntica?** Mismos elementos, mismo orden, mismas anidaciones.
2. **¿Las clases CSS son las del mockup?** Si el mockup usa `nav-link active`, la app usa `nav-link active`. No `bg-brand-gold-dim text-brand-gold` ni similares.
3. **¿Los textos visibles son idénticos?** Si el mockup dice "Empezar gratis", la app dice "Empezar gratis", no "Entrar". Si dice "La Liga Habla!", dice "La Liga Habla!", no "Liga".
4. **¿Los emojis son los mismos?** Si el mockup usa 🏆 antes de "Liga Habla!", la app usa 🏆.
5. **¿Las dimensiones, paddings, fuentes son las mismas?** Solo se logra si el CSS está portado al 100%.
6. **¿La cantidad de columnas/filas/items es la del mockup?** Si la tabla tiene 9 columnas, la app tiene 9.
7. **¿En mobile se ve idéntico?** Si en el mockup `mode-mobile` la tabla está oculta y se ven cards, en la app móvil pasa lo mismo.
8. **¿En desktop se ve idéntico?** Si en `mode-desktop` la tabla tiene 9 columnas, la app desktop también.

Si CUALQUIERA de estas respuestas es "no", la implementación está incompleta.

---

## Estado actual auditado del repo

He auditado el repo después de Lote Q (v2.0) y encontré los siguientes problemas que **el plan v3.0 debe resolver**:

### Problema 1: CSS portado al 46%

El archivo `apps/web/app/mockup-styles.css` tiene 802 líneas y **196 clases CSS únicas**. El `<style>` del mockup tiene **2064 líneas y 427 clases únicas**. Falta el 54%.

**Clases críticas faltantes** (verificadas):
- `app-header`, `app-header-left`, `app-header-right` (header global)
- `logo`, `logo-mark` (logo)
- `nav-links`, `nav-link`, `nav-link.active`
- `btn-entrar`
- `avatar-mini`, `avatar-wrap`, `avatar-trigger`, `avatar-dropdown`, `avatar-dd-*`
- `viewport`, `viewport-wrap`, `mode-mobile`, `mode-desktop` (sistema de modos del mockup, ver Problema 4)
- `bottom-nav`, `bn-item`, `bn-icon`, `bn-label`
- `app-footer`, `app-footer-grid`, `app-footer-disclaimer`
- Y muchas más relacionadas con admin, modales, perfil, jugador.

### Problema 2: Componentes globales con HTML divergente

Los siguientes componentes del repo se construyeron con clases Tailwind custom y HTML propio, ignorando el HTML del mockup:

- `NavBar.tsx`: usa `<header className="sticky top-0 z-[100] h-[68px] border-b border-dark-border bg-dark-surface">` en lugar de `<header class="app-header">`.
- `NavLinks.tsx`: usa clases Tailwind `text-white/80 hover:bg-white/[0.06]` en lugar de `nav-link`.
- Logo del header: usa Tailwind en lugar de `class="logo"` con `<span class="logo-mark">⊕</span>`.
- Botón "Empezar": dice "Entrar" (copy alterado) y usa Tailwind en lugar de `class="btn-entrar"`.

### Problema 3: Items de navegación incorrectos

El `NavLinks.tsx` actual tiene:
- "Inicio" ✓
- "Pronósticos" ❌ (no está en mockup)
- "Reviews y guías" ❌ (mockup dice "Reviews y Guías" con G mayúscula)
- "Liga" ❌ (mockup dice "La Liga Habla!")
- "Blog" ❌ (no está en mockup)

**Faltan**: "Las Fijas", "Socios". Hay que reemplazar todo el array `LINKS` por el del mockup.

### Problema 4: Sistema de modos del mockup no replicado

El mockup usa `<div class="viewport mode-mobile">` o `<div class="viewport mode-desktop">` como wrapper de toda la app. **62 reglas CSS** en el mockup dependen de estos ancestros (ej. `.mode-mobile .nav-links { display: none; }`).

La app real no tiene este wrapper, por lo que esas 62 reglas **deben portarse como media queries**: `.mode-mobile .X { ... }` se convierte en `@media (max-width: 767px) { .X { ... } }`, y `.mode-desktop .X { ... }` se convierte en `@media (min-width: 768px) { .X { ... } }`.

El CSS portado actual (Lote Q v2.0) **no contiene NI UNA referencia** a `mode-mobile` ni `mode-desktop` (verificado con grep). Es decir: las 62 reglas responsive están perdidas o solo parcialmente portadas en otras secciones.

### Problema 5: Bottom-nav y Footer (probables) faltantes o divergentes

El mockup tiene `bottom-nav` (visible solo en mode-mobile) y `app-footer` con grid. Hay que verificar si están portados y, si lo están, si el HTML coincide.

---

## Roadmap actualizado v3.0

Para no sobrecargar a Claude Code en una sola sesión (que llevaría a errores), el trabajo de re-portación se divide en **3 lotes nuevos** antes de continuar con N, O, P:

| Lote | Nombre | Estado | Razón |
|---|---|---|---|
| K | Foundation v3.2 + URLs + redirects | ✅ Cerrado | Sigue válido. |
| L | Motor enriquecido + AnalisisPartido productivo | ✅ Cerrado | Sigue válido. |
| M | Las Fijas + La Liga (vistas) | ⚠️ Backend OK · UI a re-portar | Servicios y endpoints intactos. |
| Q (v2.0) | Re-portar Lote M | ⚠️ Parcial · CSS al 46% | A reemplazar por R + S + T. |
| **R** | **CSS literal 100% del mockup** | ⏳ Pendiente | Único objetivo: portar las 2064 líneas del `<style>` del mockup. Cero JSX. |
| **S** | **Componentes globales literales** | ⏳ Pendiente | NavBar, NavLinks, Footer, BottomNav, layout root. HTML idéntico al mockup. |
| **T** | **Re-portar 4 vistas del Lote M** | ⏳ Pendiente | Las Fijas + Liga (lista + detalle de cada una). HTML idéntico al mockup. |
| N | Home + Socios + Reviews + Perfiles | ⏳ Pendiente | 6 vistas restantes pista usuario, después de R+S+T. |
| O | Admin operación: refactor + 4 vistas | ⏳ Pendiente | 8 vistas admin operativas. |
| P | Admin analítica + pulido + cierre | ⏳ Pendiente | 6 vistas admin analítica + cierre. |

**Orden estricto**: R → S → T → N → O → P. R debe cerrar antes que cualquier otra cosa porque es la base CSS de todo lo demás.

---

# Lote R — CSS literal 100% del mockup

**Branch**: `feat/lote-r-css-literal`

### Objetivo único

Reescribir `apps/web/app/mockup-styles.css` con el **CSS completo** del mockup, palabra por palabra, regla por regla, en orden, sin omisiones.

Este lote **no toca JSX**, no toca componentes, no toca backend, no toca rutas. **Solo CSS.**

### Procedimiento literal

**Paso 1**. Borrar el contenido actual de `apps/web/app/mockup-styles.css`.

**Paso 2**. Abrir `docs/habla-mockup-v3.2.html`. Localizar la etiqueta `<style>` (línea 8). Localizar la etiqueta `</style>` de cierre (línea 2072). Todo lo que está entre esas dos líneas es el CSS objetivo.

**Paso 3**. Copiar literalmente cada regla CSS del mockup al archivo `mockup-styles.css`. **Regla por regla, en orden, sin omitir ninguna**, con tres reglas de transformación:

**Transformación A — Variables CSS**: copiar el bloque `:root { ... }` tal cual al inicio del archivo. Si globals.css ya tiene un bloque `:root`, igualmente las variables del mockup ganan — ponerlas en `mockup-styles.css` y dejar que sobrescriban si hay choque.

**Transformación B — `.mode-mobile .X` → `@media (max-width: 767px) { .X }`**: Cada vez que aparece una regla con selector `.mode-mobile .algo`, transformarla en `@media (max-width: 767px) { .algo { ... } }`. Lo mismo para `.mode-mobile.algo` (el modo en sí mismo).

**Transformación C — `.mode-desktop .X` → `@media (min-width: 768px) { .X }`**: Igual al anterior pero para desktop.

**Transformación D — Wrapper viewport**: las reglas `.viewport-wrap`, `.viewport`, `.viewport.mode-mobile`, `.viewport.mode-desktop`, `.dev-switcher`, `.dev-row`, `.dev-btn`, `.dev-label`, `.dev-h` (línea ~85 a ~132 del mockup) son del mockup-demo, no de la app real. **Omitirlas**. Pero las reglas que dependen de `.mode-mobile` o `.mode-desktop` SÍ se portan según las transformaciones B y C.

**Transformación E — `.page-section` y `.page-section.active`**: en el mockup estas clases manejan navegación interna del demo. En la app real **omitirlas**, ya que cada vista es una ruta de Next.js.

**Paso 4**. Verificar que el archivo final tiene **al menos 1900 líneas** (las ~2000 del mockup menos las omitidas en transformaciones D y E). Si tiene menos de 1500, faltan reglas.

**Paso 5**. Verificar conteo de clases únicas: ejecutar `grep -E "^\.[a-z]" mockup-styles.css | grep -oE "^\.[a-z][a-z0-9_-]+" | sort -u | wc -l`. Debe dar **al menos 400 clases**. El mockup tiene 427; con las omitidas de transformaciones D+E, el target razonable es 410-420.

**Paso 6**. Confirmar que `globals.css` importa `mockup-styles.css` con `@import './mockup-styles.css';` antes de cualquier regla utility de Tailwind.

**Paso 7**. `pnpm tsc --noEmit` y `pnpm lint` pasan limpios (CSS no rompe TS pero el lint puede tirar warnings de Tailwind).

### Lista de bloques del CSS del mockup que DEBEN existir en el portado

Este es un index de las secciones del CSS del mockup. Cada una debe tener su contraparte en el portado. Si Claude Code termina el lote y cualquiera de estas falta o está incompleta, el lote no está cerrado:

1. `:root` con todas las variables (líneas ~12-69 del mockup, ~70 variables).
2. `BASE` (`*`, `html, body`, `h1...h6`, `a`, `button`, `input`).
3. `APP HEADER` (`.app-header`, `.app-header-left`, `.app-header-right`, `.logo`, `.logo-mark`).
4. `NAV LINKS` (`.nav-links`, `.nav-link`, `.nav-link.active`).
5. `BTN-ENTRAR`.
6. `AVATAR` (`.avatar-mini`, `.avatar-wrap`, `.avatar-trigger`, `.avatar-dropdown`, `.avatar-dd-*`).
7. `MAIN CONTENT` (`.main-content`).
8. `CONTAINER` (`.container`).
9. `BOTTOM NAV` (mobile only).
10. `BUTTONS` (`.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, etc.).
11. `BADGES` (`.badge`, variantes).
12. `CARDS` (`.card`, `.section-bar`, `.section-bar-*`).
13. `HOME hero` (`.home-hero`, `.home-hero-eyebrow`, etc.).
14. `FIJAS` (`.fijas-filters`, `.filter-chip`, `.filter-search`, `.fijas-list-table`, `.cuota-cell`, `.cell-equipos`, `.fija-card`, etc.).
15. `PARTIDO HERO` (`.partido-hero`, `.partido-hero-meta`, `.partido-hero-teams`, `.team-block`, `.team-shield`, `.partido-vs`, `.partido-countdown`).
16. `RESUMEN EJECUTIVO` (`.resumen-ejecutivo`, `.resumen-recomend`, etc., con sus variantes free/socios).
17. `BLOQUES SOCIOS` (combinada óptima, razonamiento, análisis goles, análisis tarjetas, mercados secundarios, todos los teasers blur).
18. `LIGA` (`.liga-hero`, `.liga-hero-stats`, `.como-funciona`, `.cf-item`, `.premios-grid`, `.premio-cell`, etc.).
19. `RANKING` (`.ranking-table`, `.ranking-row`, paginación, sticky-bottom).
20. `MODAL COMBINADA` (`.modal-combinada`, `.modal-combinada-*`, mercados, ScorePicker).
21. `MODAL RANKING` (`.modal-ranking`, `.modal-ranking-*`).
22. `SOCIOS LANDING` (planes, garantía, social proof, testimonios, FAQ).
23. `SOCIOS HUB` (`.socios-hub-*`).
24. `REVIEWS Y GUIAS` (tabs, casa cards, guía cards).
25. `PERFIL` (`.perfil-*`).
26. `JUGADOR` (perfil público).
27. `FOOTER` (`.app-footer`, `.app-footer-grid`, `.app-footer-disclaimer`).
28. `ADMIN` (`.admin-shell`, `.admin-sidebar`, `.admin-page`, `.admin-page-title`, `.admin-card`, `.admin-table`, etc. — varias clases).
29. `ADMIN específicas`: `admin-page-dashboard`, `admin-page-partidos`, `admin-page-motor`, `admin-page-paywall`, `admin-page-liga-admin`, `admin-page-liga-verificacion`, `admin-page-embudo`, `admin-page-vinculaciones`, `admin-page-logs`, `admin-page-auditoria`, `admin-page-picks`, `admin-page-usuarios`, `admin-page-kpis`, `admin-page-cohortes`. Todas las clases específicas de cada sección admin.
30. `MOBILE GUARD` (`.admin-mobile-guard`).
31. `UTILITIES` (cualquier `.text-*`, `.hidden`, `.flex`, etc., que el mockup defina propias).

### Criterios de cierre del Lote R

- `mockup-styles.css` tiene ≥1900 líneas.
- Tiene ≥400 clases CSS únicas (contadas con grep).
- Las 31 secciones listadas arriba existen.
- Las transformaciones B (`.mode-mobile .X` → `@media max-width: 767px`) y C (`.mode-desktop .X` → `@media min-width: 768px`) aplicadas a todas las reglas.
- Las transformaciones D (omitir `.viewport*`, `.dev-*`) y E (omitir `.page-section*`) aplicadas.
- `globals.css` importa `mockup-styles.css` antes de Tailwind.
- `pnpm tsc --noEmit` y `pnpm lint` pasan.
- Push a main + reporte post-lote.
- En el reporte, sección 7 (Verificación de fidelidad) confirma:
  - Cantidad de líneas del archivo final.
  - Cantidad de clases únicas.
  - Las 31 secciones presentes (lista completa marcada).
  - Diff visual: descripción de qué cambió respecto a la versión Lote Q v2.0.

---

# Lote S — Componentes globales literales

**Branch**: `feat/lote-s-componentes-globales`

### Objetivo

Reescribir los componentes globales (header, navegación, footer, bottom-nav, layout root) para que el HTML que renderizan sea **idéntico al del mockup**. Esto incluye estructura HTML, clases CSS (las del mockup, ya presentes en el `mockup-styles.css` del Lote R), copy literal y items de navegación.

Este lote no toca rutas, no toca backend, no toca vistas individuales. Solo los componentes que se renderizan en TODAS las páginas de la pista usuario (header, footer, bottom-nav).

### Procedimiento

**Paso 1**. Localizar en el mockup el HTML del header, nav-links, footer y bottom-nav. Líneas relevantes:
- Header: ~2128-2200 (`<header class="app-header">` hasta cierre).
- Nav links: ~2137-2143.
- Avatar dropdown: ~2149-2200.
- Footer: buscar `<footer class="app-footer">` (línea ~4751).
- Bottom-nav: buscar `<nav class="bottom-nav">` (probablemente en mobile).

**Paso 2**. Reescribir cada componente del repo replicando literalmente el HTML del mockup:

#### `apps/web/components/layout/NavBar.tsx`

Reemplazar TODO el JSX por el HTML literal del mockup:

```tsx
<header className="app-header">
  <div className="app-header-left">
    <Link href="/" className="logo">
      <span className="logo-mark">⊕</span>
      <span>Habla!</span>
    </Link>
    <NavLinks />
  </div>
  <div className="app-header-right">
    <AuthGate state="visitor">
      <Link href="/auth/signin" className="btn-entrar">
        Empezar gratis
      </Link>
    </AuthGate>
    <AuthGate not="visitor">
      <UserMenu ... />
    </AuthGate>
  </div>
</header>
```

NO usar Tailwind. NO usar clases custom como `bg-dark-surface` ni `border-dark-border`. Las clases son las del mockup (`app-header`, `app-header-left`, `logo`, etc.) y sus estilos vienen de `mockup-styles.css` (Lote R).

#### `apps/web/components/layout/NavLinks.tsx`

Reemplazar el array `LINKS` actual por **exactamente** los items del mockup:

```ts
const LINKS = [
  { href: "/", label: "Inicio", match: (p) => p === "/" },
  { href: "/las-fijas", label: "Las Fijas", match: (p) => p.startsWith("/las-fijas") || p.startsWith("/cuotas") || p.startsWith("/partidos") },
  { href: "/liga", label: "La Liga Habla!", match: (p) => p.startsWith("/liga") || p.startsWith("/jugador") || p.startsWith("/comunidad") || p.startsWith("/torneo") },
  { href: "/socios", label: "Socios", match: (p) => p.startsWith("/socios") },
  { href: "/reviews-y-guias", label: "Reviews y Guías", match: (p) => p.startsWith("/reviews-y-guias") || p.startsWith("/casas") || p.startsWith("/guias") },
];
```

Eliminar "Pronósticos" y "Blog" del array. Cambiar "Liga" a "La Liga Habla!". Cambiar "Reviews y guías" a "Reviews y Guías" (G mayúscula).

JSX del nav-link: usar la clase `nav-link` y `nav-link active` (NO Tailwind):

```tsx
<nav className="nav-links">
  {LINKS.map((link) => (
    <Link
      href={link.href}
      className={`nav-link${isActive ? " active" : ""}`}
    >
      {link.label}
    </Link>
  ))}
</nav>
```

#### `apps/web/components/layout/UserMenu.tsx`

Reemplazar HTML para que coincida con el dropdown del mockup (líneas ~2149-2200):

```tsx
<div className="avatar-wrap" style={{position: "relative"}}>
  <button className="avatar-mini avatar-trigger">
    <span>{iniciales}</span>
  </button>
  <div className="avatar-dropdown">
    <div className="avatar-dd-header">
      <div className="avatar-dd-avatar">{iniciales}</div>
      <div>
        <div className="avatar-dd-name">@{username}</div>
        <div className="avatar-dd-email">{email}</div>
        <div className="avatar-dd-badges">
          {/* Badge según estado */}
        </div>
      </div>
    </div>
    {/* Resto del dropdown según mockup */}
  </div>
</div>
```

Replicar literalmente la estructura del mockup, item por item.

#### `apps/web/components/layout/Footer.tsx`

Reemplazar todo el JSX por el HTML del `<footer class="app-footer">` del mockup (línea ~4751). Replicar literalmente columnas, links, disclaimer, copy de apuesta responsable, mención de Línea Tugar 0800-19009.

#### `apps/web/components/layout/BottomNav.tsx`

Reemplazar todo el JSX por el HTML del `<nav class="bottom-nav">` del mockup. Replicar items, iconos, copy literal.

#### `apps/web/app/(main)/layout.tsx` y `apps/web/app/(public)/layout.tsx`

Estos layouts envuelven el contenido. Verificar que renderizan `<NavBar />`, `{children}`, `<Footer />`, `<BottomNav />` sin estructura extra. Si tienen wrappers tipo `<main className="bg-something pt-16">`, eliminarlos — el mockup no los tiene.

### Restricciones del Lote S

- **Cero clases Tailwind** en los componentes globales. Solo clases del mockup.
- **Cero copy alterado**: si el mockup dice "Empezar gratis", el componente dice "Empezar gratis".
- **Cero items de nav inventados**: solo los 5 que el mockup tiene.
- **Cero estructura extra**: no envolver con `<div className="...">` que el mockup no tiene.

### Criterios de cierre del Lote S

- `NavBar.tsx`, `NavLinks.tsx`, `UserMenu.tsx`, `Footer.tsx`, `BottomNav.tsx` reescritos con HTML idéntico al mockup.
- Items de nav: exactamente los 5 del mockup, con copy exacto.
- Cero clases Tailwind en estos componentes.
- `pnpm tsc --noEmit` y `pnpm lint` pasan.
- Push a main + reporte post-lote.
- Sección 7 del reporte: confirmar para cada componente (NavBar, NavLinks, UserMenu, Footer, BottomNav) que:
  - HTML coincide con el mockup.
  - Clases CSS son las del mockup.
  - Copy es el del mockup.

---

# Lote T — Re-portar 4 vistas del Lote M

**Branch**: `feat/lote-t-vistas-fijas-liga-literales`

### Objetivo

Las 4 vistas que el Lote M / Q construyó (Las Fijas lista + detalle, Liga lista + detalle del partido) ahora se reescriben con HTML idéntico al mockup, ahora que el CSS del Lote R y los componentes globales del Lote S existen.

### Vistas y sus líneas en el mockup

| URL | `id` mockup | Líneas mockup |
|---|---|---|
| `/las-fijas` | `#page-fijas-list` | 2555 hasta el próximo `page-section` |
| `/las-fijas/[slug]` | `#page-fijas-detail` | 2772 hasta el próximo `page-section` |
| `/liga` | `#page-liga-list` | 3054 hasta el próximo `page-section` |
| `/liga/[slug]` | `#page-liga-detail` | 3522 hasta el próximo `page-section` |

### Procedimiento por vista (literal)

**Paso 1**. Abrir el mockup, navegar al `id` de la vista, leer el HTML completo desde la apertura de `<section class="page-section" id="...">` hasta su cierre.

**Paso 2**. Reescribir el page (`page.tsx`) y todos los componentes asociados con el HTML literal del mockup. Las reglas del v3.0 aplican estrictamente:

- Estructura HTML idéntica al mockup.
- Clases CSS del mockup (que ya están en `mockup-styles.css` por Lote R).
- Cero Tailwind utility classes.
- Cero componentes UI del repo (`<Badge>`, `<Card>`, `<Button>`) si su HTML difiere del mockup. Si el mockup tiene `<button class="btn-primary">`, la app tiene exactamente eso, no `<Button>`.
- Textos literales del mockup (donde no son datos dinámicos).
- Emojis literales del mockup.
- Cantidad exacta de columnas, badges, items, CTAs.

**Paso 3**. Reemplazar solo los datos hardcoded por interpolaciones de props/datos reales. Si el mockup dice:
```html
<td><div class="cell-equipos">Brentford <span class="vs">vs</span> West Ham</div></td>
```
La app dice:
```tsx
<td><div className="cell-equipos">{partido.equipoLocal} <span className="vs">vs</span> {partido.equipoVisita}</div></td>
```

**Paso 4**. Reemplazar `data-nav="..."` por `<Link href="...">` con la URL real correspondiente.

**Paso 5**. AuthGates: donde el mockup tiene clases `visitor-only`, `not-visitor-only`, `socios-only`, `not-socios-only`, envolver el bloque con `<AuthGate>`:

```tsx
<AuthGate state="visitor"><div className="visitor-only">...</div></AuthGate>
<AuthGate not="visitor"><div className="not-visitor-only">...</div></AuthGate>
<AuthGate state="socios"><div className="socios-only">...</div></AuthGate>
<AuthGate not="socios"><div className="not-socios-only">...</div></AuthGate>
```

Mantener las clases originales en el HTML (no son redundantes — el CSS las usa).

**Paso 6**. Servicios y endpoints del Lote M no se tocan. `las-fijas.service.ts`, `liga.service.ts`, `partido-slug.ts`, `tickets.service.ts` extendido, endpoints de tickets — todo intacto. Solo se reescribe la capa UI.

**Paso 7**. Verificación viewport por viewport: abrir en mobile (≤767px) y en desktop (≥1280px). Comparar con la sección correspondiente del mockup. Debe ser indistinguible.

### Componentes existentes a reescribir o eliminar

Los componentes que el Lote M / Q creó deben **reescribirse desde cero** con HTML idéntico al mockup, no parchear:

```
apps/web/components/fijas/FijasList.tsx          → reescribir literal
apps/web/components/fijas/FijasFilters.tsx       → reescribir literal
apps/web/components/fijas/PronosticoLibreCard.tsx → reescribir literal
apps/web/components/fijas/AnalisisBasicoCard.tsx
apps/web/components/fijas/CombinadaOptimaCard.tsx
apps/web/components/fijas/RazonamientoDetalladoCard.tsx
apps/web/components/fijas/AnalisisProfundoCard.tsx
apps/web/components/fijas/MercadosSecundariosCard.tsx
apps/web/components/fijas/BloqueoSociosTeaser.tsx
apps/web/components/fijas/PartidoCierreCtas.tsx
apps/web/components/partido/PartidoHero.tsx       → reescribir literal
apps/web/components/partido/LigaWidgetInline.tsx
apps/web/components/liga/LigaHero.tsx
apps/web/components/liga/ComoFuncionaLiga.tsx
apps/web/components/liga/PremiosGrid.tsx
apps/web/components/liga/RankingMensualTabla.tsx
apps/web/components/liga/LigaSeccion.tsx
apps/web/components/liga/PartidoLigaCardMobile.tsx
apps/web/components/liga/PartidoLigaRowDesktop.tsx
apps/web/components/liga/RankingPaginado.tsx
apps/web/components/liga/MiCombinadaCard.tsx
apps/web/components/liga/TorneoHero.tsx
apps/web/components/liga/LigaDetalleClient.tsx
apps/web/components/liga/PartidoCancelado.tsx
apps/web/components/liga/CrossProductBanner.tsx
apps/web/components/combo/ComboModalV32.tsx       → reescribir literal según modal-combinada del mockup
```

Cada uno: leer la sección correspondiente del mockup, reescribir el JSX literal.

### Criterios de cierre del Lote T

- Las 4 vistas (`/las-fijas`, `/las-fijas/[slug]`, `/liga`, `/liga/[slug]`) renderizan con HTML idéntico al mockup.
- En mobile y desktop, son visualmente indistinguibles del mockup (validación: abrir el mockup, abrir la vista deployada, comparar).
- Cero clases Tailwind utility en estos componentes.
- Datos reales conectados sin alterar la estructura visual.
- Backend del Lote M intacto.
- `pnpm tsc --noEmit` y `pnpm lint` pasan.
- Push a main + reporte post-lote.
- Sección 7 del reporte: para cada vista, confirmar fidelidad con checklist de 8 puntos (estructura HTML, clases CSS, textos, emojis, dimensiones, columnas, mobile, desktop).

---

# Lotes N, O, P — sin cambios estructurales, criterio v3.0

Los lotes N, O, P ejecutan después de R, S, T. Cada uno aplica el criterio del v3.0:

- HTML literal del mockup.
- Clases CSS del mockup (ya disponibles desde Lote R).
- Cero Tailwind utility en los componentes.
- Copy literal.
- Estructura literal.

El alcance de cada uno (qué vistas cubre) sigue como estaba en el plan v2.0.

---

# Prompt base para invocar cada lote

Cada lote es una sesión nueva e independiente. El prompt para Claude Code:

```
Ejecutá el Lote {LETRA} del Plan de Trabajo Claude Code v3.2 (versión 3.0, portación 100% literal del mockup).

LECTURA OBLIGATORIA antes de empezar:
1. docs/plan-trabajo-claude-code-v3.2.md — sección "La regla absoluta del v3.0" + sección del Lote {LETRA}.
2. docs/habla-mockup-v3.2.html — fuente de verdad. Inmodificable.
3. CLAUDE.md — reglas operativas.
4. Habla_Plan_de_Negocios_v3_2.md — contexto estratégico.
5. docs/analisis-repo-vs-mockup-v3.2.md — decisiones técnicas cerradas.

REGLA ABSOLUTA (no negociable, sin excepciones):
Todo HTML, CSS, copy, estructura de navegación y comportamiento que aparece en el mockup debe existir IDÉNTICO en la app.

Solo se permiten estos puntos de divergencia:
1. Datos: "Brentford" → {partido.equipoLocal}
2. Navegación: data-nav="..." → <Link href="...">
3. Estado de auth: clases visitor-only/socios-only → <AuthGate>
4. Lógica de negocio: validaciones, llamadas a API.

PROHIBIDO:
- Reinterpretar visualmente el mockup.
- Usar componentes UI del repo (<Badge>, <Card>, <Button>) si su HTML difiere del mockup.
- Usar clases Tailwind utility si el mockup usa clases nombradas (ej. "nav-link", "btn-primary"). Las clases del mockup están en mockup-styles.css (Lote R).
- "Mejorar" copy.
- Omitir items, columnas, badges del mockup.
- Inventar links de navegación que el mockup no tiene.

Reglas operativas vigentes (no cambian):
- Cero tests en local. Validación pre-push: tsc + lint.
- Push directo a main al cierre.
- Branch del lote: feat/lote-{LETRA-EN-MINUSCULA}-<slug>.
- Migraciones aditivas con --create-only.
- Auditoría 100% en acciones admin destructivas.
- Cero auto-publicación de análisis.
- TypeScript strict + Zod en entrada + Pino para logs.
- Apuesta responsable + Línea Tugar 0800-19009.

Autonomía total: decidí sin preguntar. Documentá las decisiones en el reporte.

Cerrá el lote con el formato de reporte de 6 secciones del CLAUDE.md más una sección 7:

7. Verificación de fidelidad. Para cada vista/componente del lote, confirmá explícitamente:
   - Estructura HTML coincide con el mockup.
   - Clases CSS son las del mockup.
   - Textos visibles son los del mockup.
   - Emojis son los del mockup.
   - Cantidad de columnas/items/badges coincide.
   - Mobile coincide con el mockup en mode-mobile.
   - Desktop coincide con el mockup en mode-desktop.
   - Cero clases Tailwind utility en componentes nuevos/reescritos.

Si cualquier punto no se cumple, NO cerrar el lote. Iterar hasta que se cumpla.

Adelante.
```

**Para arrancar el Lote R** (próximo paso):

> Ejecutá el Lote R del Plan de Trabajo Claude Code v3.2 (versión 3.0, portación 100% literal del mockup).
> Branch del lote: feat/lote-r-css-literal.

---

*— Fin del plan v3.0 —*

*Plan reescrito · enfoque de portación 100% literal · 6 lotes restantes: R + S + T + N + O + P · CSS, componentes globales y vistas re-portadas · cero interpretación de Claude Code.*
