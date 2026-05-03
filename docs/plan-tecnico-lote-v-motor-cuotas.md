# Plan Técnico Lote V — Motor de captura de cuotas

> **Branch:** `feat/lote-v-motor-cuotas`
> **Última edición:** 3 mayo 2026
> **Estado:** listo para ejecución
> **Predecesor:** Lote U (pulido funcional pre-lanzamiento)
> **Sucesor:** Lote W (motor de análisis 1×/día con Haiku)

---

## Índice

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Decisiones cerradas](#2-decisiones-cerradas)
3. [Modelo de datos](#3-modelo-de-datos)
4. [Arquitectura general](#4-arquitectura-general)
5. [Discovery de event IDs](#5-discovery-de-event-ids)
6. [Implementación de los scrapers](#6-implementación-de-los-scrapers)
7. [Worker y orquestación](#7-worker-y-orquestación)
8. [Detección de cambios y alertas](#8-detección-de-cambios-y-alertas)
9. [Vista admin](#9-vista-admin)
10. [Adaptación de CuotasComparator](#10-adaptación-de-cuotascomparator)
11. [Configuración](#11-configuración)
12. [Dependencias nuevas](#12-dependencias-nuevas)
13. [Plan de ejecución por fases](#13-plan-de-ejecución-por-fases)
14. [Criterios de cierre](#14-criterios-de-cierre)
15. [Riesgos y mitigaciones](#15-riesgos-y-mitigaciones)
16. [Costos operativos](#16-costos-operativos)

---

## 1. Resumen ejecutivo

Sustituir el sistema actual de odds (api-football limitado a 4 casas globales y ventana 24h) por un motor event-driven que captura cuotas reales de las 7 casas peruanas que representan el 86% del tráfico, validadas empíricamente en el POC del 03/05/2026 (ver `docs/poc-melgar-vs-utc-2026-05-03.md`).

**Casas cubiertas (7):** Stake, Apuesta Total, Coolbet, Doradobet, Betano, Inkabet, Te Apuesto.

**Mercados capturados (4):** 1X2, Doble Oportunidad, Total ±2.5 goles, Ambos Equipos Anotan (BTTS).

**Refresh:** 1×/día por partido con Filtro 1 activo.

**Costo recurrente de terceros:** US$ 0.

**Implementación:** 5 scrapers (Apuesta Total y Doradobet comparten backend Altenar), discovery automático de IDs externos con fallback manual, worker integrado en proceso Next.js con BullMQ + Redis, vista admin completa.

---

## 2. Decisiones cerradas

| # | Decisión | Valor |
|---|---|---|
| 1 | Smoke test de geolocation desde Railway | No, procedemos directo |
| 2 | Discovery de event IDs | Automático con fallback manual (Opción A+B) |
| 3 | Bet365 | Fuera del scope |
| 4 | Histórico de snapshots | No. Solo `cuota` actual + `cuotaAnterior` para detectar cambios |
| 5 | Frecuencia de refresh | 1×/día por partido con Filtro 1 ON |
| 6 | Stack | Lo más simple: Node integrado + BullMQ + Redis (todo ya en producción) |
| 7 | Betano | Se queda sí o sí. Scraper con fallback Playwright si la API no rinde |
| 8 | Refresh acelerado al kickoff | No en V1 |

---

## 3. Modelo de datos

### 3.1. Tabla `CuotasCasa`

Migración Prisma aditiva con `--create-only`.

```prisma
model CuotasCasa {
  id              String   @id @default(cuid())
  partidoId       String
  partido         Partido  @relation(fields: [partidoId], references: [id], onDelete: Cascade)

  casa            String   // "stake" | "apuesta_total" | "coolbet" | "doradobet" | "betano" | "inkabet" | "te_apuesto"
  eventIdExterno  String   // ID del partido en la casa (alfanumérico para Inkabet)

  // === MERCADO 1: 1X2 ===
  cuotaLocal              Decimal? @db.Decimal(7, 3)
  cuotaLocalAnterior      Decimal? @db.Decimal(7, 3)
  cuotaEmpate             Decimal? @db.Decimal(7, 3)
  cuotaEmpateAnterior     Decimal? @db.Decimal(7, 3)
  cuotaVisita             Decimal? @db.Decimal(7, 3)
  cuotaVisitaAnterior     Decimal? @db.Decimal(7, 3)

  // === MERCADO 2: Doble Oportunidad ===
  cuota1X                 Decimal? @db.Decimal(7, 3)
  cuota1XAnterior         Decimal? @db.Decimal(7, 3)
  cuota12                 Decimal? @db.Decimal(7, 3)
  cuota12Anterior         Decimal? @db.Decimal(7, 3)
  cuotaX2                 Decimal? @db.Decimal(7, 3)
  cuotaX2Anterior         Decimal? @db.Decimal(7, 3)

  // === MERCADO 3: Total ±2.5 goles ===
  cuotaOver25             Decimal? @db.Decimal(7, 3)
  cuotaOver25Anterior     Decimal? @db.Decimal(7, 3)
  cuotaUnder25            Decimal? @db.Decimal(7, 3)
  cuotaUnder25Anterior    Decimal? @db.Decimal(7, 3)

  // === MERCADO 4: BTTS ===
  cuotaBttsSi             Decimal? @db.Decimal(7, 3)
  cuotaBttsSiAnterior     Decimal? @db.Decimal(7, 3)
  cuotaBttsNo             Decimal? @db.Decimal(7, 3)
  cuotaBttsNoAnterior     Decimal? @db.Decimal(7, 3)

  // === Estado y trazabilidad ===
  estado                  String   // "OK" | "STALE" | "ERROR" | "BLOQUEADO" | "SIN_DATOS"
  ultimoIntento           DateTime
  ultimoExito             DateTime?
  errorMensaje            String?
  intentosFallidos        Int      @default(0)

  capturadoEn             DateTime @default(now())

  @@unique([partidoId, casa])
  @@index([partidoId])
  @@index([casa, estado])
}
```

### 3.2. Columnas nuevas en `Partido`

```prisma
model Partido {
  // ... campos existentes ...
  estadoCaptura       String   @default("INACTIVA")
  // "INACTIVA" | "INICIANDO" | "PARCIAL" | "COMPLETA" | "DETENIDA" | "FALLIDA"

  ultimaCapturaEn     DateTime?

  cuotasCasa          CuotasCasa[]
  eventIdsExternos    EventIdExterno[]
}
```

### 3.3. Tabla `EventIdExterno`

```prisma
model EventIdExterno {
  id              String   @id @default(cuid())
  partidoId       String
  partido         Partido  @relation(fields: [partidoId], references: [id], onDelete: Cascade)

  casa            String
  eventIdExterno  String

  metodoDiscovery String   // "AUTOMATICO" | "MANUAL"
  resueltoPor     String?  // userId si fue manual
  resueltoEn      DateTime @default(now())

  @@unique([partidoId, casa])
  @@index([partidoId])
}
```

### 3.4. Tabla `AliasEquipo`

```prisma
model AliasEquipo {
  id              String   @id @default(cuid())
  alias           String
  casa            String?  // null = aplica a todas las casas
  equipoCanonicoId String
  equipoCanonico  Equipo   @relation(fields: [equipoCanonicoId], references: [id])

  @@unique([alias, casa])
  @@index([alias])
}
```

Seed inicial con los 18 equipos de Liga 1 + aliases conocidos del POC.

### 3.5. Tabla `AlertaCuota`

```prisma
model AlertaCuota {
  id              String   @id @default(cuid())
  partidoId       String
  partido         Partido  @relation(fields: [partidoId], references: [id], onDelete: Cascade)

  casa            String
  mercado         String   // "1X2" | "DOBLE_OP" | "MAS_MENOS_25" | "BTTS"
  seleccion       String   // "local" | "empate" | "visita" | "1x" | "12" | "x2" | "over25" | "under25" | "btts_si" | "btts_no"

  cuotaAnterior   Decimal  @db.Decimal(7, 3)
  cuotaNueva      Decimal  @db.Decimal(7, 3)
  variacionPct    Decimal  @db.Decimal(7, 3)

  vistaPorAdmin   Boolean  @default(false)
  detectadoEn     DateTime @default(now())

  @@index([partidoId, vistaPorAdmin])
  @@index([detectadoEn])
}
```

### 3.6. Tabla `SaludScraper`

```prisma
model SaludScraper {
  id                    String   @id @default(cuid())
  casa                  String   @unique
  estado                String   // "SANO" | "DEGRADADO" | "BLOQUEADO"
  ultimaEjecucion       DateTime?
  ultimoExito           DateTime?
  diasConsecutivosError Int      @default(0)
  detalleError          String?

  actualizadoEn         DateTime @updatedAt
}
```

Seed con las 7 casas en estado `SANO`.

---

## 4. Arquitectura general

### 4.1. Trigger desde admin

Cuando admin marca Filtro 1 = true en un partido:

1. Endpoint `PATCH /api/v1/admin/partidos/[id]/filtro-1` recibe la mutación.
2. El handler ejecuta:
   - Update `Partido.filtro1 = true` y `Partido.estadoCaptura = "INICIANDO"`.
   - Llama a `capturaCuotasService.iniciar(partidoId)`.
3. El servicio:
   - Resuelve discovery automático de event IDs para las 7 casas (sección 5).
   - Encola 7 jobs en BullMQ (uno por casa).
   - Responde 200 al admin con resumen de discovery.

### 4.2. Trigger desde admin: desactivación

Cuando admin marca Filtro 1 = false:

1. Update `Partido.filtro1 = false` y `Partido.estadoCaptura = "DETENIDA"`.
2. Cancela jobs pendientes para ese partido en BullMQ.
3. **Conserva** los registros `CuotasCasa` (no se borran).

### 4.3. Cron diario de refresh

`Job O — refresh-cuotas-diario` se agrega a `instrumentation.ts` con frecuencia 24h, primera ejecución 5am Lima.

```ts
async function refrescarCuotasDelDia() {
  const partidos = await prisma.partido.findMany({
    where: {
      filtro1: true,
      estado: "PROGRAMADO",
      fechaInicio: { gte: new Date() },
    },
  });

  for (const partido of partidos) {
    await capturaCuotasService.encolarRefresh(partido.id);
  }
}
```

Encolar los 7 jobs por partido para reejecutar la captura. Si una casa devolvió OK hace <22h, el job hace skip silencioso (margen para evitar duplicación).

---

## 5. Discovery de event IDs

### 5.1. Discovery automático

Cada scraper expone `buscarEventIdExterno(partido)`. Estrategia:

1. Llamar al endpoint público de búsqueda/listado de la casa filtrando por liga + fecha (±24h).
2. Recorrer resultados y matchear nombres de equipos contra `AliasEquipo`.
3. Si encuentra match exacto único → guarda en `EventIdExterno` con `metodoDiscovery = "AUTOMATICO"`.
4. Si match ambiguo o cero matches → no guarda, retorna null. La casa queda pendiente de vinculación manual.

### 5.2. Discovery manual (fallback)

En la vista admin del partido, sección "Captura de cuotas", aparece para cada casa sin event ID resuelto:

- Botón **"Vincular manualmente"**.
- Modal con input grande para pegar URL del partido en la casa.
- Click "Vincular y capturar" → backend extrae el ID con regex específico, valida con un fetch, y guarda en `EventIdExterno` con `metodoDiscovery = "MANUAL"`.

Patrones de extracción por casa:

| Casa | Regex |
|---|---|
| Stake | `/event/(\d+)` |
| Apuesta Total | `/(\d{15,})$` |
| Coolbet | `/match/(\d+)` |
| Doradobet | `/partido/(\d+)` |
| Betano | `/(\d{6,})/?$` |
| Inkabet | `eventId=([\w-]+)` |
| Te Apuesto | URL del torneo, no del partido — lee del JSON del torneo y guarda el index del partido |

### 5.3. Re-discovery

Después de cada vinculación manual, el sistema dispara un job de captura inmediata para esa casa específica.

---

## 6. Implementación de los scrapers

Ubicación: `apps/web/lib/services/scrapers/`.

### 6.1. Interfaz uniforme

```ts
// apps/web/lib/services/scrapers/types.ts
export interface CuotasCapturadas {
  "1x2"?:           { local: number; empate: number; visita: number };
  "doble_op"?:      { x1: number; x12: number; xx2: number };
  "mas_menos_25"?:  { over: number; under: number };
  "btts"?:          { si: number; no: number };
}

export interface ResultadoScraper {
  cuotas: CuotasCapturadas;
  fuente: { url: string; capturadoEn: Date };
}

export interface Scraper {
  nombre: string;
  buscarEventIdExterno(partido: Partido): Promise<string | null>;
  capturarCuotas(eventIdExterno: string): Promise<ResultadoScraper>;
}
```

### 6.2. Scraper Te Apuesto (más simple)

**Archivo:** `te-apuesto.scraper.ts`
**Endpoint:** `https://api.teapuesto.pe/api/v4/nfs/matches-of-the-day`

Una request devuelve TODOS los partidos del torneo con sus 4 mercados.

1. Ejecuta GET con headers User-Agent normal.
2. Parsea JSON, filtra el partido por nombres de equipos (con `AliasEquipo`) y fecha ±60 min.
3. Mapea cuotas:
   - `1X2` → outcome IDs `home`, `draw`, `away`.
   - Doble Op → `1X`, `12`, `X2`.
   - BTTS → `yes`, `no`.
   - Total → línea 2.5 con `over` y `under`.

**Discovery:** un solo fetch a `top-tournaments` da ID interno de Liga 1. Luego `matches-of-the-day?tournament_id=...` lista los partidos. Match por nombre + fecha.

### 6.3. Scraper Stake

**Archivo:** `stake.scraper.ts`
**Endpoint:** `https://pre-143o-sp.websbkt.com/cache/143/es/pe/{eventId}/single-pre-event.json`

Request directa al cache CDN. Devuelve estructura `{ info, odds, filters }`.

Mapeo de mercados via `union_id`:
- `20001` = 1X2 (códigos `ODD_S1`, `ODD_SX`, `ODD_S2`)
- `20002` = Doble Op (`ODD_D1X`, `ODD_D12`, `ODD_DX2`)
- `20201` con `additional_value=2.5` = ±2.5 goles (`ODD_TTL_1_OVR`, `ODD_TTL_1_UND`)
- `21301` = BTTS (`ODD_FTB_BOTHTEAMSSCORE_YES/NO`)

**Discovery:** endpoint de búsqueda de stake.pe permite buscar por nombre de equipo. Match por nombre + fecha.

### 6.4. Scraper Altenar (Apuesta Total + Doradobet)

**Archivo:** `altenar.scraper.ts`
**Endpoints:**
- Apuesta Total: `https://prod20392.kmianko.com/api/eventpage/events/{eventId}`
- Doradobet: `https://sb2integration-altenar2.biahosted.com/api/Widget/...`

Configuración por operador:

```ts
const altenarConfig = {
  apuesta_total: {
    base: "https://prod20392.kmianko.com",
    eventEndpoint: "/api/eventpage/events/{id}",
    discoveryEndpoint: "/api/sportsbookv2/sports/...",
  },
  doradobet: {
    base: "https://sb2integration-altenar2.biahosted.com",
    eventEndpoint: "/api/Widget/GetEvent?widgetId=...&eventId={id}",
    discoveryEndpoint: "/api/Widget/GetEventList?...",
  },
};

class AltenarScraper {
  constructor(private operador: "apuesta_total" | "doradobet") {}
  // mismo código, distinto config
}
```

**Subdominio dinámico de Apuesta Total:** El subdominio `prod20392` puede cambiar. Detección al primer fetch: si responde 404, leer el HTML de la home para extraer el subdominio actualizado.

### 6.5. Scraper Coolbet

**Archivo:** `coolbet.scraper.ts`
**Endpoint:** `POST https://www.coolbet.pe/s/sb-odds/odds/current/fo` con body `{eventIds: [...]}`

1. Warmup: GET a `https://www.coolbet.pe/` para obtener cookies.
2. POST al endpoint de odds con `eventIds: [eventId]`.
3. Si responde 503 → backoff 5s, reintento. Máx 3 reintentos.
4. Parsear respuesta. **Atención al orden de columnas Doble Op de Coolbet: `1X / X2 / 12`** (no estándar). Mapear por nombre, no por posición.

**Discovery:** endpoint de search `/s/sports/in-play/find` o listado por liga. Match por nombre + fecha.

### 6.6. Scraper Inkabet

**Archivo:** `inkabet.scraper.ts`
**Endpoint:** API del iframe `https://d-cf.inkabetplayground.net/...`

Características especiales:

- Event ID **alfanumérico** (ej. `f-r0f9JVh-c0WyAMylSZtvtA`). El campo `eventIdExterno: TEXT` ya lo cubre.
- Sportsbook completo en iframe propio. La API es accesible directamente por URL.
- Inkabet ofrece "Pago Anticipado" como variante. **El scraper persiste solo la variante regular** para mantener consistencia con las otras casas. Si la regular está suspendida momentáneamente y solo hay Pago Anticipado, marcar `SIN_DATOS` y reintentar en el próximo ciclo.

**Discovery:** endpoint de listado de partidos por liga peruana, devuelto con event IDs alfanuméricos.

### 6.7. Scraper Betano (dual)

**Archivo:** `betano.scraper.ts`
**Endpoint primario:** `https://www.betano.pe/api/...` (a determinar exacto en sesión de reverse engineering)
**Endpoint fallback:** Playwright headless

Estrategia dual:

```ts
async capturarCuotas(eventId: string) {
  // Intento 1: API directa
  try {
    const cuotas = await this.viaAPI(eventId);
    if (cuotasCompletas(cuotas, ["1x2", "doble_op", "mas_menos_25", "btts"])) {
      return cuotas;
    }
  } catch (e) {
    log.warn("Betano API falló, escalando a Playwright", { eventId });
  }

  // Intento 2: Playwright (solo si la API falló o vino incompleta)
  return await this.viaPlaywright(eventId);
}
```

**Implementación viaAPI:** sesión de reverse engineering dedicada con DevTools al inicio de la fase para identificar el endpoint exacto que sirve los 4 mercados de un partido individual.

**Implementación viaPlaywright:** browser headless instalado en Railway (`playwright-chromium`). Una sola instancia warm reutilizable por el worker.

---

## 7. Worker y orquestación

### 7.1. Cola BullMQ

```ts
// apps/web/lib/services/cuotas-cola.ts
import { Queue } from "bullmq";
import { redis } from "@/lib/redis";

export const cuotasCola = new Queue("cuotas-captura", { connection: redis });

interface CuotasJobData {
  partidoId: string;
  casa: string;
  eventIdExterno: string;
  esRefresh: boolean;
}
```

### 7.2. Worker

```ts
// apps/web/lib/services/cuotas-worker.ts
new Worker<CuotasJobData>(
  "cuotas-captura",
  async (job) => {
    const { partidoId, casa, eventIdExterno } = job.data;
    const scraper = scrapers[casa];

    try {
      const resultado = await scraper.capturarCuotas(eventIdExterno);
      await persistirCuotas(partidoId, casa, eventIdExterno, resultado);
      await actualizarSaludScraper(casa, "OK");
    } catch (error) {
      await registrarError(partidoId, casa, error);
      await actualizarSaludScraper(casa, "ERROR");
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 7,
    limiter: { max: 1, duration: 1500 },
  }
);
```

### 7.3. Configuración de reintentos

```ts
await cuotasCola.add("captura", jobData, {
  attempts: 3,
  backoff: { type: "exponential", delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 500,
});
```

### 7.4. Recovery al boot

`instrumentation.ts` ejecuta al startup:

```ts
async function recuperarJobsHuerfanos() {
  const partidos = await prisma.partido.findMany({
    where: {
      filtro1: true,
      cuotasCasa: { some: { ultimoIntento: { lt: hace25horas } } },
    },
  });
  for (const p of partidos) await capturaCuotasService.encolarRefresh(p.id);
}
```

---

## 8. Detección de cambios y alertas

### 8.1. Lógica de comparación

Al persistir nuevas cuotas:

```ts
async function persistirCuotas(partidoId, casa, eventId, resultado) {
  const anterior = await prisma.cuotasCasa.findUnique({
    where: { partidoId_casa: { partidoId, casa } },
  });

  const nuevas = mapearACuotasCasa(resultado);
  const alertas = detectarAlertas(anterior, nuevas, partidoId, casa);

  await prisma.cuotasCasa.upsert({
    where: { partidoId_casa: { partidoId, casa } },
    create: {
      partidoId, casa, eventIdExterno: eventId,
      ...nuevas,
      estado: "OK",
      ultimoIntento: new Date(),
      ultimoExito: new Date(),
    },
    update: {
      cuotaLocalAnterior: anterior?.cuotaLocal,
      cuotaEmpateAnterior: anterior?.cuotaEmpate,
      // ... idem para todos los campos
      ...nuevas,
      estado: "OK",
      ultimoIntento: new Date(),
      ultimoExito: new Date(),
      capturadoEn: new Date(),
      intentosFallidos: 0,
    },
  });

  if (alertas.length > 0) {
    await prisma.alertaCuota.createMany({ data: alertas });
  }
}
```

### 8.2. Umbral de variación

`apps/web/lib/config/cuotas.ts`:

```ts
export const UMBRAL_VARIACION_ALERTA_PCT = 5;
```

Solo se generan alertas cuando |variación| ≥ 5%.

### 8.3. Función `detectarAlertas`

```ts
function detectarAlertas(anterior, nuevas, partidoId, casa) {
  if (!anterior) return [];

  const alertas = [];
  const camposAComparar = [
    { field: "cuotaLocal", mercado: "1X2", seleccion: "local" },
    { field: "cuotaEmpate", mercado: "1X2", seleccion: "empate" },
    { field: "cuotaVisita", mercado: "1X2", seleccion: "visita" },
    { field: "cuota1X", mercado: "DOBLE_OP", seleccion: "1x" },
    { field: "cuota12", mercado: "DOBLE_OP", seleccion: "12" },
    { field: "cuotaX2", mercado: "DOBLE_OP", seleccion: "x2" },
    { field: "cuotaOver25", mercado: "MAS_MENOS_25", seleccion: "over25" },
    { field: "cuotaUnder25", mercado: "MAS_MENOS_25", seleccion: "under25" },
    { field: "cuotaBttsSi", mercado: "BTTS", seleccion: "btts_si" },
    { field: "cuotaBttsNo", mercado: "BTTS", seleccion: "btts_no" },
  ];

  for (const { field, mercado, seleccion } of camposAComparar) {
    const ant = anterior[field];
    const nuevo = nuevas[field];
    if (!ant || !nuevo) continue;

    const variacionPct = ((Number(nuevo) - Number(ant)) / Number(ant)) * 100;
    if (Math.abs(variacionPct) >= UMBRAL_VARIACION_ALERTA_PCT) {
      alertas.push({
        partidoId, casa, mercado, seleccion,
        cuotaAnterior: ant,
        cuotaNueva: nuevo,
        variacionPct,
      });
    }
  }

  return alertas;
}
```

---

## 9. Vista admin

### 9.1. Sección "Captura de cuotas" en `/admin/partidos/[id]`

Para cada partido con Filtro 1 ON:

```
═══════════════════════════════════════════════════════════
 CAPTURA DE CUOTAS
 Estado: 🟢 COMPLETA (7/7 casas) · Última actualización: hace 4h
 [Forzar refresh ahora] [Ver alertas (3)]
═══════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────┐
│ STAKE              🟢 OK · hace 4h               [↻]     │
│ Local 1.46 (=) · Emp 4.30 (↑3%) · Vis 6.75 (=)          │
│ 1X 1.11 · 12 1.22 · X2 2.65                              │
│ Over 1.77 · Under 2.05                                   │
│ BTTS Sí 1.95 · No 1.80                                   │
│ Event ID externo: 25792580 [auto] [editar]               │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ INKABET            ⚠️ STALE · último éxito hace 26h [↻]  │
│ (mostrando última captura exitosa)                       │
│ Local 1.46 · Emp 4.25 · Vis 6.50                         │
│ Event ID externo: f-r0f9JVh-c0WyAMylSZtvtA               │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ BETANO             🔴 ERROR · 2 intentos fallidos  [↻]   │
│ Error: "Connection timeout"                              │
│ Sin event ID externo asignado [vincular manualmente]     │
└─────────────────────────────────────────────────────────┘
```

Detalle de cada bloque:

- **Header de casa:** nombre + estado (color) + tiempo desde última captura + botón ↻ para forzar refresh individual.
- **Cuotas por mercado:** las 10 cuotas con indicador de variación si aplica (`(=)`, `(↑X%)`, `(↓X%)`).
- **Event ID externo:** valor + método (`auto` o `manual`) + botón "editar".

### 9.2. Modal "Vincular manualmente"

```
╔════════════════════════════════════════╗
║ Vincular Inkabet manualmente            ║
║                                         ║
║ Pega el URL del partido en Inkabet:     ║
║ ┌─────────────────────────────────────┐ ║
║ │                                     │ ║
║ └─────────────────────────────────────┘ ║
║                                         ║
║ [Cancelar]    [Vincular y capturar]    ║
╚════════════════════════════════════════╝
```

Click "Vincular y capturar":
1. Backend extrae el ID con regex de la casa.
2. Si la regex no matchea → error inline.
3. Guarda en `EventIdExterno` con `metodoDiscovery = "MANUAL"`.
4. Encola job de captura inmediato para esa casa.
5. Cierra modal y refresca la sección.

### 9.3. Sección "Alertas de cambios"

Click "Ver alertas" abre panel lateral o expansible:

```
═══════════════════════════════════════════════════════════
 ALERTAS DE CAMBIOS DE CUOTA
 Filtro: ☐ Solo no vistas
═══════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────┐
│ ↑ STAKE · 1X2 · Empate                                  │
│ 4.20 → 4.30 (+2.4%)                                     │
│ Detectado: hace 4h                          [marcar visto] │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ ↓ TE APUESTO · BTTS · Sí                                │
│ 2.05 → 1.92 (-6.3%)                                     │
│ Detectado: hace 4h                          [marcar visto] │
└─────────────────────────────────────────────────────────┘
```

Botón "Marcar todo como visto" arriba.

### 9.4. Dashboard `/admin/motor-cuotas`

**Salud de scrapers (tabla):**

| Casa | Estado | Última ejecución | Último éxito | Días con error consecutivos |
|---|---|---|---|---|
| Stake | 🟢 SANO | hace 5h | hace 5h | 0 |
| Apuesta Total | 🟢 SANO | hace 5h | hace 5h | 0 |
| Coolbet | 🟢 SANO | hace 5h | hace 5h | 0 |
| Doradobet | 🟡 DEGRADADO | hace 5h | hace 1 día | 1 |
| Betano | 🔴 BLOQUEADO | hace 5h | hace 4 días | 4 |
| Inkabet | 🟢 SANO | hace 5h | hace 5h | 0 |
| Te Apuesto | 🟢 SANO | hace 5h | hace 5h | 0 |

**Métricas globales (cards):**

- Partidos con Filtro 1 activo
- Partidos COMPLETA / PARCIAL / FALLIDA
- Total cuotas vivas vs esperadas (cobertura %)
- Alertas no vistas

**Cola BullMQ:**

- En cola
- En proceso
- Última corrida del cron

**Acciones globales:**

- **[Forzar refresh global]** — encola los 7 scrapers para todos los partidos con Filtro 1 ON.
- **[Reactivar scraper bloqueado]** — para cuando admin sabe que la casa volvió a operar.

### 9.5. Endpoints admin

```
GET    /api/v1/admin/partidos/[id]/cuotas              → estado completo
POST   /api/v1/admin/partidos/[id]/cuotas/refresh      → forzar refresh
POST   /api/v1/admin/partidos/[id]/cuotas/refresh-casa → refresh 1 casa
PATCH  /api/v1/admin/partidos/[id]/event-ids           → vincular ID manual
GET    /api/v1/admin/motor-cuotas/salud                → estado scrapers
GET    /api/v1/admin/motor-cuotas/alertas              → lista alertas
PATCH  /api/v1/admin/motor-cuotas/alertas/[id]         → marcar visto
POST   /api/v1/admin/motor-cuotas/refresh-global       → encolar todos
POST   /api/v1/admin/motor-cuotas/scrapers/[casa]/reactivar → quitar bloqueo
```

Todos protegidos por `requireAdmin()` y auditados en `LogAuditoria`.

---

## 10. Adaptación de CuotasComparator

```tsx
// apps/web/components/CuotasComparator.tsx
const cuotas = await prisma.cuotasCasa.findMany({
  where: { partidoId, estado: { in: ["OK", "STALE"] } },
});

// Renderiza:
// - Para cada mercado, las 7 cuotas + badge de "mejor cuota"
// - Si estado=STALE, badge gris "datos desactualizados"
// - CTA por casa link al endpoint /go/[casa] (existente)
```

Sin cambios en Redis. Lectura directa de Postgres con tabla `CuotasCasa` indexada por `partidoId`.

---

## 11. Configuración

`apps/web/lib/config/cuotas.ts`:

```ts
export const CUOTAS_CONFIG = {
  CASAS: ["stake", "apuesta_total", "coolbet", "doradobet", "betano", "inkabet", "te_apuesto"] as const,

  REFRESH_INTERVAL_HORAS: 24,
  REFRESH_HORA_LIMA: 5,

  UMBRAL_VARIACION_ALERTA_PCT: 5,
  STALE_DESPUES_DE_HORAS: 26,
  BLOQUEADO_TRAS_DIAS_ERROR: 3,

  CONCURRENCIA_BULLMQ: 7,
  RATE_LIMIT_POR_WORKER_MS: 1500,

  REINTENTOS_POR_JOB: 3,
  BACKOFF_INICIAL_MS: 2000,
} as const;
```

Variables de entorno nuevas en Railway:

```
PLAYWRIGHT_HEADLESS=true
ALERTAS_CUOTAS_EMAIL_ADMIN=admin@hablaplay.com
```

Sin API keys externos.

---

## 12. Dependencias nuevas

```json
"bullmq": "^5.x",
"playwright-chromium": "^1.x"
```

---

## 13. Plan de ejecución por fases

El lote se divide en **5 fases ejecutables independientes** (V.1 a V.5). Cada fase tiene su propio prompt de Claude Code, pero comparten el mismo prompt general parametrizable (ver `docs/prompt-general-claude-code.md`).

Cada fase debe terminar con:
- `pnpm tsc --noEmit` y `pnpm lint` verdes.
- Push a la branch `feat/lote-v-motor-cuotas`.
- Reporte post-fase en `docs/reportes-fases/lote-v-fase-X.md`.

### Fase V.1 — Schema, tipos y BullMQ base

**Objetivo:** dejar listo todo el andamiaje sin scrapers funcionales.

Subtareas:
- Migración Prisma con las 5 tablas nuevas (`CuotasCasa`, `EventIdExterno`, `AliasEquipo`, `AlertaCuota`, `SaludScraper`) + columnas en `Partido` (`estadoCaptura`, `ultimaCapturaEn`).
- Tipos compartidos en `apps/web/lib/services/scrapers/types.ts`.
- Configuración en `apps/web/lib/config/cuotas.ts`.
- Setup BullMQ en `apps/web/lib/services/cuotas-cola.ts` y worker base sin scrapers en `apps/web/lib/services/cuotas-worker.ts`.
- Servicio orquestador `apps/web/lib/services/captura-cuotas.service.ts` con `iniciar()`, `encolarRefresh()`, `detener()`.
- Función `detectarAlertas` y `persistirCuotas` con la lógica completa de la sección 8.
- Seed de `AliasEquipo` para los 18 equipos de Liga 1.
- Seed de `SaludScraper` para las 7 casas en estado SANO.
- Cron `Job O — refresh-cuotas-diario` agregado a `instrumentation.ts`.
- Recovery al boot de jobs huérfanos.

Cierre: el código compila, el cron está registrado pero nunca encuentra trabajo porque ningún partido tiene captura activa todavía. Las 7 casas existen en `SaludScraper` pero ningún scraper está implementado.

### Fase V.2 — Scrapers fáciles

**Objetivo:** primera evidencia funcional con las 3 casas más simples.

Subtareas:
- Scraper Te Apuesto (`te-apuesto.scraper.ts`) — el más fácil, sirve para validar el pipeline end-to-end.
- Scraper Stake (`stake.scraper.ts`).
- Scraper Altenar (`altenar.scraper.ts`) con configuración dual para Apuesta Total y Doradobet.
- Registro de los 3 (que en realidad son 4 casas) en el dispatcher de scrapers del worker.
- Endpoint `POST /api/v1/admin/partidos/[id]/cuotas/refresh-casa` para probar individualmente.

Cierre: activar Filtro 1 en un partido de Liga 1 y ver que Te Apuesto + Stake + Apuesta Total + Doradobet capturan cuotas correctamente. La función `detectarAlertas` ya está cargada desde V.1, así que el segundo refresh debería generar alertas si hubo cambios.

### Fase V.3 — Scrapers medianos

**Objetivo:** completar las casas con dificultad técnica intermedia.

Subtareas:
- Scraper Coolbet (`coolbet.scraper.ts`) — POST con cookies, manejo de 503, orden de columnas no estándar en Doble Op.
- Scraper Inkabet (`inkabet.scraper.ts`) — iframe, IDs alfanuméricos, manejo de "Pago Anticipado" (persistir solo regular, marcar `SIN_DATOS` si está suspendida).
- Registro de ambos en el dispatcher.

Cierre: 6 de las 7 casas funcionando. Falta solo Betano.

### Fase V.4 — Scraper Betano dual

**Objetivo:** la casa más compleja, con doble estrategia.

Subtareas:
- **Sesión inicial de reverse engineering** con DevTools en Chrome: identificar el endpoint exacto que sirve los 4 mercados de un partido individual de Betano. El POC dejó identificados endpoints generales pero no el específico.
- Implementación de `viaAPI()` en `betano.scraper.ts`.
- Setup de `playwright-chromium` en Railway (`package.json` + dockerfile si aplica).
- Implementación de `viaPlaywright()` con browser warm reutilizable y `page.click()` real (no `el.click()` programático).
- Lógica de fallback: intenta API primero, escala a Playwright si falla o devuelve incompleto.
- Validación de memoria del proceso post-deploy.

Cierre: las 7 casas funcionando. El motor está completo a nivel de captura.

### Fase V.5 — Discovery, vista admin y cierre del lote

**Objetivo:** hacer todo gestionable desde admin y cerrar el lote.

Subtareas:
- Discovery automático para las 7 casas (cada scraper expone `buscarEventIdExterno`).
- Endpoint `PATCH /api/v1/admin/partidos/[id]/event-ids` y modal "Vincular manualmente" con regex por casa.
- Sección "Captura de cuotas" en `/admin/partidos/[id]` con bloques por casa, indicadores de variación, botones de refresh individual.
- Sección "Alertas de cambios" con filtro de no vistas y endpoint para marcar vistas.
- Dashboard `/admin/motor-cuotas` con tabla de salud, cards de métricas, estado de cola BullMQ y acciones globales.
- Endpoints admin restantes (sección 9.5).
- Adaptación de `<CuotasComparator>` a leer de `CuotasCasa` directamente.
- QA con 5-10 partidos reales activando Filtro 1.
- Tabla `AliasEquipo` se completa con casos no resueltos del QA.
- Reporte post-lote en `docs/reportes-fases/lote-v-fase-5.md` con cobertura final por casa.

Cierre: el comparador en producción muestra cuotas reales de 7 casas peruanas. El admin puede ver, refrescar y vincular IDs manualmente. Las alertas de variación quedan registradas. Push a main y merge.

---

## 14. Criterios de cierre

- [ ] Migración Prisma aplicada (CuotasCasa, EventIdExterno, AliasEquipo, AlertaCuota, SaludScraper).
- [ ] 5 scrapers implementados (`stake`, `altenar`, `coolbet`, `betano`, `inkabet`, `te-apuesto`).
- [ ] Worker BullMQ funcionando con concurrencia y rate limit.
- [ ] Cron diario refrescando partidos con Filtro 1 ON.
- [ ] Discovery automático para Liga 1 funcional.
- [ ] Modal de vinculación manual funcionando para las 7 casas.
- [ ] Sección admin de captura por partido con todos los elementos.
- [ ] Dashboard `/admin/motor-cuotas` con salud y métricas.
- [ ] Detección de variaciones ≥5% generando alertas.
- [ ] `<CuotasComparator>` leyendo de tabla nueva.
- [ ] `pnpm tsc --noEmit` pasa.
- [ ] `pnpm lint` pasa.
- [ ] Smoke test con 5 partidos reales: ≥70% de las casas devuelven OK.
- [ ] Push a main + reporte post-lote.

---

## 15. Riesgos y mitigaciones

| # | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| 1 | IP de Railway bloqueada por casa peruana | Media | Alto | Si se detecta en QA, usar proxy residencial. No invertir antes de evidencia. |
| 2 | Casa cambia su API silenciosamente | Media (cada 6-12 meses) | Medio | Health check + alertas. Reescribir scraper afectado (~2-4h). |
| 3 | Discovery automático con baja precisión en ligas no-peruanas | Alta | Medio | Fallback manual cubre. Liga 1 prioritaria. |
| 4 | Playwright en Railway consume mucha memoria | Media | Medio | Browser warm reutilizable. Si memory limit cruzado, migrar Betano a worker dedicado. |
| 5 | Inkabet "Pago Anticipado" confunde la lógica | Baja | Bajo | Documentado: persistir solo regular. Si suspendida, marcar SIN_DATOS. |
| 6 | Aliases insuficientes en primera vuelta | Alta (semana 1) | Medio | Tabla AliasEquipo crece con uso. QA del Día 8 captura los faltantes. |
| 7 | BullMQ pierde jobs por restart de Railway | Baja | Bajo | Recovery al boot ya planificado. |

---

## 16. Costos operativos

| Concepto | Costo mensual |
|---|---|
| api-football PRO (existente, solo fixtures) | US$ 19 |
| **Cuotas (Lote V)** | **US$ 0** |
| Playwright en Railway | US$ 0 |
| Total adicional por Lote V | **US$ 0** |

---

*— Fin del Plan Técnico Lote V —*
