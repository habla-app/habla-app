# Análisis del Repo · Mockup v3.2 — Documento cerrado

**Fecha**: 2 mayo 2026
**Estado**: todas las decisiones tomadas. Listo para diseñar el plan de lotes.

Este documento captura el análisis de qué del repo actual se recicla para implementar el mockup v3.2, con todas las decisiones técnicas cerradas. Es la fuente de verdad para construir el plan de trabajo.

---

## 1. Decisiones cerradas (las 5 críticas)

### Decisión 1 — Paywall por nivel: una sola plantilla, bloques condicionales

**Lo decidido:** una única página de partido (`/las-fijas/[slug]`) con bloques. Free ve los bloques visibles. Socio ve los mismos bloques + bloques adicionales que estaban bloqueados.

**Lo que NO existe** en términos de modelado de datos: NO hay dos análisis distintos. NO hay tabla `AnalisisPartido` aparte. NO hay duplicación.

**Lo que SÍ hay:** un solo objeto rico de análisis por partido. El frontend renderiza condicionalmente según el estado del usuario (`visitor | free | socios`). Ejemplo de bloques:

| Bloque | Visitor | Free | Socio |
|---|---|---|---|
| Pronóstico Habla! 1X2 + probabilidad | ✅ | ✅ | ✅ |
| Mejor cuota Local + comparador | ✅ | ✅ | ✅ |
| Análisis básico (forma, H2H, lesiones) | ✅ | ✅ | ✅ |
| Combinada óptima + stake + EV+ | 🔒 con CTA | 🔒 con CTA | ✅ |
| Razonamiento estadístico detallado | 🔒 con CTA | 🔒 con CTA | ✅ |
| **Análisis profundo de goles esperados** | 🔒 con CTA | 🔒 con CTA | ✅ |
| **Análisis profundo de tarjetas** | 🔒 con CTA | 🔒 con CTA | ✅ |
| Mercados secundarios con value (BTTS, ±2.5) | 🔒 con CTA | 🔒 con CTA | ✅ |

Los bloques nuevos en negrita son los que la decisión introduce: análisis profundo del partido (goles esperados con explicación, tarjetas con explicación) que no estaba antes.

### Decisión 2 — Generación dual del motor: una sola llamada con todo

**Lo decidido (consecuencia de la decisión 1):** el motor genera **un solo objeto rico** por partido en una sola llamada a Claude API. Ese objeto contiene todo: 1X2 + probabilidades + análisis básico + combinada + stake + EV+ + razonamiento + análisis profundo de goles + análisis profundo de tarjetas + mercados secundarios.

**Costo operativo:** ~US$ 3-5/día (no se duplica como en la opción de dos llamadas).

**Validación:** el editor en `/admin/picks` valida un solo objeto, edita la redacción donde corresponda, aprueba una vez.

### Decisión 3 — Verificación Top 10: pago por Yape como premio publicitario

**Lo decidido:** los premios mensuales del Top 10 se pagan por Yape como premio publicitario. No es renta laboral. Solo necesitamos información mínima.

**Datos a capturar del ganador (cuando gana, no antes):**
- Nombre completo (ya existe en `Usuario.nombre`).
- Número de Yape (un campo nuevo: `yapeNumero` en `Usuario`, capturado al momento de comunicar el premio).
- Aceptación de bases del concurso (timestamp en una columna o tabla separada).

**Lo que NO se hace:**
- No se piden DNI ni cuenta bancaria.
- No hay cifrado especial (Yape es un teléfono, no PII sensible más allá de lo razonable).
- No hay integración Reniec.
- No hay verificación previa al concurso — solo se piden los datos al ganar.

**Vista admin `/admin/liga-verificacion` simplificada:** muestra Top 10 con su nombre, Yape (si lo dieron), fecha en que aceptaron las bases, monto del premio, estado del pago (pendiente / pagado). Botón "Marcar como pagado" + nota interna.

### Decisión 4 — Hook de auth state: implementación simple y completa

**Lo decidido:** un hook único `useAuthState()` que devuelve uno de tres valores: `'visitor' | 'free' | 'socios'`. Más un componente `<AuthGate>` con prop `state` o `not-state` para mostrar/ocultar bloques en JSX.

```ts
// Pseudocódigo del hook
useAuthState(): 'visitor' | 'free' | 'socios'

// Pseudocódigo del componente
<AuthGate state="socios">…contenido solo para Socios…</AuthGate>
<AuthGate not="visitor">…contenido para Free + Socios…</AuthGate>
```

Internamente consume `useSession()` de NextAuth + lee si el usuario tiene una `Suscripcion` activa. Cache simple en sesión para no consultar en cada render.

### Decisión 5 — Configuración del paywall: lo más simple

**Lo decidido:** la política Free vs Socios se hardcodea en `lib/config/paywall.ts` como un objeto literal. La vista `/admin/paywall` no es de configuración dinámica sino de **monitoreo y preview**: muestra qué bloques ve un Free, qué bloques ve un Socio, y la tasa de conversión por bloque bloqueado (cuántos clickearon "Hacete Socio" desde cada paywall).

**Beneficios:**
- Cero migración de DB.
- La política se versiona en código (cambios trazables en git).
- Si en el futuro queremos toggles dinámicos, agregamos una tabla `FeatureFlag` (que ya existe) sin reescribir la implementación.

---

## 2. Cambios al producto derivados de las decisiones

- **Webinars eliminados del plan**. Aplicado al plan de negocios y al mockup. Ya no hay sección "webinars mensuales" en `/socios-hub` ni en la propuesta de Socios.
- **Análisis profundo de goles y tarjetas** entran como bloque adicional Socios en `/las-fijas/[slug]`. El motor lo genera como parte del objeto rico.
- **"Análisis profundos generales" no atados a un partido** (lo que llamaste "información complementaria") siguen siendo parte del producto Socios pero ahora se llaman explícitamente así, no "análisis quincenales con webinars".

---

## 3. Huecos que SE CIERRAN con las decisiones

| Hueco anterior | Estado |
|---|---|
| Estructura del paywall por nivel (tabla `AnalisisPartido` vs extender `PickPremium`) | Cerrado: una sola plantilla, bloques condicionales en frontend, modelo único de análisis. |
| Generación dual del motor (1 vs 2 llamadas Claude API) | Cerrado: 1 sola llamada, un objeto rico. |
| Datos de pago Top 10 (`DatosPagoUsuario`, cifrado, Reniec) | Cerrado: solo `yapeNumero` agregado a `Usuario`. Yape, no banco. |
| Hook centralizado de auth state | Cerrado: `useAuthState()` + `<AuthGate>`. |
| Modelo de configuración del paywall | Cerrado: hardcoded en `lib/config/paywall.ts`. |
| Override por partido del paywall | Eliminado: política global única, sin overrides. |
| Webinars en `/socios-hub` y `/socios` | Eliminado del producto. |

---

## 4. Decisiones operativas tomadas (cerradas)

Después de cerrar las 5 decisiones críticas, quedaron 11 decisiones operativas más concretas (mayormente de implementación, no de arquitectura). Todas están **resueltas y registradas** abajo. Cualquier futuro trabajo se ejecuta sobre estas decisiones — no se vuelven a discutir.

### 4.1 Modelo de filtros del admin (Filtro 1 + Filtro 2)

**Hueco**: el modelo `Partido` actual no tiene `mostrarAlPublico` ni `elegibleLiga` como flags formales. Hay que agregarlos.

**Decisiones tomadas:**
- **Almacenamiento**: dos columnas booleanas en `Partido` (`mostrarAlPublico` y `elegibleLiga`). La tabla de auditoría general (`AuditoriaAdmin`) que ya existe captura quién/cuándo/por qué cambia cada flag.
- **Disparador de generación**: al activar `mostrarAlPublico = true` sobre un partido nuevo, el sistema dispara inmediatamente la llamada a Claude API mediante un worker. El análisis aparece en la cola de validación (`/admin/picks`) en cuestión de segundos.
- **Desactivación de un partido publicado**: el análisis pasa a estado `ARCHIVADO` (no se elimina). La URL pública devuelve **HTTP 410 Gone** en lugar de 404. Esto le dice a Google "esto fue retirado intencionalmente, removelo del índice limpiamente" y evita penalización SEO.

### 4.2 Visibilidad pública de partidos elegibles Liga (regla de 7 días)

**Hueco**: el mockup dice que solo se muestran como visibles en Liga los partidos elegibles cuyo kickoff esté dentro de los próximos 7 días, con override manual del admin.

**Decisiones tomadas:**
- **Aplicación de la regla**: filtrado en query (sin cron). Cuando un usuario abre `/liga`, la consulta agrega `WHERE fechaInicio < NOW() + 7 days`. Cero infraestructura adicional, robusto, instantáneo.
- **Override manual**: una columna `visibilidadOverride` en `Partido` con tres valores posibles — `forzar_visible`, `forzar_oculto` o `null` (sigue la regla automática).
- **Query base resultante**: `(fechaInicio < NOW() + 7 days OR visibilidadOverride = 'forzar_visible') AND visibilidadOverride != 'forzar_oculto'`.

### 4.3 Schema del objeto rico de análisis

**Hueco**: el modelo `PickPremium` actual está pensado para "un pick = una recomendación de mercado con su justificación". El nuevo objeto rico es más amplio: tiene 1X2 con probabilidades + análisis básico + combinada + análisis profundo de goles + análisis profundo de tarjetas + mercados secundarios.

**Decisión puntual sobre la entidad principal:**
- ¿Extendemos `PickPremium` con campos JSONB adicionales (`probabilidadesJSON`, `analisisGolesJSON`, `analisisTarjetasJSON`, `mercadosSecundariosJSON`) y mantenemos compatibilidad?
- ¿O renombramos a `AnalisisPartido` y creamos relación a partido única, donde `PickPremium` (canal WhatsApp) lee de `AnalisisPartido` para componer el mensaje del canal?

**Recomendación operativa:** crear `AnalisisPartido` como nueva entidad (1:1 con `Partido`) que contiene el objeto rico completo. `PickPremium` para el canal WhatsApp queda como entidad separada que referencia `AnalisisPartido` (para no romper la cadena de generación / aprobación / distribución que ya está en producción). Nombres claros, separación de concerns, migración aditiva sin romper lo existente.

**Campos críticos de la entidad `AnalisisPartido` para infraestructura de medición y evolución del modelo:**

Más allá de los campos de contenido (probabilidades, razonamiento, análisis de goles, análisis de tarjetas, mercados secundarios), la entidad debe incluir desde el día 1 dos campos adicionales aparentemente menores pero críticos:

| Campo | Tipo | Para qué sirve |
|---|---|---|
| `promptVersion` | `String` (ej. `"v3.2.0"`) | Identifica qué versión del prompt curado en `picks-premium-prompts.ts` se usó para generar este análisis. Permite comparar performance entre versiones de prompt a lo largo del tiempo. Sin esto, cualquier ajuste de prompt es ciego — no podés saber si la nueva versión mejora o empeora vs la anterior. |
| `inputsJSON` | `Json` (JSONB en Postgres) | Snapshot completo de los datos que Claude recibió como contexto: cuotas implícitas calculadas en el momento, xG promedio últimos 5 partidos, head-to-head, lesiones reportadas, alineaciones probables, clima si aplica. Permite reproducir y debuggear cualquier análisis individual y entender por qué Claude predijo lo que predijo. |

Estos dos campos cuestan ~5 minutos de implementación al crear la entidad y son la diferencia entre **operar el motor con visibilidad** vs **operar a ciegas**. Con ellos, el cron evaluador (`picks-premium-evaluador.service.ts` que ya existe) puede después calcular métricas segmentadas por versión de prompt y por características del input.

**Lo que NO se diseña ahora pero queda preparado:**

El plan a largo plazo es introducir un **modelo cuantitativo independiente** (estilo Elo / SPI / Dixon-Coles / xG ajustado) que calcule probabilidades base a partir de datos históricos, y que Claude reciba como input para refinar cualitativamente (lesiones, motivación, contexto). Esto es lo correcto a largo plazo y la dirección estratégica del producto, pero **no se implementa en el lanzamiento del 8 de mayo**.

Razones para posponer:
- Hacerlo bien requiere 2-4 semanas dedicadas con conocimiento de modelos deportivos.
- Necesita datos históricos limpios de las ligas cubiertas — datos que se acumulan operando.
- Necesita backtest y calibración con resultados reales — disponibles solo después de operar.
- Diseñarlo ahora sin datos reales de operación produce un modelo basado en intuición, no en evidencia.

**Plan estratégico de evolución del motor (interno, no compromiso público):**

| Fase | Qué hace el motor | Cuándo |
|---|---|---|
| 1 — Lanzamiento | Claude estima probabilidades a partir de cuotas implícitas + datos básicos de api-football + prompt v1. Calidad razonable. | 8 mayo |
| 2 — Datos acumulados | 80-100 partidos evaluados con outcomes conocidos. Iteración del prompt y los inputs con base empírica. | Junio-Octubre |
| 3 — Modelo cuantitativo base | Implementación de Elo simple (o SPI ajustado) con histórico de las ligas cubiertas. Se pasa como input adicional al prompt. Claude lo usa como ancla numérica. | Octubre-Diciembre |
| 4 — Modelo refinado | Versión sofisticada del modelo cuantitativo (xG ajustado, ratings por jugador, factor local, etc.). Claude solo aporta interpretación cualitativa. | 2027 |

**Lo que sí va el 8 de mayo a nivel infraestructura de medición:**

- Campos `promptVersion` e `inputsJSON` en `AnalisisPartido` (cuesta ~5 min, valor enorme).
- Cron evaluador funcionando con outcomes registrados para todos los mercados nuevos.
- Vista `/admin/motor` con métricas básicas: % aprobados sin edición, % acierto por mercado (1X2, BTTS, ±2.5, marcador exacto, tarjeta roja), EV+ realizado, latencia y costo Claude API.

**Lo que NO va el 8 de mayo (queda como evolución):**

- Reliability diagram (calibración de probabilidades).
- Comparativa contra baseline tonto (apostar al favorito).
- Drift por liga / segmento / tipo de partido.
- Modelo cuantitativo Elo / SPI.

Estos cuatro nice-to-have se incorporan a `/admin/motor` cuando los datos acumulados los hagan útiles (3-6 meses post-lanzamiento). La vista admin se diseña con espacio para crecer.

### 4.4 URLs nuevas y plan de redirects 301

**Hueco**: el repo está en URLs viejas (`/cuotas`, `/partidos/`, `/casas/`, `/guias/`, `/comunidad/`, `/comunidad/[username]`, `/premium/`). El mockup usa nuevas (`/las-fijas/`, `/las-fijas/[slug]`, `/reviews-y-guias/`, `/liga/`, `/liga/[slug]`, `/jugador/[username]`, `/socios/`, `/socios-hub`).

**Decisión tomada:**
- **Redirect 301 inmediato desde el día 1 del lanzamiento**. Cualquier URL vieja redirige automáticamente a su equivalente nuevo.
- La autoridad SEO acumulada se transfiere de forma instantánea a las URLs nuevas.
- El navegador entiende "esto se mudó permanentemente". El usuario llega al contenido nuevo sin notar nada.
- Cero período de coexistencia, cero contenido duplicado.

### 4.5 Las 5 vistas admin que son código nuevo

Sin huecos arquitectónicos pendientes — son implementación. Las listo para registrar:

1. **`/admin/partidos`** — pipeline visual API → Filtro 1 → Filtro 2, tabla con dos toggles por fila + columnas de estado del análisis.
2. **`/admin/motor`** — KPIs de salud del motor (% sin edición, % acierto, EV+ realizado, latencia, costo Claude API), chart 90d, breakdown por mercado, causas de rechazo, configuración del modelo.
3. **`/admin/paywall`** — preview de bloques Free vs Socios + tabla de conversión por bloque bloqueado.
4. **`/admin/embudo`** — funnel completo desde visitante hasta conversión, con divergencia Camino A (casas) vs Camino B (Socios) + cross-flow + insights.
5. **`/admin/vinculaciones`** — 3 sub-tabs: Socios en WhatsApp (sync con leaks), Usuarios por casa (FTDs/CTR), Webhooks (estado externos).

### 4.6 Las vistas admin que necesitan refactor (no nuevo)

1. **`/admin/dashboard`** — agregar 2 secciones de KPIs nuevas (Motor de Fijas + Liga reorganizado). Refactor menor.
2. **`/admin/picks` (cola validación)** — agregar tabs Free/Socios al detalle del pick. Renombrar URL desde `/admin/picks-premium`. Refactor sobre componente existente.
3. **`/admin/liga-admin` (torneo del mes)** — expandir desde `/admin/torneos`: agregar sección sugerencias accionables, partidos elegibles con toggle visibilidad pública 7d.
4. **`/admin/liga-verificacion`** — vista nueva pero simple gracias a la decisión 3 (solo Yape + nombre + estado pago).

### 4.7 Las vistas públicas que necesitan reorganización

| Vista mockup | URL nueva | Refactor sobre |
|---|---|---|
| Home | `/` | `app/(public)/page.tsx` + `components/home/HomeHero.tsx` (consolidar 3 estados). |
| Las Fijas (lista) | `/las-fijas` | Fusionar `/cuotas` + `/partidos` en una sola vista con filtros + tabla densa. |
| Las Fijas (detalle) | `/las-fijas/[slug]` | Rebuild sobre `/partidos/[slug]` con `<AuthGate>` para los nuevos bloques Socios (combinada, análisis profundo de goles, análisis profundo de tarjetas, mercados secundarios). |
| La Liga Habla! (lista) | `/liga` | Rebuild sobre `/comunidad` con hero del mockup. |
| La Liga · Partido | `/liga/[slug]` | Consolidar `/comunidad/torneo/[id]` + `/live-match` en una sola vista con ranking en vivo paginado + modal combinada + cross-link. |
| Modal combinada | overlay | `ComboModal` ya existe, solo cambio de copy ("armá tu combinada de 5 predicciones"). |
| Socios (venta) | `/socios` | Rebuild sobre `/premium`. Quitar webinars. Renombrar a "Socios". |
| Socios Hub | `/socios-hub` | Rebuild sobre `/premium/mi-suscripcion` con la estructura del mockup (sin webinars). |
| Reviews y Guías | `/reviews-y-guias` | Fusionar `/casas` + `/guias` con tabs. |
| Mi Perfil | `/perfil` | Integrar `/perfil/eliminar` inline. Agregar sección Cuenta con datos editables + toggles de privacidad + acciones. |
| Perfil público de jugador | `/jugador/[username]` | Renombrar `/comunidad/[username]`. |

### 4.8 Auto-redirección Socio → /socios-hub

**Hueco**: el mockup hace que un Socio que navega a `/socios` sea redirigido automáticamente a `/socios-hub`.

**Decisión tomada**: la redirección es **server-side en `middleware.ts`**. Antes de empezar a renderizar la página, el servidor mira si quien pide es Socio activo y le devuelve directamente la URL del Hub. El Socio nunca ve un destello de la página de venta con sus banners "¡Hacete Socio!".

### 4.9 Reglas integrales de la combinada de la Liga

**Hueco principal**: la regla del producto es "una combinada por jugador por partido elegible, editable hasta el kickoff". Hay que asegurar que se respeta sin huecos. Pensando integralmente, además de la unique constraint surgen varios sub-huecos relacionados que conviene cazar ahora antes de programar.

**Decisiones tomadas (integrales):**

#### 4.9.1 Unique constraint en base de datos

Auditar el modelo `Ticket` actual. Si no tiene la combinación única `(usuarioId, partidoId, torneoId)` ya restringida, agregar esa restricción en migración aditiva. Esto **bloquea a nivel base de datos** que un usuario tenga dos tickets activos para el mismo partido — incluso si por algún bug del frontend se intentara, la base de datos lo rechazaría.

#### 4.9.2 Validación de "antes del kickoff" en el servidor

El frontend deshabilita el botón guardar cuando el partido pasa a estado `EN_VIVO`. Pero esa validación **no es suficiente**. El servidor también debe validar al recibir la solicitud de guardar/editar:

- Si `now() < partido.fechaInicio` → aceptar.
- Si `now() >= partido.fechaInicio` → rechazar con mensaje claro ("El partido ya empezó, las predicciones están bloqueadas").

Esto cubre la **race condition**: usuario abre el modal a las 14:59:55, el partido empieza a las 15:00:00, el usuario guarda a las 15:00:02. La validación del servidor garantiza que esos 2 segundos no rompan la regla.

#### 4.9.3 Partidos pospuestos (cambio de fechaInicio)

api-football puede cambiar la fecha del partido. Si Brentford vs West Ham se reprograma de las 15:00 a las 21:00, una combinada ya creada por el usuario debe:

- **Seguir siendo válida** (no se borra).
- **Ser editable nuevamente** hasta el nuevo kickoff (porque ahora hay más tiempo).
- **Notificar al usuario por email** que su combinada está activa pero el partido cambió de horario, para que revise si los datos siguen siendo lo que él quiere.

Esto requiere que el cron de importación de partidos (que ya existe) detecte cuando una `fechaInicio` cambia respecto al valor previo y dispare la notificación por email.

#### 4.9.4 Partidos cancelados

Si un partido se cancela (api-football lo marca como `CANCELLED` o equivalente), las combinadas asociadas:

- **No se evalúan**. El sistema de puntuación las salta.
- **Cero puntos para todos** los usuarios que predijeron ese partido (no negativo, no positivo).
- **El usuario es notificado** por email que el partido se canceló y sus predicciones quedan sin efecto.

El servicio `puntuacion.service.ts` (que ya existe) debe respetar el estado `CANCELLED` y no contar el partido para el ranking.

#### 4.9.5 Eliminación voluntaria de combinada

El usuario puede borrar su propia combinada antes del kickoff (ej. se arrepintió y prefiere no jugar ese partido). Después de borrar, **puede crear una nueva combinada** para ese partido, mientras siga antes del kickoff.

Después del kickoff, las combinadas son **inmutables** — no se pueden editar ni eliminar.

#### 4.9.6 Combinadas incompletas

La combinada debe tener los **5 mercados completados** al guardar (Resultado 1X2, BTTS, ±2.5 goles, Tarjeta roja, Marcador exacto). El schema Zod actual (`tickets.schema.ts`) ya valida esto. No hay combinadas parciales.

#### 4.9.7 Conteo de ediciones

Para alimentar la métrica "ediciones por combinada" del KPI, se agrega una columna `numEdiciones` a `Ticket` que se incrementa en cada actualización. Alternativamente se puede computar desde la auditoría general, pero una columna directa es más simple y rápida de consultar.

#### 4.9.8 Privacidad de combinadas ajenas

Las combinadas de otros usuarios son **privadas hasta que el partido empiece**. Antes del kickoff, ningún usuario puede ver qué predijo otro. Durante y después del partido, en el ranking en vivo se ven los puntos pero no las predicciones específicas — eso queda visible solo en el perfil público del jugador después del cierre del partido.

Esta regla evita la copia masiva de predicciones de los líderes del ranking.

#### 4.9.9 Combinadas en torneos cerrados

Una vez que un torneo mensual cierra (cron del día 1 a las 00:01 PET, ya existe), todas sus combinadas pasan a estado **histórico inmutable**. No se editan, no se eliminan, no se recalculan puntos. Quedan disponibles solo para consulta en perfiles públicos y en `/liga/historico` (si esa vista existe).

### 4.10 Click en filas ranking → perfil público

**Hueco**: las filas del ranking actual no son clickeables. El mockup las hace navegables a `/jugador/[username]` (con tooltip si es visitor).

**Decisión tomada**: las filas del ranking pasan a ser clickeables.
- Para usuarios logueados (free o socio): clic → navega al perfil público del jugador (`/jugador/[username]`).
- Para visitantes anónimos: clic → muestra tooltip "Iniciá sesión para ver perfiles" + CTA al registro de la Liga.

### 4.11 Ranking en vivo paginado con sticky-bottom

**Hueco**: la `RankingTable` actual muestra todo el ranking. El mockup lo pagina por bloques de 10 y mantiene "tu posición" sticky cuando no estás en la página visible.

**Decisión tomada**: implementar paginación en bloques de 10 + fila "tu posición" sticky en el borde inferior cuando el usuario no está en la página actual. La actualización en tiempo real (WebSockets ya existentes) sigue funcionando dentro de la página visible y en la fila sticky.

---

## 5. Resumen ejecutivo del análisis cerrado

**Todas las decisiones están cerradas.** Las 5 decisiones críticas de §1 + las 11 decisiones operativas de §4 (incluyendo los 9 sub-huecos de §4.9 sobre las reglas integrales de la combinada) están registradas. El análisis ya no tiene huecos pendientes.

**Cambios al modelo de datos respecto al repo actual:**

| Cambio | Tipo | Comentario |
|---|---|---|
| Nueva entidad `AnalisisPartido` (1:1 con `Partido`) | Aditivo | Contiene el objeto rico de análisis: probabilidades, razonamiento, análisis de goles, análisis de tarjetas, mercados secundarios, `promptVersion`, `inputsJSON`, estado de aprobación. |
| `Partido.mostrarAlPublico: Boolean` (default false) | Aditivo | Filtro 1. |
| `Partido.elegibleLiga: Boolean` (default false) | Aditivo | Filtro 2. |
| `Partido.visibilidadOverride: enum?` | Aditivo | Override manual de la regla 7d. Valores: `forzar_visible`, `forzar_oculto`, null. |
| `Usuario.yapeNumero: String?` | Aditivo | Capturado solo al ganar Top 10. |
| `Ticket.numEdiciones: Int (default 0)` | Aditivo | Para métrica de ediciones por combinada. |
| Unique constraint `(usuarioId, partidoId, torneoId)` en `Ticket` | Constraint | Si no existe ya. |

**Nuevos servicios backend:**
- `motor-salud.service.ts` — agrega métricas del motor para la vista `/admin/motor`.
- `embudo.service.ts` — calcula el funnel completo + cross-flow para `/admin/embudo`.

**Nuevas piezas de frontend:**
- Hook `useAuthState()` + componente `<AuthGate>`.
- 5 vistas admin nuevas (`/admin/{partidos, motor, paywall, embudo, vinculaciones}`).
- 1 vista admin nueva simple (`/admin/liga-verificacion`, solo Yape + estado pago).
- Refactor de cola validación admin con tabs Free/Socios.
- 11 vistas públicas reorganizadas con URLs nuevas + redirects 301.
- Paginación + sticky-bottom en `RankingTable`.

**% de reciclaje del repo actual:**

| Capa | % reusable | Comentario |
|---|---|---|
| Infra (Postgres, Redis, NextAuth, Tailwind, Cloudflare, Resend, Claude API) | 100% | Sin cambios. |
| Modelos Prisma | 92% | +1 entidad nueva, +5 columnas distribuidas, +1 constraint. |
| Servicios backend | 88% | Generador del motor produce ahora objeto rico. +2 servicios nuevos. Manejo de partidos pospuestos/cancelados extiende lógica existente. |
| Endpoints API | 95% | +endpoints para toggles de filtros, paywall preview, motor-salud. |
| Componentes app pública | 75% | Refactor de URLs + consolidación. Hook auth state. |
| Componentes admin | 78% | 5 vistas nuevas + refactor cola validación. |
| Cron jobs | 100% | Sin cambios. Detección de cambio de fechaInicio extiende cron de importación existente. |
| Contenido estático (MDX) | 100% | Sin cambios. |

---

## 6. Documentos finales y próximo paso

**Documentos cerrados:**
- `Habla_Plan_de_Negocios_v3_2.md` — plan de negocios v3.2 final.
- `habla-mockup-v3.2.html` — mockup v3.2 final (24 vistas, 3 estados auth, sin webinars).
- `analisis-repo-vs-mockup-v3.2.md` — este documento, análisis con todas las decisiones cerradas.

**Siguiente paso**: armar el plan de lotes de trabajo para Claude Code que llevará el repo del estado actual al estado del mockup v3.2. El plan se organizará respetando estas reglas:

1. **El mockup v3.2 es la verdad absoluta de lo que se entrega.** Cualquier ambigüedad de implementación se resuelve mirando el mockup.
2. **Cero plan de fechas internas**. El compromiso es 8 de mayo con todo el alcance funcional. Cómo se distribuye el trabajo entre lotes es cuestión de orden técnico, no de cronograma.
3. **Reciclaje agresivo**. Cada lote identifica explícitamente qué del repo actual se reutiliza y qué se construye nuevo.
4. **Migraciones aditivas siempre que sea posible**. Cero pérdida de datos en producción.
5. **Cobertura completa del mockup** — todas las 24 vistas, los 3 estados de auth, los flujos completos.

---

*— Fin del análisis cerrado —*

*Documento listo · Todas las decisiones tomadas · siguiente: plan de lotes para Claude Code.*
