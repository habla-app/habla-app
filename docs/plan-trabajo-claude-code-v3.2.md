# Plan de Trabajo Claude Code · Habla! v3.2

**Fecha**: 2 mayo 2026
**Deadline absoluto**: 8 de mayo de 2026 (sin sprints internos · alcance = mockup completo)
**Roadmap**: 6 lotes (K, L, M, N, O, P)

---

## Reglas operativas (vigentes desde CLAUDE.md actual)

Estas reglas ya existen en `CLAUDE.md` y no cambian. Claude Code las respeta sin recordatorio:

- **Cero tests locales**. Sin `pnpm dev`, sin `next build`, sin migrar BD local. Validación pre-push: solo `pnpm tsc --noEmit` + `pnpm lint`.
- **Push directo a main al cierre del lote**. Railway deploya automático. Sin gate de OK escrito del usuario.
- **Branch por lote** con nombre `feat/lote-<letra>-<slug>`. Merge a `main` + `git push origin main` al final.
- **Autonomía total**. Claude Code decide sin preguntar, documenta decisiones en el reporte.
- **Migraciones con `--create-only`**. SQL generado pero no aplicado local. Railway lo aplica al deploy.
- **Backup pre-deploy** solo si la migración compromete integridad (renames, type changes, drops). Aditivas puras (CREATE TABLE, ADD COLUMN) no requieren backup.
- **Commits Conventional**: `feat:`, `fix:`, `chore:`, `docs:`.
- **Cero servicios externos nuevos**. Todo está aprobado en este plan.
- **TypeScript strict + Zod en entrada + Pino para logs** (cero `console.log`).
- **Cero hex hardcodeados**. Tokens Tailwind del Lote A.
- **Auditoría 100%** en acciones admin destructivas (`logAuditoria()`).
- **Paridad mobile + desktop según mockup / desktop-only admin**. Para la pista usuario, mobile y desktop son ciudadanos de primera clase — el mockup v3.2 define ambos viewports y los dos deben implementarse con la misma calidad. Para la pista admin se mantiene desktop-only (1280px+, mobile bloqueado con `<MobileGuard>`).
- **Apuesta responsable + Línea Tugar 0800-19009** mencionados en cualquier comunicación que invite a apostar.
- **Cero auto-publicación de análisis**. Cada análisis pasa por aprobación humana antes de publicarse.

## Reglas nuevas v3.2 (a agregar a CLAUDE.md en Lote K)

- **Mockup v3.2 HTML como verdad absoluta e inmodificable**. El archivo `docs/habla-mockup-v3.2.html` define las 24 vistas (10 públicas + 14 admin) en sus dos viewports (desktop ~1400px y mobile ~380px) y los 3 estados de auth (Visitante / Free / Socio). El mockup **no se modifica para acomodar la implementación** — al revés: la implementación se adapta al mockup. Cualquier ambigüedad se resuelve mirando el mockup. El plan de negocios v3.2 (`Habla_Plan_de_Negocios_v3_2.md`) aporta contexto estratégico. El análisis (`docs/analisis-repo-vs-mockup-v3.2.md`) registra todas las decisiones técnicas tomadas. Estos tres documentos son la fuente de verdad y reemplazan al mockup viejo `docs/ux-spec/00-design-system/mockup-actualizado.html` y al `Habla_Plan_de_Negocios_v3.1.md`.
- **Paridad mobile + desktop según mockup para la pista usuario.** Mobile y desktop son ciudadanos de primera clase. El mockup v3.2 define explícitamente cómo se ve cada vista en cada viewport y ambos layouts deben implementarse con la misma calidad UX. NO existe la lógica "mobile-first se construye y desktop se adapta" — los dos diseños están planeados deliberadamente y son específicos. Targets de calidad: Lighthouse Mobile ≥90 y Lighthouse Desktop ≥95 en rutas críticas. La pista admin sigue siendo desktop-only (1280px+, mobile bloqueado con `<MobileGuard>`); esa decisión arquitectónica no cambia.
- **Política del paywall hardcodeada** en `apps/web/lib/config/paywall.ts`. Cero configuración dinámica vía DB. La vista `/admin/paywall` es de monitoreo y preview, no de toggles dinámicos.
- **Una combinada por jugador editable hasta el kickoff**. Validación obligatoria en servidor (no solo cliente). Unique constraint `(usuarioId, partidoId, torneoId)` en `Ticket`.
- **`promptVersion` + `inputsJSON` obligatorios** en cada `AnalisisPartido` generado por Claude API. Sin esto, el motor opera a ciegas.
- **Premios Liga Habla! pagados por Yape como premio publicitario**. Datos mínimos solamente: `nombre` (ya existe) + `yapeNumero` (capturado al ganar, no antes). Sin DNI, sin cuenta bancaria, sin Reniec, sin cifrado especial.

## Documentos que cada lote consume

Antes de cualquier lote, Claude Code lee:

1. **`docs/habla-mockup-v3.2.html`** — verdad absoluta del UX. Las dos secciones (desktop + mobile) y los tres estados de auth.
2. **`Habla_Plan_de_Negocios_v3_2.md`** — contexto estratégico, productos, KPIs, modelo de negocio.
3. **`docs/analisis-repo-vs-mockup-v3.2.md`** — todas las decisiones técnicas cerradas. En particular §1 (5 decisiones críticas), §4 (decisiones operativas) y §5 (resumen del modelo de datos).
4. **El `CLAUDE.md` actualizado** (Lote K lo deja al día).

Las specs viejas en `docs/ux-spec/` siguen siendo referencia para componentes que se reciclan tal cual, pero **el mockup v3.2 manda en cualquier conflicto**.

---

# Roadmap de 6 lotes (K → P)

| Lote | Nombre | Pista | Por qué va en este orden |
|---|---|---|---|
| **K** | Foundation v3.2 + URLs nuevas + redirects | Ambas | Establece schema, paywall config, auth state, URLs nuevas. Todo lo demás depende. |
| **L** | Motor enriquecido + AnalisisPartido productivo | Backend | El motor produce el objeto rico que las vistas leen. Va antes que las vistas para que tengan datos reales. |
| **M** | Las Fijas + La Liga (vistas centrales del usuario) | Usuario | Las vistas más complejas, con paywall por nivel y reglas de combinada. Concentra el riesgo en un lote. |
| **N** | Home + Socios + Socios Hub + Reviews y Guías + Perfiles | Usuario | El resto de vistas públicas. Más volumen pero menos complejidad. |
| **O** | Admin operación: refactor + 4 vistas nuevas | Admin | Cola validación con tabs, dashboard, partidos, liga-admin, liga-verificacion. |
| **P** | Admin analítica + pulido final + cierre | Ambas | Motor, paywall, embudo, vinculaciones + pulidos transversales + CLAUDE.md cierre + smoke runbook. |

**Estimación de tokens por lote**: cada uno está dimensionado entre el **Lote D** (frontend Premium) y el **Lote G** (admin análisis) del roadmap previo, que se ejecutaron limpiamente. Lotes M y N son los más voluminosos por cantidad de archivos pero la complejidad técnica está concentrada en M (paywall + combinada).

---

## Lote K — Foundation v3.2 + URLs nuevas + redirects

**Branch**: `feat/lote-k-foundation-v32`

### Objetivo

Dejar la base estructural lista para que los lotes siguientes ejecuten sin reescritura: schema enriquecido, configuración del paywall, hook de auth state, URLs nuevas con redirects 301, CLAUDE.md actualizado a v3.2.

### Alcance del lote

#### 1. Migración Prisma aditiva (decisión §4.1, §4.2, §4.3, §4.9 del análisis)

Crear migración `feat-lote-k-foundation-v32` con:

```prisma
model AnalisisPartido {
  id                  String   @id @default(cuid())
  partidoId           String   @unique
  partido             Partido  @relation(fields: [partidoId], references: [id], onDelete: Cascade)

  // Contenido generado por el motor
  pronostico1x2       String   // "LOCAL" | "EMPATE" | "VISITA"
  probabilidades      Json     // { local: 0.45, empate: 0.28, visita: 0.27 }
  mejorCuota          Json     // { mercado: "LOCAL", cuota: 2.10, casa: "Betsson" }
  analisisBasico      String   @db.Text  // forma reciente, H2H, lesiones (visible Free)
  combinadaOptima     Json?    // { mercados: [...], cuotaTotal, stake, evPlus }
  razonamiento        String?  @db.Text  // razonamiento detallado (Socios)
  analisisGoles       Json?    // estructura del análisis profundo de goles (Socios)
  analisisTarjetas    Json?    // estructura del análisis profundo de tarjetas (Socios)
  mercadosSecundarios Json?    // [{ mercado, cuota, value, casa }] (Socios)

  // Metadata operativa
  estado              EstadoAnalisis @default(PENDIENTE)
  promptVersion       String   // ej. "v3.2.0"
  inputsJSON          Json     // snapshot completo de inputs vistos por Claude
  generadoEn          DateTime @default(now())
  aprobadoPor         String?
  aprobadoEn          DateTime?
  rechazadoMotivo     String?
  archivadoEn         DateTime?  // para 410 Gone si Filtro 1 se desactiva

  // Costos y latencia
  latenciaMs          Int?
  tokensInput         Int?
  tokensOutput        Int?

  @@index([estado])
  @@index([generadoEn])
}

enum EstadoAnalisis {
  PENDIENTE
  APROBADO
  RECHAZADO
  ARCHIVADO
}

model Partido {
  // ... campos existentes
  mostrarAlPublico    Boolean  @default(false)  // Filtro 1
  elegibleLiga        Boolean  @default(false)  // Filtro 2
  visibilidadOverride VisibilidadOverride?      // override regla 7d
  analisisPartido     AnalisisPartido?
}

enum VisibilidadOverride {
  forzar_visible
  forzar_oculto
}

model Usuario {
  // ... campos existentes
  yapeNumero          String?  // capturado solo al ganar Top 10
}

model Ticket {
  // ... campos existentes
  numEdiciones        Int      @default(0)
  // Agregar unique constraint si no existe:
  @@unique([usuarioId, partidoId, torneoId])
}
```

Si `Ticket` ya tiene esa unique constraint en el schema actual, no agregarla otra vez. Si no la tiene, agregarla.

#### 2. Configuración del paywall hardcodeada

Crear `apps/web/lib/config/paywall.ts`:

```ts
// Política del paywall por nivel. Hardcoded por decisión.
// La vista /admin/paywall es de monitoreo, no de configuración dinámica.

export const PAYWALL_CONFIG = {
  bloques: {
    pronostico1X2: { free: true, socios: true },
    mejorCuotaLocal: { free: true, socios: true },
    comparadorCuotas: { free: true, socios: true },
    analisisBasico: { free: true, socios: true },
    combinadaOptima: { free: false, socios: true },
    razonamientoDetallado: { free: false, socios: true },
    analisisProfundoGoles: { free: false, socios: true },
    analisisProfundoTarjetas: { free: false, socios: true },
    mercadosSecundarios: { free: false, socios: true },
    contenidoComplementarioGeneral: { free: false, socios: true },
  }
} as const;

export type BloquePaywall = keyof typeof PAYWALL_CONFIG.bloques;

export function bloqueVisible(bloque: BloquePaywall, estado: 'visitor' | 'free' | 'socios'): boolean {
  if (estado === 'socios') return PAYWALL_CONFIG.bloques[bloque].socios;
  return PAYWALL_CONFIG.bloques[bloque].free; // visitor y free comparten la versión "free"
}
```

#### 3. Hook de auth state + componente AuthGate

Crear `apps/web/hooks/useAuthState.ts`:

```ts
// Devuelve 'visitor' | 'free' | 'socios'.
// Consume useSession() de NextAuth + lee si tiene Suscripcion activa.
// Cachea en sesión para no consultar en cada render.
```

Crear `apps/web/components/auth/AuthGate.tsx`:

```tsx
// <AuthGate state="socios">…</AuthGate>            → solo Socios
// <AuthGate not="visitor">…</AuthGate>              → Free + Socios (logueados)
// <AuthGate state={['visitor', 'free']}>…</AuthGate> → Visitor o Free pero NO Socio
```

#### 4. URLs nuevas y redirects 301

Renombrar carpetas de rutas:

```
app/(public)/cuotas/                    →  app/(public)/las-fijas/  (lista)
app/(public)/partidos/[slug]/           →  app/(public)/las-fijas/[slug]/  (detalle)
app/(public)/casas/                     →  app/(public)/reviews-y-guias/casas/
app/(public)/guias/                     →  app/(public)/reviews-y-guias/guias/
app/(public)/casas/page.tsx             →  app/(public)/reviews-y-guias/page.tsx (con tabs)
app/(public)/premium/                   →  app/(public)/socios/  (página de venta)
app/(public)/premium/mi-suscripcion/    →  app/(public)/socios-hub/  (área miembro)
app/(public)/premium/checkout/          →  app/(public)/socios/checkout/
app/(public)/premium/exito/             →  app/(public)/socios/exito/

app/(main)/comunidad/                   →  app/(main)/liga/
app/(main)/comunidad/[username]/        →  app/(main)/jugador/[username]/
app/(main)/comunidad/torneo/[id]/       →  app/(main)/liga/[slug]/  (detalle partido)
app/(main)/live-match/                  →  consolidar con app/(main)/liga/[slug]/
app/(main)/comunidad/mes/               →  app/(main)/liga/mes/
```

Actualizar `middleware.ts` con redirects 301:

```ts
const REDIRECTS_301: Record<string, string> = {
  '/cuotas': '/las-fijas',
  '/partidos': '/las-fijas',  // path prefix, mantener slug
  '/casas': '/reviews-y-guias/casas',
  '/guias': '/reviews-y-guias/guias',
  '/comunidad': '/liga',
  '/premium': '/socios',
  '/premium/mi-suscripcion': '/socios-hub',
  // ...etc
};

// Auto-redirección Socio → /socios-hub si entra a /socios
if (pathname === '/socios' && estadoAuth === 'socios') {
  return NextResponse.redirect(new URL('/socios-hub', req.url));
}
```

Actualizar `app/sitemap.ts` y `app/robots.ts` con URLs nuevas. Eliminar `/torneo/` legacy (ya en disallow).

#### 5. Limpieza

- Eliminar `app/(main)/perfil/eliminar/` (se integra inline en `/perfil` en Lote N).
- Eliminar `app/(public)/suscribir/` (ya redirect, ahora a `/socios`).

#### 6. Actualizar CLAUDE.md a v3.2

Reescribir sección "Modelo actual" para v3.2:
- Pivote: rebrand Premium → Socios + paywall por nivel + filtros admin formales + 4 productos.
- Tres productos → cuatro productos: Las Fijas, La Liga Habla!, Reviews y Guías, Socios.

Reescribir sección "Estado de lotes":
- Marcar A-J como histórico cerrado del v3.1.
- Agregar roadmap K-P del v3.2 con estado pendiente/en curso/cerrado por lote.

**Reescribir la regla 13 ("Mobile-first riguroso") por la nueva regla de paridad:**

> 13. **Paridad mobile + desktop según mockup para pista usuario; desktop-only para pista admin.** El mockup v3.2 (`docs/habla-mockup-v3.2.html`) define explícitamente cómo se ve cada vista en mobile (~380px) y en desktop (~1400px). Ambos viewports son ciudadanos de primera clase y ambos layouts deben implementarse con la misma calidad UX — no es que mobile mande y desktop se "adapte". Targets: Lighthouse Mobile ≥90 y Lighthouse Desktop ≥95 en rutas críticas (`/`, `/las-fijas/[slug]`, `/socios`, `/liga`). LCP móvil <2.5s / desktop <2s; INP móvil <200ms / desktop <150ms; CLS <0.1 ambos. Pista admin se mantiene desktop-only (1280px+, mobile bloqueado con `<MobileGuard>`).

Actualizar regla 12 para apuntar a `docs/habla-mockup-v3.2.html` como mockup vigente y agregar que **el mockup no se modifica para acomodar la implementación** — al revés.

Agregar las **seis reglas nuevas v3.2** listadas en este plan (mockup como verdad absoluta inmodificable, paridad mobile + desktop, paywall hardcodeado, una combinada por jugador con validación servidor, promptVersion + inputsJSON obligatorios, premios Yape sin DNI).

Mover `Habla_Plan_de_Negocios_v3.1.md` a `docs/legacy/Habla_Plan_de_Negocios_v3.1.md` y reemplazar por `Habla_Plan_de_Negocios_v3_2.md` en raíz.

Mover `docs/ux-spec/00-design-system/mockup-actualizado.html` a `docs/legacy/`. Colocar `habla-mockup-v3.2.html` como nuevo mockup vigente en `docs/`.

Colocar `analisis-repo-vs-mockup-v3.2.md` en `docs/`.

### Criterios de cierre del Lote K

- Migración Prisma generada (no aplicada local) y commiteada.
- `pnpm tsc --noEmit` y `pnpm lint` pasan limpios.
- Branch fusionado a `main` y push.
- Reporte post-lote completo según formato CLAUDE.md.
- CLAUDE.md actualizado a estado v3.2.

---

## Lote L — Motor enriquecido + AnalisisPartido productivo

**Branch**: `feat/lote-l-motor-enriquecido`

### Objetivo

El motor automático genera y guarda el objeto rico de análisis (no solo el pick simple del canal). Toda vista pública en lotes M y N tiene datos reales para renderizar.

### Alcance del lote

#### 1. Refactor del prompt curado

`apps/web/lib/services/picks-premium-prompts.ts`:

- Agregar constante `PROMPT_VERSION = "v3.2.0"` exportada.
- Reescribir el system prompt para que produzca objeto rico con schema completo: pronóstico 1X2 + probabilidades + análisis básico + combinada óptima + razonamiento detallado + análisis profundo de goles + análisis profundo de tarjetas + mercados secundarios.
- Mantener tono peruano, EV+ ≥5% para combinada recomendada, JSON estricto en la salida.
- Actualizar el parser para validar el schema rico con Zod.

#### 2. Servicio generador

`apps/web/lib/services/picks-premium-generador.service.ts`:

- Recibe `partidoId` y construye los inputs (cuotas implícitas, xG promedio, H2H, forma reciente, lesiones).
- Pasa inputs como JSON a Claude API junto con el prompt.
- Mide latencia + tokens.
- Guarda registro en `AnalisisPartido` con estado `PENDIENTE`, `promptVersion`, `inputsJSON` completo.
- Expone función `regenerarAnalisis(partidoId)` para que el admin pueda forzar regeneración desde `/admin/picks`.

`PickPremium` (canal WhatsApp) sigue funcionando: lee de `AnalisisPartido` aprobado para componer el mensaje del canal. Sin duplicación de datos.

#### 3. Worker de generación inmediata al activar Filtro 1

Cuando el admin activa `mostrarAlPublico = true` sobre un partido, dispara la generación inmediata vía worker.

Implementación: endpoint `PATCH /api/v1/admin/partidos/[id]/filtros` que actualiza el flag y, si pasa de false→true sin análisis previo, llama al generador. Si ya hay análisis archivado, restaura ese.

#### 4. Cron evaluador extendido

`apps/web/lib/services/picks-premium-evaluador.service.ts`:

- Evalúa todos los mercados nuevos del análisis: 1X2, BTTS, ±2.5, marcador exacto, tarjeta roja, mercados secundarios.
- Calcula EV+ realizado por análisis y agrega a totales mensuales.
- Maneja partido `CANCELLED` (decisión §4.9.4): no evalúa, registra estado.
- Maneja partido pospuesto: si `fechaInicio` cambió respecto al import previo, dispara notificación email a usuarios con tickets activos en ese partido (decisión §4.9.3).

#### 5. Servicio motor-salud nuevo

Crear `apps/web/lib/services/motor-salud.service.ts`:

- `obtenerKPIsMotor(rango)` — % aprobados sin edición, % acierto por mercado (1X2/BTTS/±2.5/marcador/tarjeta), EV+ realizado, latencia media, costo Claude API estimado.
- `obtenerTendenciaMotor(rango)` — datos para chart 90d.
- `obtenerCausasRechazo(rango)` — agrupación por motivo desde `AnalisisPartido.rechazadoMotivo`.
- Cache 5min.

#### 6. Endpoint admin del motor

`GET /api/v1/admin/motor/salud` (consume `motor-salud.service.ts`).
`POST /api/v1/admin/partidos/[id]/regenerar-analisis` (fuerza regeneración).

### Criterios de cierre del Lote L

- Motor produce `AnalisisPartido` con todos los campos y `promptVersion` + `inputsJSON`.
- Cron evaluador maneja correctamente partidos CANCELLED y pospuestos con notificación email.
- `motor-salud.service.ts` con cache y queries optimizadas.
- `pnpm tsc --noEmit` + `pnpm lint` limpios.
- Push a main + reporte post-lote.

---

## Lote M — Las Fijas + La Liga (vistas centrales del usuario)

**Branch**: `feat/lote-m-fijas-liga`

### Objetivo

Las dos vistas más complejas del usuario, con el paywall por nivel, las reglas integrales de combinada y la sincronía B↔C completas.

### Alcance del lote

#### 1. Las Fijas — lista (`/las-fijas`)

Fusión de `/cuotas` + `/partidos` en una sola vista con:

- Filtros por liga + por día.
- Tabla densa de partidos con columnas: equipos, hora, mejor cuota local, mejor cuota empate, mejor cuota visita, badge "Pick Habla!" si tiene análisis aprobado.
- En mobile, cards apiladas según layout del mockup; en desktop, tabla densa según layout del mockup. Ambos layouts son específicos del mockup, no genéricos responsive.
- Solo muestra partidos con `mostrarAlPublico = true`.

#### 2. Las Fijas — detalle (`/las-fijas/[slug]`)

La vista crítica con paywall por nivel. Estructura según mockup v3.2:

- Hero del partido (countdown, equipos, datos clave).
- Resumen del análisis (Free + Socios renderizados condicionalmente con `<AuthGate>`).
- Pronóstico 1X2 + probabilidades (Free).
- Comparador de cuotas completo (Free).
- Análisis básico: forma reciente, H2H, lesiones (Free).
- Combinada óptima + stake + EV+ (`<AuthGate state="socios">`).
- Razonamiento detallado (`<AuthGate state="socios">`).
- Análisis profundo de goles (`<AuthGate state="socios">`).
- Análisis profundo de tarjetas (`<AuthGate state="socios">`).
- Mercados secundarios con value (`<AuthGate state="socios">`).
- Bloques con `<AuthGate not="socios">` muestran teaser blur + CTA "Hacete Socio".
- Widget cross-link a Liga ("Compite por este partido en la Liga Habla!").
- CTAs jerárquicos según estado.
- Si el análisis está `ARCHIVADO`, devolver HTTP 410 Gone.

Reemplazar `<PickBloqueadoSeccion>` y `<PronosticoCard>` viejos por composiciones nuevas con `<AuthGate>`.

#### 3. La Liga — lista (`/liga`)

Rebuild sobre `/comunidad`:

- Hero con leaderboard del mes (Top 10 con premios).
- Sección "próximos partidos elegibles" (Filtro 2 + regla 7d).
- Sección "en vivo".
- Sección "terminados recientes".
- Solo partidos con `elegibleLiga = true` que pasen el filtro de visibilidad.

#### 4. La Liga — detalle del partido (`/liga/[slug]`)

Consolidación de `/comunidad/torneo/[id]` + `/live-match`:

- Hero del partido.
- Modal de combinada (botón "Hacer mi combinada" o "Editar mi combinada").
- Ranking en vivo paginado por bloques de 10 + fila sticky-bottom de "tu posición" cuando no estás en la página visible (decisión §4.11).
- Filas del ranking clickeables → `/jugador/[username]` con tooltip si visitor (decisión §4.10).
- WebSockets ya existentes para actualización en vivo.
- Cross-link a `/las-fijas/[slug]` ("Ver análisis completo").

#### 5. Modal de combinada — reglas integrales (decisión §4.9)

Refactor de `<ComboModal>`:

- Validación servidor en `/api/v1/tickets`: si `now() >= partido.fechaInicio`, rechazar con 422 + mensaje claro (decisión §4.9.2). Frontend además deshabilita botón.
- El usuario puede crear, editar (incrementa `numEdiciones`) y eliminar su combinada antes del kickoff (decisión §4.9.5).
- Después del kickoff: combinada inmutable.
- Las 5 predicciones obligatorias al guardar. Schema Zod ya valida.
- Mensaje del modal: "armá tu combinada de 5 predicciones".
- Privacidad: las combinadas ajenas no se exponen antes del kickoff (decisión §4.9.8).
- Constraint en BD bloquea duplicados (decisión §4.9.1, ya en Lote K).

#### 6. Manejo de partidos pospuestos (decisión §4.9.3)

- Cron de importación de partidos detecta cuando `fechaInicio` cambia respecto al valor previo.
- Dispara email a usuarios con tickets activos en ese partido: "El partido X cambió de horario. Tu combinada sigue activa, podés editarla hasta el nuevo kickoff".
- Combinada queda editable nuevamente.

#### 7. Manejo de partidos cancelados (decisión §4.9.4)

- Cron detecta estado `CANCELLED` de api-football.
- Tickets asociados: cero puntos para todos en ese partido (no negativo, no positivo).
- Email a usuarios con tickets en el partido: "El partido fue cancelado. Tus predicciones no cuentan para el ranking".
- Servicio `puntuacion.service.ts` salta partidos CANCELLED.

#### 8. Sincronía Las Fijas ↔ Liga

- Vista `/las-fijas/[slug]`: widget "Compite en la Liga (X tipsters compitiendo) → [Hacer combinada]" con cross-link a `/liga/[slug]`.
- Vista `/liga/[slug]`: widget "Ver análisis completo y cuotas comparadas → [Ir al análisis]" con cross-link a `/las-fijas/[slug]`.

### Criterios de cierre del Lote M

- Vistas Las Fijas (lista + detalle) y Liga (lista + detalle de partido) renderizan según mockup v3.2 desktop + mobile.
- Modal de combinada respeta las 9 reglas integrales de §4.9.
- Validación servidor antes del kickoff funciona (test mental: simular guardar 1s después del kickoff).
- Manejo de partidos pospuestos y cancelados con notificación email funciona.
- Lighthouse Mobile ≥90 y Desktop ≥95 sobre `/las-fijas/[slug]` (vista crítica) — ambos viewports validados contra el mockup.
- Push a main + reporte post-lote.

---

## Lote N — Home + Socios + Socios Hub + Reviews y Guías + Perfiles

**Branch**: `feat/lote-n-vistas-publicas-resto`

### Objetivo

Completar las vistas públicas restantes: Home con 3 estados consolidados, Socios (venta + Hub) con rebrand completo y sin webinars, Reviews y Guías unificadas, Mi Perfil con cuenta inline, Perfil público de jugador.

### Alcance del lote

#### 1. Home (`/`)

`app/(public)/page.tsx`:

- 3 estados de auth con `<AuthGate>`:
  - **Visitor**: hero con "Habla! Todas las fijas en una", CTA primario al registro de Liga, CTA secundario "Conocer Socios".
  - **Free (logueado)**: hero personalizado con username, mismo lema, CTA "Hacete Socio" como dominante.
  - **Socio**: hero consolidado del mockup (saludo + slogan + stats inline EV+/picks recibidos/pendientes + pick top destacado + CTAs "Ver mi hub Socios" + "Abrir canal WhatsApp").
- Sección "Encuentra las fijas" (peek de las próximas fijas top con CTA a `/las-fijas`).
- Sección "La Liga Habla!" (peek del leaderboard con CTA a `/liga`).
- Sección "Socios" (solo visible para Visitor + Free, oculta para Socios via `not-socios-only`).
- BottomNav mobile + nav desktop.

#### 2. Socios — página de venta (`/socios`)

Rebuild sobre `/premium`:

- Renombrar todo el copy "Premium" → "Socios" en componentes existentes.
- Eliminar todo lo relacionado a webinars (decisión cerrada).
- Hero, social proof, inclusiones, planes, garantía, testimonios, FAQ.
- Sticky CTA con auto-redirect a `/socios-hub` si el usuario ya es Socio (decisión §4.8, en middleware).

#### 3. Socios Hub (`/socios-hub`)

Rebuild sobre `/premium/mi-suscripcion` con la estructura del mockup v3.2:

- Hero del Socio con saludo + estado de suscripción.
- Picks de hoy resumen (link al canal + lista resumida con cuota, hora, casa).
- Performance histórica (chart simple con EV+ del mes/trimestre/total).
- Acceso al contenido complementario general (no atado a partido — análisis macro, criterios bankroll, lecturas de mercado).
- Suscripción + canal: estado, próximo cobro, cambiar plan, abrir canal WhatsApp, cancelar.
- Historial de pagos.
- **Sin sección de webinars** (eliminado).

#### 4. Reviews y Guías (`/reviews-y-guias`)

Fusión de `/casas` + `/guias` con tabs:

- Tab "Reviews de casas": grid de casas autorizadas MINCETUR con badge de autorización + bonos + CTA "Abrir cuenta".
- Tab "Guías": listado de guías evergreen con categorías (cómo apostar, glosario, mercados, gestión de bankroll).
- Detalle: `/reviews-y-guias/casas/[slug]` y `/reviews-y-guias/guias/[slug]` mantienen estructura MDX existente.

#### 5. Mi Perfil (`/perfil`)

Refactor del existente integrando inline lo que estaba en `/perfil/eliminar`:

- Sección "Cuenta": nombre, username, email, teléfono (datos editables inline).
- Sección "Privacidad": toggles para perfil público, mostrar stats, etc.
- Sección "Notificaciones": toggles email + push (lee `PreferenciasNotif`).
- Sección "Mis combinadas activas" (link a `/liga` con filtro propio).
- Sección "Acciones cuenta": cerrar sesión + eliminar cuenta (modal de confirmación).
- Si el usuario es ganador del Top 10 mensual: campo `yapeNumero` editable + estado del premio.

#### 6. Perfil público de jugador (`/jugador/[username]`)

Renombre de `/comunidad/[username]`:

- Header con username, avatar, estadísticas globales (% acierto, ranking actual, total combinadas).
- Últimas combinadas terminadas (no las activas — privacidad §4.9.8).
- Insignias / logros si aplica.
- Acceso solo para usuarios logueados; visitors ven una versión limitada con CTA a registrarse.

### Criterios de cierre del Lote N

- Las 6 vistas renderizan según mockup v3.2 (desktop + mobile + 3 estados de auth donde aplique).
- Sin referencias a "Premium" en copy de usuario (rebrand 100% completo).
- Sin webinars en ningún lado.
- `/perfil/eliminar` eliminado, integrado en `/perfil`.
- Lighthouse Mobile ≥90 y Desktop ≥95 sobre `/socios` y `/`.
- Push a main + reporte post-lote.

---

## Lote O — Admin operación: refactor + 4 vistas nuevas

**Branch**: `feat/lote-o-admin-operacion`

### Objetivo

Las vistas admin de operación diaria: refactor del dashboard, refactor de cola validación con tabs Free/Socios, vista nueva de Partidos con pipeline de filtros, vista de Liga del mes con sugerencias accionables, vista simple de Verificación Top 10 con Yape.

### Alcance del lote

#### 1. `/admin/dashboard` — agregar 2 secciones de KPIs nuevas

- Sección "Motor de Fijas": % aprobados sin edición, % acierto por mercado, EV+ realizado, latencia Claude API, costo/día.
- Sección "Liga Habla!": tipsters activos del mes, combinadas/partido, premios pagados puntualmente, ediciones promedio.

Reorganización menor del dashboard existente.

#### 2. `/admin/picks` — refactor con tabs Free/Socios (renombrar de `/admin/picks-premium`)

Reciclar `<PicksPremiumView>` agregando:

- Tabs en el detalle: "Free" (pronóstico, comparador, análisis básico) | "Socios" (combinada, razonamiento, goles, tarjetas, mercados secundarios).
- Atajos teclado A/R/E/↑↓/Esc se mantienen.
- Edición separada por tab — el editor edita la redacción del Free o del Socios independientemente.
- Aprobación es global del análisis completo (un solo botón).
- Preview real lateral con `<AuthGate>` simulado para ver Free vs Socios.

#### 3. `/admin/partidos` — vista NUEVA

Pipeline visual API → Filtro 1 → Filtro 2:

- Header con stats: "X partidos importados próximos 7d / Y visibles públicos / Z elegibles Liga".
- Tabla densa con columnas: equipos, fecha, liga, estado del análisis (sin generar / pendiente / aprobado / archivado), toggle "mostrar al público" (Filtro 1), toggle "elegible Liga" (Filtro 2), columna "visibilidad override".
- Activar Filtro 1 dispara generación inmediata (vía endpoint del Lote L).
- Desactivar Filtro 1: confirma + archiva análisis + URL pública pasa a 410 Gone.
- Filtros: liga, estado análisis, fecha.
- Auditoría 100% en cambios de filtros (`logAuditoria()`).

#### 4. `/admin/liga-admin` — rework de `/admin/torneos`

Estructura del mockup:

- Sección "Sugerencias accionables": partidos top próximos sin elegir Filtro 2, leaderboard con poco movimiento (engagement bajo), Top 10 sin Yape verificado.
- Sección "Partidos elegibles del mes": tabla con toggle de visibilidad pública 7d (override).
- Sección "Premios y Top 10": configuración del torneo + monto del premio + estado del pago de cada ganador.

#### 5. `/admin/liga-verificacion` — vista NUEVA

Vista simple del mockup (gracias a la decisión 3 de Yape):

- Tabla del Top 10 del mes en curso (o seleccionable de meses pasados).
- Columnas: posición, nombre, username, monto premio, Yape (capturado), fecha aceptación bases, estado pago.
- Botón "Pedir datos" (envía email al ganador para que ingrese su Yape en `/perfil`).
- Botón "Marcar como pagado" + nota interna obligatoria.
- Auditoría 100%.

### Criterios de cierre del Lote O

- 5 vistas funcionan según mockup v3.2.
- Atajos teclado preservados en `/admin/picks`.
- Auditoría 100% en cambios de filtros y acciones destructivas.
- Push a main + reporte post-lote.

---

## Lote P — Admin analítica + pulido final + cierre

**Branch**: `feat/lote-p-admin-analitica-cierre`

### Objetivo

Las 4 vistas admin de analítica + pulidos transversales que completan el alcance del mockup + actualización final de CLAUDE.md + smoke runbook v3.2.

### Alcance del lote

#### 1. `/admin/motor` — vista NUEVA

Salud del motor (consume `motor-salud.service.ts` del Lote L):

- 4 cards top: % aprobados sin edición, % acierto general, EV+ realizado del mes, costo Claude API/día.
- Chart 90d: EV+ realizado vs línea de break-even.
- Breakdown por mercado: tabla con 1X2, BTTS, ±2.5, marcador exacto, tarjeta roja → cada uno con % acierto.
- Tabla "Causas de rechazo" agrupado por motivo.
- Tabla "Latencia y tokens" últimas 50 corridas.

#### 2. `/admin/paywall` — vista NUEVA

Monitoreo y preview (NO configuración dinámica):

- Header: "La política del paywall está hardcodeada en `lib/config/paywall.ts`. Esta vista es solo de monitoreo y preview".
- Tabla con los bloques del paywall + a quién se muestra (Visitor / Free / Socio).
- Preview lado a lado: cómo se ve un análisis para Free vs Socios (renderizado real con `<AuthGate>` simulado).
- Sección "Conversión por bloque bloqueado": tabla con bloques + cuántos clicks "Hacete Socio" generaron en los últimos 30d.

#### 3. `/admin/embudo` — vista NUEVA

Funnel completo desde visitante hasta conversión:

- Funnel visual con divergencia Camino A (casas) vs Camino B (Socios).
- Insights cross-flow: % de Socios que también clickea casas, etc.
- Comparativa LTV/CAC entre los dos caminos.
- Filtros por rango temporal.

Crear servicio `apps/web/lib/services/embudo.service.ts` que computa el funnel desde `EventoAnalitica`.

#### 4. `/admin/vinculaciones` — vista NUEVA

3 sub-tabs:

- **Socios en WhatsApp**: stats sync membresía Channel ↔ DB, alertas de leak (cancelados aún unidos / unidos sin pago confirmado), botón "Forzar sync".
- **Usuarios por casa**: distribución de FTDs por casa afiliada, CTR por casa, identificar concentración.
- **Webhooks**: estado de OpenPay, Meta WhatsApp, S2S de afiliados, api-football. Última corrida + último error si lo hubo.

#### 5. Pulido transversal

- Toggles inline editables en `/perfil` cableados a `PreferenciasNotif`.
- Click en filas del ranking funcionando con tooltip para visitantes (decisión §4.10).
- RankingTable paginada con sticky-bottom (decisión §4.11).
- Verificar que todos los redirects 301 del Lote K funcionan (smoke check).
- Verificar Lighthouse Mobile ≥90 y Desktop ≥95 sobre Home, Las Fijas detalle, Socios, Liga.

#### 6. CLAUDE.md cierre v3.2

Actualizar:

- Marcar Lotes K, L, M, N, O, P como ✅ cerrados.
- Reemplazar la "Ruta crítica" del v3.1 (A-J) por la del v3.2 (K-P).
- Confirmar que documentación de referencia es `docs/habla-mockup-v3.2.html` + `Habla_Plan_de_Negocios_v3_2.md` + `docs/analisis-repo-vs-mockup-v3.2.md`.

#### 7. Smoke test runbook v3.2

Crear `tests/e2e/SMOKE-V32.md` con flujos end-to-end actualizados a las URLs nuevas:

- Visitor → registro Liga → free → socio (con OpenPay sandbox).
- Free → arma combinada → edita → no puede después del kickoff.
- Socio → recibe pick canal → ve análisis bloqueado desbloqueado en sitio.
- Admin → activa Filtro 1 → análisis aparece en cola → aprueba → publica.
- Admin → marca Top 10 como pagado → email al ganador.
- Smoke de redirects 301.

### Criterios de cierre del Lote P

- 4 vistas admin nuevas funcionan según mockup v3.2.
- Pulidos transversales aplicados.
- CLAUDE.md cerrado en v3.2.
- Smoke runbook v3.2 listo.
- Lighthouse Mobile ≥90 y Desktop ≥95 sobre rutas críticas verificado.
- Push a main + reporte post-lote.

---

## Resumen ejecutivo del plan

| Lote | Foco | Decisiones del análisis cubiertas |
|---|---|---|
| **K** | Foundation + URLs + redirects + CLAUDE.md v3.2 | §1 (5 decisiones críticas) parcial, §4.1, §4.2, §4.4, §4.8, §4.9.1, §4.9.7 |
| **L** | Motor enriquecido + cron evaluador | §1 dec. 1+2, §4.3 (objeto rico + promptVersion + inputsJSON), §4.9.3, §4.9.4 |
| **M** | Las Fijas + Liga + reglas combinada | §1 dec. 1, §4.5 parcial, §4.7 parcial, §4.9 (todas las 9 sub-decisiones), §4.10, §4.11 |
| **N** | Home + Socios + Reviews + Perfiles | §1 dec. 4, §4.7 resto |
| **O** | Admin operación + 4 vistas nuevas | §1 dec. 3 (Yape Top 10), §1 dec. 5, §4.5 (4 vistas), §4.6 |
| **P** | Admin analítica + pulido + cierre | §4.5 (1 vista), §4.10, §4.11, cierre integral |

**Total**: 6 lotes auto-contenidos, ejecutables en sesiones independientes de Claude Code. Cada uno respeta las reglas de CLAUDE.md vigentes y suma las nuevas reglas v3.2 que el Lote K deja registradas.

**Orden estricto**: K → L → M → N → O → P. K es prerequisito de todo (schema, URLs, paywall config). L es prerequisito de M, N, O, P (los datos del motor alimentan las vistas).

---

# Prompt base para invocar cada lote en Claude Code

Cada lote es una sesión nueva e independiente de Claude Code. El siguiente prompt es lo único que el operador necesita pegar al iniciar cada sesión — solo cambia la letra del lote (K, L, M, N, O o P).

```
Ejecutá el Lote {LETRA} del Plan de Trabajo Claude Code v3.2.

Documentos a leer ANTES de empezar (en este orden):
1. docs/plan-trabajo-claude-code-v3.2.md — sección del Lote {LETRA} con el alcance y criterios de cierre.
2. docs/habla-mockup-v3.2.html — fuente de verdad UX. Inmodificable. Define vistas mobile + desktop con paridad.
3. Habla_Plan_de_Negocios_v3_2.md — contexto estratégico, productos, KPIs.
4. docs/analisis-repo-vs-mockup-v3.2.md — todas las decisiones técnicas cerradas.
5. CLAUDE.md — reglas operativas del repo.

Reglas clave a respetar:
- El mockup v3.2 manda en cualquier ambigüedad y NO se modifica.
- Paridad mobile + desktop según mockup en pista usuario; admin sigue desktop-only.
- Cero tests en local. Validación pre-push: tsc + lint solamente.
- Push directo a main al cierre. Railway deploya solo.
- Branch del lote: feat/lote-{LETRA-EN-MINUSCULA}-<slug>.
- Migraciones aditivas con --create-only.
- Auditoría 100% en acciones admin destructivas.
- Cero auto-publicación de análisis (validación humana obligatoria).
- TypeScript strict + Zod en entrada + Pino para logs (cero console.log).
- Tokens Tailwind, cero hex hardcodeados.
- Apuesta responsable + Línea Tugar 0800-19009 obligatorios.

Autonomía total: decidí sin preguntar. Documentá las decisiones en el reporte.

Cerrá el lote con el formato de reporte de 6 secciones del CLAUDE.md:
1. Resumen 1 línea.
2. Archivos creados / modificados / eliminados.
3. Migración aplicada (o "ninguna") + SQL completo si la hubo.
4. Pasos manuales para Gustavo post-deploy (asumiendo cero contexto).
5. Pendientes que quedaron fuera del lote.
6. CLAUDE.md actualizado.

Adelante.
```

**Para usarlo:** copiar el prompt, reemplazar `{LETRA}` por la letra correspondiente (K, L, M, N, O o P) y `{LETRA-EN-MINUSCULA}` por la versión en minúscula (k, l, m, n, o, p). Ejemplo para Lote K:

> Ejecutá el Lote K del Plan de Trabajo Claude Code v3.2.
> Branch del lote: feat/lote-k-<slug>.

---

*— Fin del plan de trabajo —*

*Plan listo · 6 lotes K-P · paridad mobile + desktop según mockup · todas las decisiones técnicas cerradas · roadmap auto-contenido para Claude Code.*
