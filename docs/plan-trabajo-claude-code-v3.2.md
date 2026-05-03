# Plan de Trabajo Claude Code · Habla! v3.2 — REESCRITO

**Fecha**: 2 mayo 2026
**Versión**: 2.0 (fidelidad 1:1 al mockup)
**Deadline absoluto**: 8 de mayo de 2026

Este plan reemplaza al v3.2 v1.0. La diferencia esencial es **cómo se le instruye a Claude Code construir las vistas**: no se le pide construir interfaces, se le pide **portar el HTML del mockup como código de referencia**.

---

## El cambio de enfoque (lectura obligatoria antes de cualquier lote)

### El error del plan anterior

El plan v1.0 trataba el mockup como **referencia conceptual** — le decía a Claude Code "esta página debe tener un comparador de cuotas, paywall, sincronía con Liga, etc.". Claude Code interpretó esas listas funcionales como una especificación de **qué construir**, e implementó cada vista con su propio criterio visual usando los componentes y tokens del repo. El resultado funcionaba pero **no era el mockup**: estructura HTML distinta, tabla con menos columnas que las del mockup, clases CSS diferentes, copy reescrito.

### El enfoque correcto (este plan)

El mockup HTML v3.2 es **código de referencia, no concepto de diseño**. Cada vista del producto tiene su HTML exacto en `docs/habla-mockup-v3.2.html`, identificada por un `id` específico (`page-fijas-list`, `page-fijas-detail`, `admin-page-partidos`, etc.). El trabajo de Claude Code en cada lote es:

1. **Abrir el mockup**, navegar al `id` de la vista que está implementando.
2. **Copiar literalmente** la estructura HTML, las clases CSS, los textos y la jerarquía de elementos.
3. **Portar las clases CSS del mockup** al proyecto: el mockup usa clases como `partido-hero`, `cuota-cell`, `resumen-ejecutivo`, etc., con sus propios estilos definidos en el `<style>` del mockup. Claude Code debe **portar esas clases y sus estilos** al CSS global del proyecto (en `apps/web/app/globals.css` o un archivo dedicado), preservando la fidelidad visual.
4. **Reemplazar los datos hardcoded por props/datos reales** sin cambiar la estructura visual. Si el mockup dice "Brentford vs West Ham", la implementación dice `{partido.equipoLocal} vs {partido.equipoVisita}`. Si el mockup tiene "Hoy 09:00", la implementación tiene `{formatearHora(partido.fechaInicio)}`. Pero el HTML que envuelve esos datos es **idéntico** al del mockup.
5. **Conectar los handlers** de eventos (clicks, formularios, navegación) preservando el comportamiento implícito del mockup (por ejemplo, las filas del ranking son clickeables, los chips de filtros tienen estado activo, etc.).
6. **Validar viewport por viewport**: la vista renderizada en mobile debe ser indistinguible de la sección mobile del mockup, y la vista en desktop indistinguible de la sección desktop. Si no son idénticas, no se cierra el lote.

### Lo que NO debe hacer Claude Code

- **No reinterpretar visualmente** el mockup. Si el mockup tiene 9 columnas en una tabla, la implementación tiene 9 columnas — no 4 "porque queda más limpio".
- **No usar los componentes UI del repo (`<Badge>`, `<Card>`, `<Button>`, etc.) si su HTML resultante difiere del mockup**. Si hay conflicto entre un componente existente y el mockup, **el mockup gana** y el componente se reescribe o se reemplaza por HTML inline con las clases del mockup.
- **No usar los tokens Tailwind del repo (`text-display-lg`, `bg-brand-blue-main`, etc.) si rompen la fidelidad visual**. Si el mockup usa `--blue-main: #001050`, ese color se preserva — sea como variable CSS o como token Tailwind nuevo, lo que el lote considere mejor — pero el resultado renderizado es el del mockup.
- **No "mejorar" el copy** del mockup. Si dice "Comparador de cuotas en vivo · 30 partidos · refresco cada 30 min", eso queda. Si dice "Hacete Socio", queda. La interpretación creativa de Claude Code en términos de palabras es cero.
- **No omitir elementos del mockup** porque parezcan secundarios. Cada countdown, cada badge "EN VIVO", cada disclaimer al pie, cada CTA secundario, cada link en breadcrumb, está ahí porque está pensado.

### Cómo verificar la fidelidad

Al cerrar cada vista, Claude Code debe poder responder afirmativamente:

- ¿La estructura HTML de la vista renderizada coincide con la del mockup en `docs/habla-mockup-v3.2.html`?
- ¿Las clases CSS aplicadas son las del mockup (o equivalentes Tailwind/utility que renderizan idéntico)?
- ¿Los textos visibles son los del mockup (excepto donde corresponde reemplazar por datos reales)?
- ¿La cantidad y orden de bloques, secciones, columnas, badges, CTAs es la misma?
- ¿La vista en mobile (hasta 768px) coincide con la sección mobile del mockup?
- ¿La vista en desktop (1280px+) coincide con la sección desktop del mockup?

Si alguna respuesta es "no", la vista no se considera cerrada.

### Mapa de vistas del mockup

Cada vista está identificada por su `id` HTML en `docs/habla-mockup-v3.2.html`. Esta tabla es la fuente de verdad de qué `id` corresponde a qué URL del producto:

| URL del producto | `id` del mockup | Lote |
|---|---|---|
| `/` | `#page-home` | N |
| `/las-fijas` | `#page-fijas-list` | Q (re-portar) |
| `/las-fijas/[slug]` | `#page-fijas-detail` | Q (re-portar) |
| `/liga` | `#page-liga-list` | Q (re-portar) |
| `/liga/[slug]` | `#page-liga-detail` | Q (re-portar) |
| `/socios` | `#page-socios` | N |
| `/socios-hub` | `#page-socios-hub` | N |
| `/reviews-y-guias` | `#page-reviews` | N |
| `/perfil` | `#page-perfil` | N |
| `/jugador/[username]` | `#page-jugador` | N |
| `/admin/dashboard` | `#admin-page-dashboard` | O |
| `/admin/partidos` | `#admin-page-partidos` | O |
| `/admin/picks` | `#admin-page-picks` | O |
| `/admin/motor` | `#admin-page-motor` | P |
| `/admin/paywall` | `#admin-page-paywall` | P |
| `/admin/liga-admin` | `#admin-page-liga-admin` | O |
| `/admin/liga-verificacion` | `#admin-page-liga-verificacion` | O |
| `/admin/embudo` | `#admin-page-embudo` | P |
| `/admin/vinculaciones` | `#admin-page-vinculaciones` | P |
| `/admin/usuarios` | `#admin-page-usuarios` | O |
| `/admin/kpis` | `#admin-page-kpis` | P |
| `/admin/cohortes` | `#admin-page-cohortes` | P |
| `/admin/logs` | `#admin-page-logs` | O |
| `/admin/auditoria` | `#admin-page-auditoria` | O |

---

## Reglas operativas (vigentes desde CLAUDE.md actual)

Estas reglas no cambian:

- **Cero tests locales**. Sin `pnpm dev`, sin `next build`, sin migrar BD local. Validación pre-push: solo `pnpm tsc --noEmit` + `pnpm lint`.
- **Push directo a main al cierre del lote**. Railway deploya automático. Sin gate de OK escrito del usuario.
- **Branch por lote** con nombre `feat/lote-<letra>-<slug>`.
- **Autonomía total**. Claude Code decide sin preguntar, documenta decisiones en el reporte.
- **Migraciones con `--create-only`**. SQL generado pero no aplicado local.
- **Commits Conventional**: `feat:`, `fix:`, `chore:`, `docs:`.
- **Cero servicios externos nuevos**.
- **TypeScript strict + Zod en entrada + Pino para logs** (cero `console.log`).
- **Auditoría 100%** en acciones admin destructivas (`logAuditoria()`).
- **Cero auto-publicación de análisis** (validación humana obligatoria).
- **Apuesta responsable + Línea Tugar 0800-19009** mencionados en cualquier comunicación que invite a apostar.

## Reglas nuevas v3.2 (ya integradas a CLAUDE.md por el Lote K cerrado)

- **Mockup v3.2 HTML como verdad absoluta e inmodificable**. El archivo `docs/habla-mockup-v3.2.html` define las 24 vistas en sus dos viewports (desktop ~1400px y mobile ~380px) y los 3 estados de auth. **El mockup no se modifica para acomodar la implementación — al revés**.
- **Paridad mobile + desktop según mockup**. Lighthouse Mobile ≥90 y Desktop ≥95.
- **Política del paywall hardcodeada** en `apps/web/lib/config/paywall.ts`.
- **Una combinada por jugador editable hasta el kickoff** con validación servidor obligatoria.
- **`promptVersion` + `inputsJSON` obligatorios** en cada `AnalisisPartido`.
- **Premios Liga Habla! pagados por Yape** con datos mínimos.

## Regla nueva del enfoque v2.0 (a agregar a CLAUDE.md en Lote Q)

- **Fidelidad 1:1 al mockup como criterio de cierre.** Cada vista pública o admin que se construye o modifica debe ser visualmente indistinguible de la sección correspondiente del mockup HTML, en mobile y en desktop. La estructura HTML, las clases CSS, los textos visibles, el orden de elementos, la cantidad de columnas/badges/CTAs, todo coincide con el mockup. Una vista que cumple la funcionalidad pero difiere visualmente del mockup **no está terminada**.

## Documentos que cada lote consume

Antes de cualquier lote, Claude Code lee:

1. **`docs/habla-mockup-v3.2.html`** — fuente de verdad UX. Inmodificable.
2. **`docs/plan-trabajo-claude-code-v3.2.md`** (este archivo) — plan reescrito con enfoque de fidelidad 1:1.
3. **`Habla_Plan_de_Negocios_v3_2.md`** — contexto estratégico.
4. **`docs/analisis-repo-vs-mockup-v3.2.md`** — todas las decisiones técnicas cerradas.
5. **El `CLAUDE.md`** — reglas operativas del repo.

---

# Roadmap actualizado: Q + N + O + P

| Lote | Nombre | Estado | Pista | Razón |
|---|---|---|---|---|
| K | Foundation v3.2 + URLs nuevas + redirects | ✅ Cerrado | Ambas | Schema, URLs, paywall config, AuthGate. Backend correcto. |
| L | Motor enriquecido + AnalisisPartido productivo | ✅ Cerrado | Backend | Generador, evaluador, motor-salud. Backend correcto. |
| M | Las Fijas + La Liga | ⚠️ Backend OK · UI a re-portar | Usuario | Servicios y endpoints correctos. UI no es fiel al mockup → re-portar en Q. |
| **Q** | **Re-portar UI de M con fidelidad 1:1** | ⏳ **Pendiente** | Usuario | Reescribir las 4 vistas del Lote M (Las Fijas lista + detalle, Liga lista + detalle) portando HTML del mockup. Backend de M intacto. |
| N | Home + Socios + Reviews + Perfiles | ⏳ Pendiente | Usuario | Construir desde cero con enfoque de fidelidad 1:1. |
| O | Admin operación: refactor + 4 vistas | ⏳ Pendiente | Admin | Construir/refactorizar admin con enfoque de fidelidad 1:1. |
| P | Admin analítica + pulido + cierre | ⏳ Pendiente | Ambas | 4 vistas analítica + pulidos + cierre CLAUDE.md. |

**Orden estricto**: Q → N → O → P. Q debe cerrar antes de N porque las URLs `/las-fijas/[slug]` y `/liga/[slug]` son linkeadas desde el Home (Lote N) y deben renderizar fielmente para validar la sincronía visual.

---

## Lote Q — Re-portar UI de Las Fijas + La Liga con fidelidad 1:1

**Branch**: `feat/lote-q-refidelizar-fijas-liga`

### Objetivo

Reescribir las 4 vistas que el Lote M dejó funcionalmente correctas pero visualmente desviadas del mockup. La meta es **que cada una de las 4 vistas, abierta en el navegador en mobile y desktop, sea indistinguible visualmente de la sección correspondiente del mockup HTML**.

El backend del Lote M (servicios `las-fijas.service.ts`, `liga.service.ts`, helper `partido-slug.ts`, extensiones a `tickets.service.ts`, endpoints de tickets) **no se toca** — está correcto. Lo único que se rehace es la capa UI.

### Vistas en el alcance

| URL | `id` del mockup | Líneas en el HTML del mockup |
|---|---|---|
| `/las-fijas` | `#page-fijas-list` | desde línea 2555 hasta antes del próximo `page-section` |
| `/las-fijas/[slug]` | `#page-fijas-detail` | desde línea 2772 |
| `/liga` | `#page-liga-list` | desde línea 3054 |
| `/liga/[slug]` | `#page-liga-detail` | desde línea 3522 |

### Procedimiento por vista (a seguir literalmente)

**Paso 1. Leer la sección del mockup** correspondiente al `id` de la vista. Identificar:
- Estructura HTML completa (todos los elementos, su jerarquía).
- Todas las clases CSS usadas en esos elementos.
- Todas las variables CSS referenciadas (ej. `var(--blue-main)`, `var(--gold)`).
- Todos los textos visibles.
- Comportamientos implícitos (chips activos, hovers, modales, scroll, etc.).

**Paso 2. Identificar las clases CSS del mockup** que usa la vista (ej. `partido-hero`, `cuota-cell`, `resumen-ejecutivo`, `fijas-list-table`). Buscar sus definiciones en el `<style>` del mockup HTML. Portar esas definiciones a un archivo CSS de la app:

- Crear `apps/web/app/mockup-styles.css` (un solo archivo para todas las clases del mockup).
- Importarlo desde `apps/web/app/globals.css` con `@import`.
- Copiar las definiciones de las clases del mockup tal cual (incluyendo variables CSS al `:root`).

Si una clase del mockup ya existe en el repo con otra definición, **gana la del mockup** — se reemplaza la del repo.

**Paso 3. Construir el JSX de la vista** copiando la estructura HTML del mockup. Cada elemento HTML del mockup → un elemento JSX equivalente con las mismas clases. Donde el mockup tiene texto hardcoded ("Brentford", "Hoy 09:00", "47%"), la implementación interpola desde props/datos. Donde tiene `data-nav="..."` el mockup, la implementación usa `<Link href="...">` de Next.

**Paso 4. Conectar los datos reales.** Los servicios del Lote M ya devuelven los datos necesarios. Mapear las propiedades del servicio a los slots del JSX (preservando estructura). Cuando un dato no esté disponible, mostrar el mismo placeholder visual que el mockup (no inventar copy nuevo).

**Paso 5. Verificación viewport por viewport.** En mobile (≤768px): la vista debe ser igual a la sección mobile del mockup. En desktop (≥1280px): la vista debe ser igual a la sección desktop del mockup. Si el mockup tiene clases que se activan/desactivan por viewport (ej. media queries), portarlas también.

**Paso 6. Comportamientos.** Replicar los comportamientos del mockup:
- Chips de filtros: clickeables, con estado activo.
- Filas del ranking en `/liga/[slug]`: clickeables → `/jugador/[username]` (ya implementado en Lote M, verificar fidelidad visual del cursor + tooltip).
- Modal de combinada en `/liga/[slug]`: ya hay `<ComboModalV32>` en Lote M, verificar que su HTML renderizado coincide con el del mockup.
- AuthGates en `/las-fijas/[slug]`: los teasers `not-socios-only` deben verse como en el mockup, no con copy reinterpretado.

### Componentes existentes a evaluar

Los siguientes componentes que el Lote M creó deben ser **revisados uno por uno y reescritos si su HTML difiere del mockup**:

```
apps/web/components/fijas/FijasList.tsx          → reescribir con tabla 9 columnas del mockup
apps/web/components/fijas/FijasFilters.tsx       → reescribir con clases filter-chip, filter-search del mockup
apps/web/components/fijas/PronosticoLibreCard.tsx → reescribir con clases resumen-recomend del mockup
apps/web/components/fijas/AnalisisBasicoCard.tsx
apps/web/components/fijas/CombinadaOptimaCard.tsx
apps/web/components/fijas/RazonamientoDetalladoCard.tsx
apps/web/components/fijas/AnalisisProfundoCard.tsx
apps/web/components/fijas/MercadosSecundariosCard.tsx
apps/web/components/fijas/BloqueoSociosTeaser.tsx
apps/web/components/fijas/PartidoCierreCtas.tsx
apps/web/components/partido/PartidoHero.tsx       → reescribir con partido-hero, partido-hero-teams, team-shield, partido-vs, partido-countdown del mockup
apps/web/components/partido/LigaWidgetInline.tsx
```

Los demás componentes (helpers de servicio, ComboModalV32, RankingPaginado, etc.) se evalúan caso por caso.

### Variables CSS críticas a portar

El mockup define variables CSS en su `<style>`. Las críticas a portar al `:root` del proyecto:

```css
:root {
  --blue-main: #001050;
  --blue-pale: ... (verificar valor en mockup);
  --gold: #FFB800;
  --gold-pale: ...;
  --bg: ...;
  --text-strong: ...;
  --text-muted-d: ...;
  --live: ...;
  /* Resto según el mockup */
}
```

Verificar el `<style>` completo del mockup y portar todas las variables que las clases CSS porteadas referencien.

### Criterios de cierre del Lote Q

- Las 4 vistas (`/las-fijas`, `/las-fijas/[slug]`, `/liga`, `/liga/[slug]`) renderizan con HTML cuya estructura y clases coinciden con las secciones correspondientes del mockup.
- En mobile y desktop, la apariencia visual es indistinguible del mockup (validación: abrir el mockup en el browser, abrir la vista deployada, comparar).
- Los datos reales se muestran correctamente preservando la estructura visual.
- Los comportamientos (chips, modales, ranking clickeable, AuthGates) funcionan según el mockup.
- `pnpm tsc --noEmit` + `pnpm lint` pasan.
- Backend del Lote M intacto (cero cambios a servicios, endpoints, schema).
- Push a main + reporte post-lote según formato CLAUDE.md.
- Reporte incluye sección "Verificación de fidelidad" con confirmación explícita de que cada una de las 4 vistas fue comparada contra su sección del mockup.
- Actualizar CLAUDE.md agregando la regla nueva de "Fidelidad 1:1 al mockup como criterio de cierre" (la regla nueva del enfoque v2.0).

---

## Lote N — Home + Socios + Reviews + Perfiles

**Branch**: `feat/lote-n-vistas-publicas-resto`

### Objetivo

Construir las 6 vistas públicas restantes con fidelidad 1:1 al mockup desde el inicio.

### Vistas en el alcance

| URL | `id` del mockup |
|---|---|
| `/` (home) | `#page-home` |
| `/socios` | `#page-socios` |
| `/socios-hub` | `#page-socios-hub` |
| `/reviews-y-guias` | `#page-reviews` |
| `/perfil` | `#page-perfil` |
| `/jugador/[username]` | `#page-jugador` |

### Procedimiento

Para cada vista, aplicar el procedimiento de 6 pasos descrito en el Lote Q (Pasos 1-6).

### Notas específicas por vista

**`/` (home)** — `#page-home`

El mockup tiene **3 versiones del home según estado de auth** (Visitante / Free / Socio). Buscar en el mockup las clases `visitor-only`, `free-only`, `socios-only`, `not-socios-only` y replicar la lógica con `<AuthGate>` en React.

El hero de Socio (consolidado en sesión anterior) tiene saludo + slogan + stats inline + pick top destacado + CTAs. Portar exacto.

**`/socios`** — `#page-socios`

Página de venta. Sin webinars (eliminados del producto). Si el mockup tiene aún algún rastro de webinar, ignorarlo (verificar antes — el mockup ya fue limpiado).

Auto-redirect Socio → `/socios-hub` está implementado en `middleware.ts` desde el Lote K. Solo verificar que sigue funcionando.

**`/socios-hub`** — `#page-socios-hub`

Hub del miembro activo. Sin webinars. Sin sección "Próximo webinar" (verificada eliminada en sesión anterior).

**`/reviews-y-guias`** — `#page-reviews`

Vista unificada con tabs Reviews + Guías. El contenido viene de los MDX existentes en `apps/web/content/casas/` y `apps/web/content/guias/`. Solo cambia la presentación.

**`/perfil`** — `#page-perfil`

Integra inline lo que estaba en `/perfil/eliminar` (eliminada en Lote K).

**`/jugador/[username]`** — `#page-jugador`

Renombre desde `/comunidad/[username]` (ya redirect 301 desde Lote K). Si el mockup muestra combinadas terminadas pero no las activas, respetar esa privacidad (decisión §4.9.8).

### Criterios de cierre del Lote N

- Las 6 vistas renderizan con fidelidad 1:1 al mockup en mobile y desktop.
- Sin referencias a "Premium" en copy de usuario (rebrand 100% a "Socios").
- Sin webinars en ningún lado.
- Lighthouse Mobile ≥90 y Desktop ≥95 sobre `/`, `/socios`.
- Push a main + reporte post-lote.

---

## Lote O — Admin operación: refactor + vistas nuevas

**Branch**: `feat/lote-o-admin-operacion`

### Objetivo

Las vistas admin de operación diaria con fidelidad 1:1 al mockup. La pista admin sigue siendo desktop-only (1280px+, mobile bloqueado con `<MobileGuard>`).

### Vistas en el alcance

| URL | `id` del mockup |
|---|---|
| `/admin/dashboard` | `#admin-page-dashboard` |
| `/admin/partidos` | `#admin-page-partidos` |
| `/admin/picks` | `#admin-page-picks` |
| `/admin/liga-admin` | `#admin-page-liga-admin` |
| `/admin/liga-verificacion` | `#admin-page-liga-verificacion` |
| `/admin/usuarios` | `#admin-page-usuarios` |
| `/admin/logs` | `#admin-page-logs` |
| `/admin/auditoria` | `#admin-page-auditoria` |

### Procedimiento

Para cada vista, aplicar el procedimiento de 6 pasos del Lote Q.

### Notas específicas por vista

**`/admin/dashboard`** — `#admin-page-dashboard`

Refactor del existente para coincidir con el mockup. Agregar 2 secciones de KPIs nuevas (Motor de Fijas y Liga Habla! reorganizado) según el mockup.

**`/admin/partidos`** — `#admin-page-partidos`

VISTA NUEVA. Pipeline visual API → Filtro 1 → Filtro 2 con toggles por fila. Endpoint `PATCH /api/v1/admin/partidos/[id]/filtros` ya existe desde Lote L. Solo construir la UI según el mockup.

**`/admin/picks`** — `#admin-page-picks`

Refactor desde `/admin/picks-premium`. El mockup tiene tabs Free/Socios en el detalle del análisis. Atajos teclado A/R/E/↑↓/Esc se preservan.

**`/admin/liga-admin`** — `#admin-page-liga-admin`

Rework desde `/admin/torneos`. Sección "Sugerencias accionables" + partidos elegibles con toggle visibilidad pública 7d.

**`/admin/liga-verificacion`** — `#admin-page-liga-verificacion`

VISTA NUEVA. Top 10 con Yape + nombre + estado de pago. Botón "Marcar como pagado" + auditoría 100%. Vista simple gracias a la decisión 3 del análisis (Yape, sin DNI).

**`/admin/usuarios`, `/admin/logs`, `/admin/auditoria`** — refactor visual de las existentes para coincidir con el mockup.

### Criterios de cierre del Lote O

- Las 8 vistas admin renderizan con fidelidad 1:1 al mockup en desktop (1280px+).
- Mobile bloqueado con `<MobileGuard>` en cada una.
- Atajos teclado preservados donde corresponden.
- Auditoría 100% en cambios de filtros y acciones destructivas.
- Push a main + reporte post-lote.

---

## Lote P — Admin analítica + pulido + cierre

**Branch**: `feat/lote-p-admin-analitica-cierre`

### Objetivo

Las vistas admin de analítica con fidelidad 1:1 + pulidos transversales + cierre del CLAUDE.md.

### Vistas en el alcance

| URL | `id` del mockup |
|---|---|
| `/admin/motor` | `#admin-page-motor` |
| `/admin/paywall` | `#admin-page-paywall` |
| `/admin/embudo` | `#admin-page-embudo` |
| `/admin/vinculaciones` | `#admin-page-vinculaciones` |
| `/admin/kpis` | `#admin-page-kpis` |
| `/admin/cohortes` | `#admin-page-cohortes` |

### Procedimiento

Para cada vista, aplicar el procedimiento de 6 pasos del Lote Q.

### Notas específicas

**`/admin/motor`** — `#admin-page-motor`

VISTA NUEVA. Servicio `motor-salud.service.ts` ya existe (Lote L). Endpoint `GET /api/v1/admin/motor/salud` ya expone los datos. Solo construir la UI según el mockup.

**`/admin/paywall`** — `#admin-page-paywall`

VISTA NUEVA. Vista de **monitoreo y preview**, no de configuración. Lee `lib/config/paywall.ts` y muestra los bloques + tasa de conversión.

**`/admin/embudo`** — `#admin-page-embudo`

VISTA NUEVA. Crear servicio `embudo.service.ts`. Funnel con divergencia Camino A (casas) vs Camino B (Socios). Datos vienen de `EventoAnalitica`.

**`/admin/vinculaciones`** — `#admin-page-vinculaciones`

VISTA NUEVA. 3 sub-tabs: Socios en WhatsApp, Usuarios por casa, Webhooks.

**`/admin/kpis`, `/admin/cohortes`** — refactor visual de las existentes (Lote G v3.1) para coincidir con el mockup.

### Pulidos transversales

- Smoke check de redirects 301 (desde Lote K).
- Verificar Lighthouse Mobile ≥90 y Desktop ≥95 sobre Home, Las Fijas detalle, Socios, Liga.
- Toggles inline editables en `/perfil` cableados a `PreferenciasNotif` (verificar desde Lote N).

### CLAUDE.md cierre v3.2

- Marcar Lotes Q, N, O, P como ✅ cerrados.
- Reemplazar la "Ruta crítica" por la del v3.2 final: K ✅ → L ✅ → M ✅ → Q ✅ → N ✅ → O ✅ → P ✅.

### Smoke test runbook v3.2

Crear `tests/e2e/SMOKE-V32.md` con flujos end-to-end actualizados:

- Visitor → registro Liga → free → Socio (con OpenPay sandbox).
- Free → arma combinada → edita → no puede después del kickoff.
- Socio → recibe pick canal → ve análisis bloqueado desbloqueado en sitio.
- Admin → activa Filtro 1 → análisis aparece en cola → aprueba → publica.
- Admin → marca Top 10 como pagado → email al ganador.
- Smoke de redirects 301.
- **Smoke de fidelidad visual**: abrir cada una de las 24 vistas en mobile y desktop, comparar contra el mockup, marcar OK.

### Criterios de cierre del Lote P

- 6 vistas admin nuevas/refactor con fidelidad 1:1 al mockup.
- Pulidos transversales aplicados.
- CLAUDE.md cerrado en v3.2.
- Smoke runbook v3.2 listo, con sección de fidelidad visual incluida.
- Push a main + reporte post-lote.

---

# Prompt base para invocar cada lote en Claude Code

Cada lote es una sesión nueva e independiente. El siguiente prompt es lo único que el operador necesita pegar al iniciar cada sesión — solo cambia la letra del lote (Q, N, O o P).

```
Ejecutá el Lote {LETRA} del Plan de Trabajo Claude Code v3.2 (versión 2.0, enfoque de fidelidad 1:1).

LECTURA OBLIGATORIA antes de empezar (en este orden):
1. docs/plan-trabajo-claude-code-v3.2.md — sección "El cambio de enfoque" + sección del Lote {LETRA}.
2. docs/habla-mockup-v3.2.html — fuente de verdad UX. Inmodificable. Identificá los `id` de las vistas del Lote {LETRA} y leelos enteros antes de tocar código.
3. Habla_Plan_de_Negocios_v3_2.md — contexto estratégico.
4. docs/analisis-repo-vs-mockup-v3.2.md — todas las decisiones técnicas cerradas.
5. CLAUDE.md — reglas operativas del repo.

REGLA CENTRAL DEL ENFOQUE (no negociable):
El mockup HTML es código de referencia, no concepto de diseño. Tu trabajo NO es construir interfaces que cumplan con una funcionalidad — es PORTAR el HTML del mockup a JSX de React preservando estructura, clases CSS, textos y comportamientos.

Procedimiento por vista:
1. Abrí docs/habla-mockup-v3.2.html y navegá al `id` de la vista (ej. #page-fijas-list).
2. Copiá la estructura HTML, clases CSS, textos y jerarquía exactos.
3. Portá las clases CSS del mockup al CSS global del proyecto (apps/web/app/mockup-styles.css importado desde globals.css). Incluye las variables CSS del :root del mockup.
4. Construí el JSX copiando la estructura HTML del mockup. Reemplazá solo los datos hardcoded por props/datos reales preservando la estructura visual.
5. Conectá handlers de eventos preservando comportamientos del mockup.
6. Verificá viewport por viewport: mobile (≤768px) y desktop (≥1280px) deben ser indistinguibles del mockup.

Lo que NO hagas:
- No reinterpretes visualmente el mockup. Si tiene 9 columnas, son 9 columnas.
- No uses componentes UI del repo (<Badge>, <Card>, etc.) si su HTML difiere del mockup. El mockup gana — reescribí o reemplazá.
- No "mejores" el copy. Los textos del mockup son los textos finales.
- No omitas elementos por considerarlos secundarios.

Reglas operativas vigentes (no cambian):
- Cero tests en local. Validación pre-push: tsc + lint solamente.
- Push directo a main al cierre. Railway deploya solo.
- Branch del lote: feat/lote-{LETRA-EN-MINUSCULA}-<slug>.
- Migraciones aditivas con --create-only.
- Auditoría 100% en acciones admin destructivas.
- Cero auto-publicación de análisis.
- TypeScript strict + Zod en entrada + Pino para logs.
- Apuesta responsable + Línea Tugar 0800-19009 obligatorios.

Autonomía total: decidí sin preguntar. Documentá las decisiones en el reporte.

Cerrá el lote con el formato de reporte de 6 secciones del CLAUDE.md, agregando una sección 7 nueva:
1. Resumen 1 línea.
2. Archivos creados / modificados / eliminados.
3. Migración aplicada (o "ninguna") + SQL completo si la hubo.
4. Pasos manuales para Gustavo post-deploy (asumiendo cero contexto).
5. Pendientes que quedaron fuera del lote.
6. CLAUDE.md actualizado.
7. Verificación de fidelidad: para cada vista del lote, confirmá explícitamente que la implementación renderiza idéntica al mockup en mobile y desktop. Si alguna vista no cumple fidelidad 1:1, no cerrar el lote.

Adelante.
```

**Para usarlo**: copiar el prompt, reemplazar `{LETRA}` por la letra correspondiente (Q, N, O o P) y `{LETRA-EN-MINUSCULA}` por la versión en minúscula.

Ejemplo para arrancar:

> Ejecutá el Lote Q del Plan de Trabajo Claude Code v3.2 (versión 2.0, enfoque de fidelidad 1:1).
> Branch del lote: feat/lote-q-<slug>.

---

*— Fin del plan de trabajo v2.0 —*

*Plan reescrito · 4 lotes pendientes Q + N + O + P · enfoque de portar HTML del mockup · fidelidad 1:1 como criterio de cierre.*
