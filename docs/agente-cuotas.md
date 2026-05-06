# Agente local de cuotas — instrucciones

> Lote V.13 — May 2026

El agente corre en tu PC con Chrome real + perfil persistente. Pollea el backend de Railway pidiendo jobs pendientes; por cada job ejecuta el scraper Playwright correspondiente y reporta el resultado al backend.

**Por qué local**: las casas Betano/Inkabet bloquean IPs de datacenter (Railway US 403 instantáneo desde WAFs Akamai/Imperva). Apuesta Total funciona desde Railway pero las otras 4 no. La única forma confiable de capturar las 5 casas es desde una IP residencial peruana con Chrome real — tu PC.

## Pre-requisitos (una sola vez)

1. **Google Chrome** instalado.
2. **Node.js + pnpm** instalados (ya los tenés porque tenés el repo).
3. **Variables de entorno** — agregalas a `apps/web/.env.local`:

   ```env
   HABLA_API_BASE=https://hablaplay.com
   HABLA_AGENTE_TOKEN=<el-mismo-CRON_SECRET-de-Railway>
   ```

   El `HABLA_AGENTE_TOKEN` es el mismo `CRON_SECRET` que ya tenés en Railway. Lo encontrás en el dashboard Railway → Variables del servicio `habla-app`.

4. Asegurate que las dependencias están instaladas:

   ```powershell
   pnpm install
   ```

## Cómo correrlo

```powershell
# 1. Cerrá TODAS las ventanas de Chrome (el agente usa tu perfil real)
taskkill /F /IM chrome.exe

# 2. Lanzá el agente
pnpm --filter @habla/web run agente-cuotas
```

Se abre una ventana de Chrome (visible — `headless: false`) y queda corriendo. El agente:
1. Cada **15s** pollea `GET /api/v1/admin/agente/jobs/proximos?limit=5` con tu Bearer token.
2. Si recibe jobs, los procesa **secuencialmente** abriendo el scraper Playwright correspondiente:
   - **doradobet** — click Shadow DOM al detalle del partido
   - **apuesta_total** — URL detalle dinámica (Kambi)
   - **betano** — listing per-event
   - **inkabet** — slug-based double nav
   - **te_apuesto** — listing único Coreix
3. Por cada job reporta `POST /api/v1/admin/agente/jobs/resultado` con:
   - `kind="ok"` + cuotas extraídas si funcionó
   - `kind="sin_datos"` si el partido no aparece en el listing o la variante 2.5 no está publicada
   - `kind="error"` si falló técnicamente
4. Si la cola queda vacía, espera **60s** antes del siguiente poll.

Para detener: **Ctrl+C**. Cierra el browser limpio.

## Flow end-to-end

```
Admin activa Filtro 1 sobre un partido
            │
            ▼
Backend (Railway) encola 5 jobs en BullMQ (uno por casa)
            │
            ▼
Jobs quedan en estado "waiting" (el processor en Railway está desactivado)
            │
            ▼
Agente local polleando: GET /api/v1/admin/agente/jobs/proximos
            │
            ▼ (5 jobs reservados con changeDelay(5min))
Para cada job:
  - Abre page del browser warm + perfil real
  - Navega URL listing de la liga
  - Hace doble nav al detalle (caso por caso)
  - Captura XHRs JSON + parsea cuotas
  - POST /api/v1/admin/agente/jobs/resultado
            │
            ▼
Backend persiste cuotas + actualiza salud + recalcula estado partido
            │
            ▼
Vista admin /admin/partidos/[id] muestra cuotas extraídas
```

## Cron diario (5am Lima)

El cron sigue funcionando en Railway: a las 5am Lima `instrumentation.ts` invoca `refrescarCuotasDelDia` que recorre todos los partidos con Filtro 1 ON y encola un refresh por cada (partido × casa). Los jobs se acumulan en BullMQ esperando que el agente los consuma.

**Importante**: si el agente no está encendido a las 5am, los jobs se acumulan en la cola hasta que enciendas. Tras 24h sin procesar, BullMQ los limpia automáticamente (`removeOnComplete: 100`, `removeOnFail: 500`).

Para que el cron funcione sin que estés despierto, dejá el agente corriendo en background. Opciones:
- **Servicio Windows** con [NSSM](https://nssm.cc/) — más robusto pero requiere setup.
- **Tarea programada** que arranca el agente al inicio de Windows.
- **PM2** (`npm i -g pm2 && pm2 start "pnpm --filter @habla/web run agente-cuotas" --name agente-cuotas`).

Recomendado: la opción más simple, lanzar el agente manualmente cuando vayas a usar la admin para validar partidos. La cola tolera rezagos de 24h.

## Output esperado

```
─── Agente cuotas — boot ─────────────────────────────────
 Chrome: C:\Program Files\Google\Chrome\Application\chrome.exe
 Profile: C:\Users\Tu\AppData\Local\Google\Chrome\User Data\Default
   ⚠ Usando tu perfil real de Chrome.
 API: https://hablaplay.com

[poll] 5 jobs recibidos

▶ DORADOBET · Universitario vs Alianza Lima (Liga 1 Perú)
  ✓ doradobet OK (32145ms) · cuotas={"1x2":...,"doble_op":...,"mas_menos_25":...,"btts":...}

▶ APUESTA_TOTAL · Universitario vs Alianza Lima (Liga 1 Perú)
  ✓ apuesta_total OK (28510ms) · cuotas={...}

▶ BETANO · Universitario vs Alianza Lima (Liga 1 Perú)
  ✓ betano OK (22340ms) · cuotas={...}

... (etc)
```

## Troubleshooting

- **`HABLA_API_BASE no configurada`** → Falta env var. Ver Pre-requisitos.
- **`HABLA_AGENTE_TOKEN no configurada`** → Falta el token. Es el mismo `CRON_SECRET` de Railway.
- **`POST resultado status=401`** → Token incorrecto. Revisá que el `HABLA_AGENTE_TOKEN` matchee exactamente el `CRON_SECRET` de Railway.
- **`launchPersistentContext falló — ProcessSingleton`** → Tenés Chrome abierto. Cerralo todo: `taskkill /F /IM chrome.exe`.
- **El agente dice "0 jobs" siempre** → Verificá que (a) el admin haya activado Filtro 1 sobre algún partido, (b) la cola BullMQ en Railway tenga jobs encolados (`/admin/motor-cuotas` muestra el estado).
- **El navegador no se abre** → El script chequea rutas comunes de Chrome. Si tenés Chrome en otra ruta, setear `LOCAL_CHROME_PATH=...`.
- **Una casa específica falla con 403** → Esa casa bloquea hasta tu IP. Probablemente Cloudflare. No es bug del agente, es WAF cambiando reglas. Apuesta Total / Te Apuesto suelen ser estables; Betano / Inkabet a veces tienen rachas restrictivas.

## Limpieza

Para borrar el perfil aislado (no el real de Chrome):

```powershell
Remove-Item -Recurse -Force "$env:USERPROFILE\.habla-agente-data"
```

NO borres `~\AppData\Local\Google\Chrome\User Data\Default` — ese es tu Chrome real.

## Detalles técnicos

- El agente reusa el código de los 5 scrapers de `apps/web/lib/services/scrapers/` (browser singleton, playwright-runner, parsers, fuzzy-match). Cero duplicación.
- Lanza el browser primero y guarda `globalThis.__pwBrowser`/`__pwContext` ANTES de invocar scrapers — el singleton de `browser.ts`, al verlos seteados, los reusa.
- Stealth plugin (`puppeteer-extra-plugin-stealth`) aplicado vía `chromium.use(...)`.
- Reservación de jobs: el endpoint `proximos` hace `job.changeDelay(5min)` por cada job entregado. Si el agente crashea sin postar resultado, el job vuelve a `waiting` solo en 5min.
- Token-based auth: el agente envía Bearer `CRON_SECRET` en cada request. Ese mismo token autoriza el `/api/v1/admin/agente/*` en el backend.
