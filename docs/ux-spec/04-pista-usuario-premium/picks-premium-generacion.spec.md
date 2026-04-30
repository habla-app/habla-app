# Picks Premium — Generación y aprobación (Lote E)

Spec del flujo de generación, aprobación y publicación de picks Premium. La generación usa **Claude API (Anthropic)** para producir borradores con razonamiento estadístico. Cada borrador pasa por aprobación humana del editor antes de ir al WhatsApp Channel.

## Lote responsable

**Lote E** — Premium backend automatización.

## Estado actual del repo

- `apps/web/lib/services/odds-cache.service.ts` (Lote 9): cuotas en cache.
- `apps/web/lib/services/partidos.service.ts`: lectura de partidos.
- Sin modelo `PickPremium`. Sin generador. Sin admin para aprobar.

## Cambios necesarios

### 1. Migración Prisma — modelo PickPremium

Agregar a `schema.prisma`:

```prisma
// ==========================================
// PICKS PREMIUM (Lote E · Mayo 2026)
// ==========================================

model PickPremium {
  id              String    @id @default(cuid())
  partidoId       String
  partido         Partido   @relation(fields: [partidoId], references: [id])

  // Mercado y recomendación
  mercado         MercadoPick    // RESULTADO_1X2 | BTTS | OVER_UNDER_25 | TARJETA_ROJA | MARCADOR_EXACTO
  outcome         String         // 'home' | 'btts_si' | 'over' | etc
  cuotaSugerida   Float          // 1.85
  stakeSugerido   Float          // 0.03 (3% del bankroll)
  evPctSugerido   Float?         // 0.14 (14% EV+)

  // Casa con mejor cuota
  casaRecomendadaId  String?
  casaRecomendada    Afiliado? @relation(fields: [casaRecomendadaId], references: [id])

  // Razonamiento (texto libre, generado por Claude API)
  razonamiento    String   @db.Text   // Análisis estadístico ~150 palabras
  estadisticas    Json?              // Datos H2H estructurados

  // Fuente
  generadoPor     FuentePick    // CLAUDE_API | EDITOR_MANUAL
  generadoEn      DateTime  @default(now())

  // Aprobación
  estado          EstadoPick @default(PENDIENTE)  // PENDIENTE | APROBADO | RECHAZADO | EDITADO_Y_APROBADO
  aprobado        Boolean    @default(false)      // Atajo para queries
  aprobadoPor     String?                          // userId del editor
  aprobadoEn      DateTime?
  rechazadoMotivo String?                          // Si rechazado

  // Distribución
  enviadoAlChannel Boolean   @default(false)
  enviadoEn        DateTime?
  channelMessageId String?                         // ID del mensaje en WhatsApp Channel

  // Resultado (post-partido)
  resultadoFinal   ResultadoPick?  // GANADO | PERDIDO | NULO | PUSH
  evaluadoEn       DateTime?

  fechaPublicacion DateTime  @default(now())  // Para ordenamiento

  creadoEn        DateTime  @default(now())
  actualizadoEn   DateTime  @updatedAt

  @@index([partidoId, aprobado])
  @@index([estado, fechaPublicacion])
  @@map("picks_premium")
}

enum MercadoPick {
  RESULTADO_1X2       // 1, X, 2
  BTTS                // Sí, No
  OVER_UNDER_25       // Más, Menos de 2.5 goles
  TARJETA_ROJA        // Sí, No
  MARCADOR_EXACTO     // "2-1"
}

enum FuentePick {
  CLAUDE_API
  EDITOR_MANUAL
}

enum EstadoPick {
  PENDIENTE             // Recién generado, esperando aprobación editor
  APROBADO              // Editor aprobó tal cual
  EDITADO_Y_APROBADO    // Editor editó razonamiento y aprobó
  RECHAZADO             // Editor rechazó (no se envía)
}

enum ResultadoPick {
  GANADO
  PERDIDO
  NULO              // Partido suspendido / cancelado
  PUSH              // Empate en hándicap (devuelve stake)
}
```

### 2. Service de generación con Claude API

`apps/web/lib/services/picks-premium-generador.service.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@habla/db';
import { obtenerOddsCacheadas } from './odds-cache.service';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-7';

export async function generarPicksParaPartido(partidoId: string) {
  // 1. Cargar partido + cuotas + estadísticas H2H
  const partido = await prisma.partido.findUnique({
    where: { id: partidoId },
    include: { /* equipos, liga, etc */ },
  });
  if (!partido) throw new Error('Partido no encontrado');

  const cuotas = await obtenerOddsCacheadas(partidoId);
  if (!cuotas) throw new Error('Cuotas no disponibles para este partido');

  // 2. Cargar estadísticas H2H de los últimos N partidos (api-football)
  const stats = await obtenerEstadisticasPartido(partidoId);

  // 3. Construir prompt para Claude con todo el contexto
  const prompt = construirPromptPicks(partido, cuotas, stats);

  // 4. Llamar Claude API
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,  // ver abajo
    messages: [{ role: 'user', content: prompt }],
  });

  // 5. Parsear response (Claude devuelve JSON estructurado)
  const picks = parseClaudeResponse(message.content);

  // 6. Para cada pick, crear fila PickPremium en estado PENDIENTE
  const created = await Promise.all(
    picks.map((pick) =>
      prisma.pickPremium.create({
        data: {
          partidoId,
          mercado: pick.mercado,
          outcome: pick.outcome,
          cuotaSugerida: pick.cuotaSugerida,
          stakeSugerido: pick.stakeSugerido,
          evPctSugerido: pick.evPct,
          casaRecomendadaId: pick.casaSlug ? await getAfiliadoIdBySlug(pick.casaSlug) : null,
          razonamiento: pick.razonamiento,
          estadisticas: pick.statsResumen,
          generadoPor: 'CLAUDE_API',
          estado: 'PENDIENTE',
          aprobado: false,
        },
      })
    )
  );

  return created;
}
```

### 3. System prompt para Claude

Vivir en `apps/web/lib/services/picks-premium-prompts.ts`:

```typescript
export const SYSTEM_PROMPT = `Eres un analista experto de apuestas deportivas que asiste al editor de Habla! Picks (Perú).

Tu rol: dado un partido + cuotas comparadas + estadísticas H2H, generar 1-3 recomendaciones (picks) de mercados con valor estadístico (EV+).

REGLAS DURAS:
1. Solo recomienda mercados con EV+ ≥ 5%. Si ningún mercado lo tiene, devuelve array vacío con explicación.
2. Cada pick incluye razonamiento estadístico (~150 palabras) en español neutro, sin jerga excesiva.
3. Stake sugerido: 1-3% del bankroll. Solo recomienda 3% en picks de muy alta confianza.
4. NUNCA recomiendes apuestas en partidos de ligas que no conoces bien (verifica en el contexto).
5. NUNCA garantices ganancias. Habla en términos probabilísticos.
6. Si el partido es entre equipos con datos limitados (<5 partidos H2H, equipos juveniles, etc.), sé MÁS conservador.

FORMATO DE RESPUESTA (JSON):
{
  "picks": [
    {
      "mercado": "RESULTADO_1X2" | "BTTS" | "OVER_UNDER_25" | "TARJETA_ROJA" | "MARCADOR_EXACTO",
      "outcome": "home" | "draw" | "away" | "btts_si" | "btts_no" | "over" | "under" | "roja_si" | "roja_no" | "1-0" | etc,
      "cuotaSugerida": number,
      "casaSlug": string | null,  // slug de la casa con mejor cuota
      "stakeSugerido": number,    // 0.01 - 0.03
      "evPct": number,            // 0.05 - 0.30
      "razonamiento": string,     // español neutro, ~150 palabras
      "statsResumen": {            // datos clave que sustentan la recomendación
        "h2h": "...",
        "formaReciente": "...",
        "factorClave": "..."
      }
    }
  ],
  "razonGeneral": string  // si picks vacío, explicar por qué (ej: "Sin valor en este partido")
}

NO añadas texto fuera del JSON. NO uses markdown. Devuelve solo JSON parseable.`;
```

### 4. Cron de generación

`apps/web/lib/cron/generar-picks-premium.ts`:

```typescript
// Cron que corre cada 4 horas. Para cada partido top de las próximas 36h
// que NO tiene pick Premium aprobado todavía, dispara generación.

export async function generarPicksPremiumDelDia() {
  const partidosTop = await prisma.partido.findMany({
    where: {
      fechaInicio: {
        gte: new Date(),
        lte: addHours(new Date(), 36),
      },
      liga: { in: LIGAS_TOP },
      // NO tiene picks aprobados aún
      picksPremium: { none: { aprobado: true } },
    },
  });

  // Genera picks para los más cercanos primero (max 3 partidos por corrida para no quemar API)
  for (const partido of partidosTop.slice(0, 3)) {
    try {
      await generarPicksParaPartido(partido.id);
    } catch (err) {
      logger.error({ err, partidoId: partido.id }, 'Error generando pick');
    }
  }
}
```

Configurar en `vercel.json` o como Railway cron:

```json
{
  "crons": [{
    "path": "/api/v1/crons/generar-picks-premium",
    "schedule": "0 */4 * * *"
  }]
}
```

### 5. Endpoint de cron

`apps/web/app/api/v1/crons/generar-picks-premium/route.ts`:

```typescript
export async function GET(request: Request) {
  // Auth con CRON_SECRET (Vercel/Railway)
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await generarPicksPremiumDelDia();
  return NextResponse.json({ ok: true });
}
```

### 6. Helper: marcar resultado del pick post-partido

`apps/web/lib/services/picks-premium-evaluador.service.ts`:

```typescript
// Cron que corre cada hora. Para partidos finalizados últimas 24h con picks
// aprobados sin resultadoFinal, evalúa si ganó/perdió cada pick.

export async function evaluarPicksFinalizados() {
  const picksPendientes = await prisma.pickPremium.findMany({
    where: {
      aprobado: true,
      resultadoFinal: null,
      partido: { estado: 'FINALIZADO', fechaInicio: { gte: subHours(new Date(), 24) } },
    },
    include: { partido: true },
  });

  for (const pick of picksPendientes) {
    const resultado = calcularResultadoPick(pick);
    await prisma.pickPremium.update({
      where: { id: pick.id },
      data: { resultadoFinal: resultado, evaluadoEn: new Date() },
    });
  }
}

function calcularResultadoPick(pick: PickPremium & { partido: Partido }): ResultadoPick {
  const { mercado, outcome } = pick;
  const { golesLocal, golesVisitante, hayTarjetaRoja } = pick.partido;

  switch (mercado) {
    case 'RESULTADO_1X2':
      if (outcome === 'home' && golesLocal > golesVisitante) return 'GANADO';
      if (outcome === 'away' && golesVisitante > golesLocal) return 'GANADO';
      if (outcome === 'draw' && golesLocal === golesVisitante) return 'GANADO';
      return 'PERDIDO';

    case 'BTTS':
      const btts = golesLocal > 0 && golesVisitante > 0;
      return outcome === 'btts_si' ? (btts ? 'GANADO' : 'PERDIDO') : (btts ? 'PERDIDO' : 'GANADO');

    case 'OVER_UNDER_25':
      const total = golesLocal + golesVisitante;
      return outcome === 'over' ? (total > 2 ? 'GANADO' : 'PERDIDO') : (total < 3 ? 'GANADO' : 'PERDIDO');

    // ... otros casos
  }
}
```

### 7. Admin endpoint de aprobación

Endpoints para que el admin (Lote F UI) pueda aprobar/rechazar/editar picks:

- `POST /api/v1/admin/picks-premium/[id]/aprobar` → marca como APROBADO + dispara push al Channel.
- `POST /api/v1/admin/picks-premium/[id]/rechazar` → marca como RECHAZADO con motivo.
- `PATCH /api/v1/admin/picks-premium/[id]` → edita razonamiento o stake, marca EDITADO_Y_APROBADO.

(La UI de aprobación del admin se especifica en `05-pista-admin-operacion/picks-premium.spec.md` del Lote F — Entrega 6.)

## Flujo end-to-end

```
1. Cron cada 4h → generarPicksPremiumDelDia()
2. Para cada partido top próximo:
     - Obtener cuotas + stats H2H
     - Llamar Claude API con prompt
     - Parsear response → 1-3 PickPremium en estado PENDIENTE
3. Admin recibe alerta "X picks pendientes" en /admin/dashboard
4. Admin abre /admin/picks-premium → revisa cada uno
5. Admin aprueba (o edita y aprueba o rechaza)
6. Al aprobar → trigger envío al WhatsApp Channel (ver whatsapp-channel-flow.spec.md)
7. Mensaje publicado en Channel
8. Usuarios Premium ven el pick en WhatsApp + en /partidos/[slug] (sección Premium desbloqueada)
9. Cron evaluador post-partido → marca resultadoFinal en cada pick
10. Admin ve performance en /admin/picks-premium dashboard
```

## Datos requeridos

Variables de entorno (Gustavo configura en Railway):

```bash
ANTHROPIC_API_KEY               # de console.anthropic.com
ANTHROPIC_MODEL                 # default 'claude-opus-4-7'
CRON_SECRET                     # secret aleatorio para autenticar cron
```

## Estados de UI

N/A — backend.

## Componentes que reutiliza

- `obtenerOddsCacheadas` (Lote 9).
- Logger existente (Lote 6).
- Patrón de cron similar a `mincetur-check.service.ts` (Lote 10) si existe.

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- **Cero auto-publicación.** Cada pick generado por Claude API DEBE pasar por aprobación humana del editor antes de salir al Channel. NUNCA `aprobado=true` automáticamente.
- **Rate limit Claude API.** Generar picks para máximo 3 partidos por corrida del cron. Si más de 3 partidos top → priorizar los más cercanos.
- **Idempotencia.** Si ya existe un PickPremium aprobado para un partido + mercado, no generar duplicado.
- **Logs detallados.** Cada llamada a Claude API se loguea con: prompt, tokens consumidos, costo aproximado, partidoId.
- **Costo Anthropic API:** monitorear. Estimación inicial: 3 partidos × 4 corridas/día × ~3000 tokens entrada × ~1500 tokens salida ≈ $1.50/día con Opus. Si supera $50/mes → revisar prompt o cambiar a Sonnet.
- Eventos analíticos:
  - `pick_premium_generado` cuando Claude API responde y se crean PickPremium (NUEVO Lote E).
  - `pick_premium_aprobado` cuando admin aprueba (NUEVO Lote F).
  - `pick_premium_enviado_channel` cuando se publica al Channel (NUEVO Lote E, también dispatchado en whatsapp-channel-flow).
  - `pick_premium_evaluado` cuando se asigna resultadoFinal (NUEVO Lote E).

## Mockup de referencia

N/A — backend. La UI de aprobación es del Lote F (Entrega 6).

## Pasos manuales para Gustavo

### 1. Crear cuenta Anthropic API

1. Ir a https://console.anthropic.com/
2. Crear cuenta (puedes usar el email del proyecto).
3. Agregar método de pago.
4. Generar API key → variable `ANTHROPIC_API_KEY` en Railway.
5. Configurar límite de gasto mensual (ej: $50/mes) para evitar sorpresas.

### 2. Generar CRON_SECRET

En cualquier terminal:
```bash
openssl rand -hex 32
```
Copiar output → variable `CRON_SECRET` en Railway.

### 3. Configurar cron en Railway/Vercel

Si usas Vercel: agregar a `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/v1/crons/generar-picks-premium",
      "schedule": "0 */4 * * *"
    },
    {
      "path": "/api/v1/crons/evaluar-picks-finalizados",
      "schedule": "0 * * * *"
    }
  ]
}
```

Si usas Railway: usar Cron Trigger en el dashboard.

**Validación post-deploy:**

1. Manualmente disparar el cron:
   ```bash
   curl https://hablaplay.com/api/v1/crons/generar-picks-premium \
     -H "Authorization: Bearer $CRON_SECRET"
   ```
2. Verificar Railway logs:
   - Llamada a Claude API hecha
   - Tokens consumidos loggeados
   - PickPremium creados en BD con estado PENDIENTE
3. Verificar costo en console.anthropic.com.
4. Abrir `/admin/picks-premium` (Lote F) → verificar que aparecen los picks pendientes.

---

*Versión 1 · Abril 2026 · Picks Premium generación para Lote E*
