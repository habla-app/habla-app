# Pista Admin · Operación — Lote F

Specs y mockups de las vistas del panel admin para operación diaria del negocio. Esta carpeta es lo que Claude Code lee al ejecutar el **Lote F — Admin desktop operación** del roadmap A-J.

## Cómo lee este folder Claude Code

Cuando se ejecute el Lote F, leer en este orden:

1. Este `README.md`.
2. `00-layout-admin.spec.md` — define sidebar lateral, topbar, cards, tablas. **Implementar primero**.
3. Cada `.spec.md` de vista en el orden de implementación recomendado abajo.

## Decisión arquitectónica clave

### Admin pasa de mobile-friendly a desktop-only

El Lote 5/6 actual tiene admin con layout responsive (`/admin/dashboard`, `/admin/leaderboard`). En v3.1 cambiamos:

- **Pista usuario:** mobile-first riguroso (Lotes B, C, D).
- **Pista admin:** desktop-only optimizado para 1280px+. **Mobile no soportado** — si se accede desde mobile, mostrar mensaje "Panel admin requiere pantalla ≥1280px".

Razón: el admin opera con tablas densas, gráficas, validación masiva de picks. Mobile no escala. Si Gustavo necesita admin en movilidad → tablet horizontal (iPad ≥1024px) o laptop.

### Sidebar lateral fijo reemplaza al topbar actual

`<AdminTopNav>` (Lote 5.1) era horizontal. En v3.1 cambia a `<AdminSidebar>` lateral fijo de 240px con secciones agrupadas (Operación / Análisis / Contenido / Sistema). Topbar simplificado con solo breadcrumbs + actions contextuales.

## Orden de implementación recomendado

| # | Vista | Spec | Mockup | Por qué este orden |
|---|---|---|---|---|
| 1 | Layout admin | `00-layout-admin.spec.md` | (en mockup-actualizado.html) | Base de todas las demás vistas |
| 2 | Dashboard | `dashboard.spec.md` | `dashboard.html` | Vista raíz del admin con KPIs + alarmas |
| 3 | Picks Premium ⭐ | `picks-premium.spec.md` | `picks-premium.html` | Vista crítica del flow Premium |
| 4 | Channel WhatsApp | `channel-whatsapp.spec.md` | (sin mockup individual) | Métricas del Channel |
| 5 | Suscripciones | `suscripciones.spec.md` | (sin mockup individual) | Lista y gestión |
| 6 | Afiliados + Conversiones | `afiliados-y-conversiones.spec.md` | (sin mockup individual) | Refactor visual |
| 7 | Newsletter | `newsletter.spec.md` | (sin mockup individual) | Refactor visual |
| 8 | Premios mensuales | `premios-mensuales.spec.md` | (sin mockup individual) | Refactor visual |

## Convenciones

Cada `.spec.md` sigue la estructura canónica de 8 secciones definida en el README raíz de `docs/ux-spec/`.

## Reglas duras a respetar (extiende reglas 1-13 del CLAUDE.md raíz)

1. **Desktop-only.** Optimizado 1280px+. Tablet horizontal aceptable. Mobile NO soportado.
2. **Sidebar lateral fijo** en lugar de topbar. Componentes admin específicos (`<AdminSidebar>`, `<AdminTopbar>`, `<AdminPageHeader>`) NO compartidos con pista usuario.
3. **Tokens admin específicos** del Lote A (`--admin-sidebar-bg`, `--admin-card-bg`, etc.).
4. **Atajos de teclado** en vistas operativas (validar picks, aprobar leaderboard, etc.).
5. **Auth doble:** middleware ya valida ADMIN, layout también valida defensa en profundidad.
6. **Cero ejecución local.** Validación pre-push: `pnpm tsc --noEmit` + `pnpm lint`.

## Dependencias entre lotes

- **Lote F depende de E** para mostrar suscripciones y picks Premium reales (modelos `Suscripcion`, `PickPremium` deben existir).
- **Lote G depende de F** para el sidebar y layout compartido.

## Estado de las specs del Lote F

| Spec | Paquete entrega | Estado |
|---|---|---|
| `00-layout-admin.spec.md` | 6A | ✅ |
| `dashboard.spec.md` + `.html` | 6A | ✅ |
| `picks-premium.spec.md` + `.html` ⭐ | 6A | ✅ |
| `channel-whatsapp.spec.md` | 6B | ⏳ |
| `suscripciones.spec.md` | 6B | ⏳ |
| `afiliados-y-conversiones.spec.md` | 6B | ⏳ |
| `newsletter.spec.md` | 6B | ⏳ |
| `premios-mensuales.spec.md` | 6B | ⏳ |

---

*Versión 1 · Abril 2026 · Lote F admin operación*
