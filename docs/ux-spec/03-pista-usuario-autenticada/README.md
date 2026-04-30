# Pista Usuario Autenticada — Lote C

Specs y mockups de las 9 vistas autenticadas mobile-first de Habla! v3.1. Esta carpeta es lo que Claude Code lee al ejecutar el **Lote C — Reauditoría móvil capa autenticada** del roadmap A-J.

## Cómo lee este folder Claude Code

Cuando se ejecute el Lote C, leer en este orden:

1. Este `README.md`.
2. La carpeta `02-pista-usuario-publica/` completa (especialmente `00-layout-y-nav.spec.md` que define el layout compartido).
3. Cada `.spec.md` de vista en el orden de implementación recomendado abajo.
4. Para cada spec, abrir el `.html` correspondiente (cuando existe) en el navegador para validar visual antes de escribir código.

## Orden de implementación recomendado

Las vistas se implementan en este orden para minimizar dependencias:

| # | Vista | Spec | Mockup | Por qué este orden |
|---|---|---|---|---|
| 1 | Producto C `/comunidad/torneo/[slug]` ⭐ | `comunidad-torneo-slug.spec.md` | `comunidad-torneo-slug.html` | URL nueva. Vista crítica que sincroniza con Producto B. |
| 2 | Perfil `/perfil` | `perfil.spec.md` | `perfil.html` | Vista más compleja en cantidad de secciones. |
| 3 | Mis predicciones `/mis-predicciones` | `mis-predicciones.spec.md` | `mis-predicciones.html` | Rename de `/mis-combinadas`. Reescritura visual. |
| 4 | Comunidad `/comunidad` | `comunidad.spec.md` | (sin mockup individual) | Leaderboard mensual mobile-first. |
| 5 | Live match `/live-match` | `live-match.spec.md` | (sin mockup individual) | Refactor + alertas Premium. |
| 6 | Perfil público `/comunidad/[username]` | `comunidad-username.spec.md` | (sin mockup individual) | Refactor visual del Lote 11. |
| 7 | Mes cerrado `/comunidad/mes/[mes]` | `comunidad-mes.spec.md` | (sin mockup individual) | Refactor visual. |
| 8 | Eliminar perfil `/perfil/eliminar/confirmar` | (incluido en perfil.spec.md) | - | Sub-página del perfil. |

## Decisión arquitectónica clave del Lote C

### URL nueva: `/comunidad/torneo/[slug]` reemplaza `/torneo/[id]`

El concepto de "torneo" en el repo actual viene del modelo previo al pivot. En v3.1 el "torneo" ES el evento de Liga Habla! sincronizado con un partido específico. La URL antigua usa el `Torneo.id` (UUID); la nueva usa el `Partido.slug` (kebab-case legible).

**Migración:**
- Crear nueva ruta `/comunidad/torneo/[slug]/page.tsx`.
- En `next.config.js`, agregar redirect 301 de `/torneo/:id` → `/comunidad/torneo/:slug` resolviendo el slug del partido por ID. Si no se puede resolver (ej: torneo sin partidoSlug), redirect a `/comunidad`.
- Eliminar `/(main)/torneo/[id]/page.tsx` y `/(main)/torneos/page.tsx` después de la migración.

### Eliminación de vistas legacy

- `/(main)/page.tsx`: eliminado (decisión del Lote B — la home es única en `/`).
- `/(main)/matches/page.tsx`: eliminado (reemplazado por `/cuotas` del Lote B).
- `/(main)/torneo/[id]/page.tsx`: eliminado tras migración.
- `/(main)/torneos/page.tsx`: eliminado.
- `/(main)/mis-combinadas/page.tsx`: rename a `/mis-predicciones/page.tsx`.

### Layout compartido con pista pública

El Lote B ya creó el layout unificado con `<MobileHeader>` + `<BottomNav>`. El layout `/(main)/layout.tsx` se simplifica para usar los mismos componentes con `variant="main"` en el header.

## Convenciones

Cada `.spec.md` sigue la estructura canónica de 8 secciones definida en el README raíz de `docs/ux-spec/`.

## Estados del usuario en pista autenticada

En esta pista todos los usuarios están autenticados (Estados 1, 2, 3, 4 según `flujos-navegacion.md`). El visitante anónimo (Estado 0) no entra aquí — es redirigido a `/auth/signin` por middleware.

| Estado | Detección | Diferencia visual principal |
|---|---|---|
| Free | Session sin FTD ni Premium | CTAs Premium prominentes |
| FTD | Session + `usuario.ftdReportado=true` sin Premium | CTAs Premium con copy "tu acierto X% → 65%" |
| Premium | Session + `prisma.suscripcion.activa=true` | CTAs cross-sell de casas + acceso a contenido Premium |
| Admin | Session + `usuario.rol='ADMIN'` | Layout normal + botón "Admin →" en header (extra) |

## Reglas duras a respetar (extiende reglas 1-13 del CLAUDE.md raíz)

1. **Mobile-first riguroso.** Todas las vistas autenticadas son mobile-first.
2. **Reutilizar componentes del Lote A.** No crear duplicados.
3. **Reutilizar services backend** (leaderboard, tickets, perfil-publico, usuarios) sin tocarlos.
4. **CTAs según estado del usuario.** Cada spec define qué cambia.
5. **Cero ejecución local.** Validación pre-push: `pnpm tsc --noEmit` + `pnpm lint`.
6. **Cierre con merge a main + push.**
7. **Pasos manuales para Gustavo explícitos.**

## Lotes que dependen de este

- **Lote D** (Premium UI) reutiliza patrones de perfil para `/premium/mi-suscripcion`.
- **Lote E** (Premium backend) afecta vistas de perfil (sección Estado Premium) y `/comunidad/torneo/[slug]` (mostrar pick desbloqueado si suscriptor).

## Estado de las specs del Lote C

| Spec | Paquete entrega | Estado |
|---|---|---|
| `comunidad-torneo-slug.spec.md` + `.html` ⭐ | 4A | ✅ |
| `perfil.spec.md` + `.html` | 4A | ✅ |
| `mis-predicciones.spec.md` + `.html` | 4A | ✅ |
| `comunidad.spec.md` | 4B | ⏳ |
| `live-match.spec.md` | 4B | ⏳ |
| `comunidad-username.spec.md` | 4B | ⏳ |
| `comunidad-mes.spec.md` | 4B | ⏳ |

---

*Versión 1 · Abril 2026 · Lote C autenticada*
