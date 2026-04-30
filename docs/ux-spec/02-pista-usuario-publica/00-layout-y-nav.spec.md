# Layout y Navegación — Pista Pública

Spec base de los componentes de layout que envuelven todas las vistas públicas: header, bottom nav, footer global. Esta spec se implementa **antes** que cualquier vista individual porque todas dependen de estos componentes.

## Lote responsable

**Lote B** — Reauditoría móvil de la capa pública.

## Estado actual del repo

- `apps/web/app/(public)/layout.tsx` (Lote 8): layout con `<PublicHeader>` (avatar si hay sesión, "Iniciar sesión" si no), `<PublicNavLinks>` y `<Footer>` global. Sin `<BottomNav>`.
- `apps/web/components/public/PublicHeader.tsx` (Lote 8): header desktop-first con dropdown mobile.
- `apps/web/components/public/PublicNavLinks.tsx` (Lote 8): 5 links (Inicio · Pronósticos · Casas · Comunidad · Blog).
- `apps/web/components/layout/Footer.tsx` (Lote 11): 4 columnas con redes sociales + DisclaimerLudopatia inline.
- `apps/web/components/layout/BottomNav.tsx` (Lote 3): bottom nav de 5 items para `/(main)/*` actualmente. NO se usa en `/(public)/*` actualmente.

## Cambios necesarios

### Decisión arquitectónica clave

**Unificar el layout entre `/(public)/*` y `/(main)/*`** para usuarios anónimos y autenticados. La diferencia ahora es:

- Si NO hay session: BottomNav muestra ítem "Perfil" que linkea a `/auth/signin`.
- Si HAY session: mismo BottomNav, pero "Perfil" linkea a `/perfil`.

Esto permite que el visitante anónimo vea la app como un usuario, baja la fricción de registro, y simplifica el código. El plan de negocios v3.1 explícitamente dice que el usuario logueado va a la misma `/` que el anónimo (ver `01-arquitectura/inventario-vistas.md` sección 2 "Decisión arquitectónica v3.1").

### Archivos a modificar

- `apps/web/app/(public)/layout.tsx`:
  - Reemplazar `<PublicHeader>` por `<MobileHeader variant="public">` del design system.
  - **Agregar `<BottomNav>`** al final del layout (sticky bottom).
  - Mantener `<Footer>` pero entre el contenido y el BottomNav (footer NO sticky, scrolleable).
  - El layout pasa a ser: `<MobileHeader>` → `<main>` → `<Footer>` → `<BottomNav>`.

- `apps/web/components/layout/BottomNav.tsx`:
  - Adaptar para funcionar en ambos grupos `(public)` y `(main)`.
  - El ítem "Perfil" debe detectar session y redirigir a `/auth/signin` o `/perfil` según corresponda.
  - El ítem "Premium" debe redirigir a `/premium` (nueva vista del Lote D).
  - Conservar los 5 ítems pero actualizar paths según `mapa-rutas.md`:
    - 🏠 Inicio → `/`
    - ⚽ Partidos → `/cuotas` (vista del comparador global)
    - 🏆 Liga → `/comunidad`
    - 💎 Premium → `/premium`
    - 👤 Perfil → `/perfil` o `/auth/signin`

- `apps/web/app/(main)/layout.tsx`:
  - Refactor para usar el mismo `<MobileHeader variant="main">` y `<BottomNav>` compartidos.
  - Eliminar duplicación entre layouts public/main.

- `apps/web/components/layout/Footer.tsx`:
  - Mantener las 4 columnas y disclaimer.
  - Actualizar copy: cambiar slogan a *"Habla! Todas las fijas en una"* en columna de marca.
  - Agregar columna nueva "Premium" con link a `/premium` y descripción corta.
  - Conservar redes sociales SVG inline y disclaimer ludopatía.

### Archivos a crear

- `apps/web/components/ui/mobile/MobileHeader.tsx`:
  - Implementar según `componentes-mobile.md` sección 1.
  - Variantes: `public` (logo + búsqueda + iconos), `main` (logo + avatar + iconos), `transparent` (sobre hero coloreado, vistas de partido).
  - Props: `variant`, `showBack?`, `showLogo?`, `rightActions?`.
  - Altura 56px, sticky top.

- `apps/web/components/ui/mobile/BottomNav.tsx`:
  - Implementar según `componentes-mobile.md` sección 2.
  - Detección de active path con `usePathname()`.
  - Live indicator dot junto a "Inicio" si hay partido en vivo (consultar `live-matches.service.ts`).
  - Ítem "Perfil" con redirect lógico según `useSession()`.

- `apps/web/components/ui/mobile/StickyCTABar.tsx`:
  - Implementar según `componentes-mobile.md` sección 3.
  - Container reutilizable para vistas con CTAs primarios sticky bottom.
  - Props: `primary`, `secondary?`, `hideOnScroll?`.
  - Aparece SOBRE el `<BottomNav>` cuando se usa.

### Archivos a eliminar

- `apps/web/components/public/PublicHeader.tsx`: reemplazado por `<MobileHeader variant="public">`.
- `apps/web/components/public/PublicNavLinks.tsx`: ya no se usa (la navegación principal pasa al BottomNav).

## Datos requeridos

```typescript
// En el server component del layout
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { obtenerPartidosEnVivo } from '@/lib/services/live-matches.service';

export default async function PublicLayout({ children }) {
  const session = await getServerSession(authOptions);
  const haypartidoEnVivo = (await obtenerPartidosEnVivo()).length > 0;
  // ...
}
```

`<BottomNav>` recibe props para `liveDot: boolean` y `isAuthenticated: boolean`.

## Estados de UI

### MobileHeader

- Default: logo + 2 iconos (campana, menú).
- Si autenticado: logo + 2 iconos + `<Avatar>` del usuario.
- En vistas de partido (variante `transparent`): logo blanco sin background, sobre hero coloreado.

### BottomNav

- Visitante anónimo: 5 ítems con "Perfil" linkeando a `/auth/signin`.
- Autenticado: 5 ítems con "Perfil" linkeando a `/perfil`.
- Si hay partido en vivo: dot rojo `bg-live` junto al ícono de "Inicio" con `animate-pulse`.

### StickyCTABar

- Hidden por default.
- Aparece cuando una vista lo invoca explícitamente.
- Si `hideOnScroll`: se oculta al scrollear hacia abajo, reaparece al scrollear hacia arriba.

## Componentes que reutiliza

- `<Avatar>` del design system base (Lote A).
- `<Button>` del design system base.
- `<Badge>` para counters/dots (live indicator).
- Hooks `useSession()` (NextAuth) y `usePathname()` (Next).

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- Mobile-first: probar a 375px de ancho.
- Touch targets ≥44px en BottomNav y MobileHeader.
- Tokens del design system (`--admin-*` NO se usan en pista usuario; solo para admin).
- Z-index según `tokens.md`: header `z-header` (30), bottom nav `z-sticky` (20), sticky CTA bar entre los dos.
- Cero ejecución local. Validación con `pnpm tsc --noEmit` y `pnpm lint`.
- El layout debe respetar `safe-area-inset-bottom` para iPhones con notch inferior.

## Mockup de referencia

Ver `00-design-system/mockup-actualizado.html` sección "04 · Pista usuario · Home mobile" — incluye `<MobileHeader>` con logo + iconos en la parte superior, y `<BottomNav>` con 5 ítems en la parte inferior.

Para `<StickyCTABar>` ver sección "05·06" del mismo mockup, donde aparece la barra inferior con los CTAs en las vistas de Producto B y C.

## Pasos manuales para Gustavo post-deploy

Ninguno. Este lote es 100% código.

---

*Versión 1 · Abril 2026 · Layout y Nav base para Lote B*
