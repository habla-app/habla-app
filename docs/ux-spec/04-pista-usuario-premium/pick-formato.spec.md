# Pick formato — Plantilla del mensaje WhatsApp

Spec del formato exacto del mensaje del pick que se envía al WhatsApp Channel y al bot 1:1. Define markdown WhatsApp, watermark, links, longitud máxima, emojis.

## Lote responsable

**Lote E** — Premium backend automatización.

## Estado actual del repo

NUEVO — sin formato de mensaje WhatsApp definido.

## Cambios necesarios

### Archivo a crear

- `apps/web/lib/services/whatsapp/pick-formato.ts`:
  - Función pura `formatearPickPremium(pick, options)` que devuelve string listo para enviar.
  - Función auxiliar `formatearAlertaVivo(alerta, options)` para alertas en vivo (no picks pre-partido).

### Markdown soportado por WhatsApp

WhatsApp soporta este markdown limitado:
- `*texto*` → **bold**
- `_texto_` → *italic*
- `~texto~` → ~~strikethrough~~
- `` `texto` `` → `monospace`
- `*` `_` `~` deben estar pegados al texto sin espacios para que funcione.

NO soporta: headings, links markdown, listas con bullets nativos. Workaround: emojis como bullets (`▪`, `🔸`, `🎯`).

### Plantilla canónica del pick

```
🎯 *PICK PREMIUM #N · DD/MM*

⚽ {Equipo Local} vs {Equipo Visitante}
🏆 {Liga} · {DD/MM HH:MM}

📊 *Recomendación:*
{Mercado descriptivo}: {Outcome} @ {cuotaSugerida}

💪 *Stake sugerido:* {stakePct}% del bankroll
📈 *EV+ estimado:* {evPct}%

🏠 *Mejor cuota:* {Casa}
{Link al go con UTMs}

📝 *Por qué este pick:*
{Razonamiento ~150 palabras}

📊 *Datos clave:*
{Stats resumen líneas con bullets emoji}

⚠ _Apuesta responsable. Cuotas pueden cambiar._
_Pick generado para: {watermark email}_
```

### Ejemplo concreto

Input:
```typescript
{
  numero: 47,
  fecha: new Date('2026-04-30'),
  partido: { local: 'Alianza Lima', visitante: 'Universitario' },
  liga: 'Liga 1 Perú · Apertura',
  fechaInicio: new Date('2026-04-30T21:00:00-05:00'),
  mercado: 'BTTS',
  outcome: 'btts_si',
  cuotaSugerida: 1.85,
  stakeSugerido: 0.03,
  evPctSugerido: 0.14,
  casaRecomendada: { slug: 'betano', nombre: 'Betano' },
  razonamiento: 'Universitario anotó en 8/10 últimos partidos como visitante y Alianza recibió gol en 7/10 últimos en casa. La defensa íntima ha mostrado fragilidad ante delanteros rápidos, y Universitario llega con su 9 en gran momento (3 goles últimos 4 partidos). El head-to-head reciente refuerza la tesis: 4 de los últimos 5 enfrentamientos terminaron con BTTS sí. La cuota 1.85 representa valor cuando la probabilidad implícita del mercado (54%) es inferior a la histórica observada (70%).',
  estadisticas: {
    h2h: '4 de últimos 5 con BTTS sí',
    formaReciente: 'U: 8/10 anotó visitante · A: 7/10 recibió gol local',
    factorClave: 'Defensa íntima frágil ante extremos rápidos'
  }
}
```

Output formateado (string final que se manda):

```
🎯 *PICK PREMIUM #47 · 30/04*

⚽ Alianza Lima vs Universitario
🏆 Liga 1 Perú · Apertura · 30/04 21:00

📊 *Recomendación:*
Ambos anotan: SÍ @ *1.85*

💪 *Stake sugerido:* 3% del bankroll
📈 *EV+ estimado:* 14%

🏠 *Mejor cuota:* Betano
https://hablaplay.com/go/betano?utm_source=whatsapp_channel&utm_medium=pick&utm_campaign=pick_47&pid=alianza-vs-universitario

📝 *Por qué este pick:*
Universitario anotó en 8/10 últimos partidos como visitante y Alianza recibió gol en 7/10 últimos en casa. La defensa íntima ha mostrado fragilidad ante delanteros rápidos, y Universitario llega con su 9 en gran momento (3 goles últimos 4 partidos). El head-to-head reciente refuerza la tesis: 4 de los últimos 5 enfrentamientos terminaron con BTTS sí. La cuota 1.85 representa valor cuando la probabilidad implícita del mercado (54%) es inferior a la histórica observada (70%).

📊 *Datos clave:*
🔸 H2H: 4 de últimos 5 con BTTS sí
🔸 Forma: U anotó 8/10 visitante · A recibió 7/10 local
🔸 Factor clave: Defensa íntima frágil ante extremos rápidos

⚠ _Apuesta responsable. Cuotas pueden cambiar antes del partido._
_Pick generado para: juan@email.com_
```

### Implementación

```typescript
// apps/web/lib/services/whatsapp/pick-formato.ts
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { PickPremium, Partido, Afiliado } from '@prisma/client';

interface FormatearOpts {
  watermark: string;          // Email del usuario destinatario
  numeroSecuencial?: number;  // # del pick global (auto-increment)
}

const MERCADO_LABELS: Record<string, (outcome: string) => string> = {
  RESULTADO_1X2: (o) => {
    if (o === 'home') return 'Gana local';
    if (o === 'draw') return 'Empate';
    if (o === 'away') return 'Gana visitante';
    return 'Resultado';
  },
  BTTS: (o) => o === 'btts_si' ? 'Ambos anotan: SÍ' : 'Ambos anotan: NO',
  OVER_UNDER_25: (o) => o === 'over' ? 'Más de 2.5 goles' : 'Menos de 2.5 goles',
  TARJETA_ROJA: (o) => o === 'roja_si' ? 'Habrá tarjeta roja' : 'Sin tarjeta roja',
  MARCADOR_EXACTO: (o) => `Marcador exacto: ${o}`,
};

export function formatearPickPremium(
  pick: PickPremium & { partido: Partido; casaRecomendada: Afiliado | null },
  opts: FormatearOpts
): string {
  const fechaPartido = format(pick.partido.fechaInicio, 'dd/MM HH:mm', { locale: es });
  const fechaCorta = format(pick.fechaPublicacion, 'dd/MM', { locale: es });
  const numero = opts.numeroSecuencial ?? pick.id.slice(-4);

  const mercadoLabel = MERCADO_LABELS[pick.mercado]?.(pick.outcome) ?? pick.mercado;
  const stakePct = Math.round(pick.stakeSugerido * 100);
  const evPct = pick.evPctSugerido ? Math.round(pick.evPctSugerido * 100) : null;

  const linkCasa = pick.casaRecomendada
    ? `https://hablaplay.com/go/${pick.casaRecomendada.slug}?utm_source=whatsapp_channel&utm_medium=pick&utm_campaign=pick_${numero}&pid=${pick.partidoId}`
    : null;

  const stats = pick.estadisticas as { h2h?: string; formaReciente?: string; factorClave?: string } ?? {};
  const statsLineas = [
    stats.h2h && `🔸 H2H: ${stats.h2h}`,
    stats.formaReciente && `🔸 Forma: ${stats.formaReciente}`,
    stats.factorClave && `🔸 Factor clave: ${stats.factorClave}`,
  ].filter(Boolean).join('\n');

  const lines = [
    `🎯 *PICK PREMIUM #${numero} · ${fechaCorta}*`,
    ``,
    `⚽ ${pick.partido.local} vs ${pick.partido.visitante}`,
    `🏆 ${pick.partido.liga} · ${fechaPartido}`,
    ``,
    `📊 *Recomendación:*`,
    `${mercadoLabel} @ *${pick.cuotaSugerida.toFixed(2)}*`,
    ``,
    `💪 *Stake sugerido:* ${stakePct}% del bankroll`,
    evPct ? `📈 *EV+ estimado:* ${evPct}%` : null,
    ``,
    pick.casaRecomendada && `🏠 *Mejor cuota:* ${pick.casaRecomendada.nombre}`,
    linkCasa,
    ``,
    `📝 *Por qué este pick:*`,
    pick.razonamiento,
    ``,
    statsLineas && `📊 *Datos clave:*`,
    statsLineas,
    ``,
    `⚠ _Apuesta responsable. Cuotas pueden cambiar antes del partido._`,
    `_Pick generado para: ${opts.watermark}_`,
  ];

  return lines.filter(Boolean).join('\n');
}
```

### Plantilla de alerta en vivo

Para alertas durante partidos top (más cortas que un pick pre-partido):

```
⚡ *ALERTA EN VIVO*

⚽ {Equipo Local} {gol-l} - {gol-v} {Equipo Visitante}
⏱ Min {minuto}'

🎯 *Oportunidad:*
{descripcion corta de la oportunidad}

🏠 *Cuota actual:* {cuota} en {casa}
{Link al go}

⚠ _Cuotas en vivo cambian rápido._
_Para: {watermark email}_
```

Ejemplo:
```
⚡ *ALERTA EN VIVO*

⚽ Real Madrid 1 - 0 Bayern
⏱ Min 67'

🎯 *Oportunidad:*
Bayern necesita ir al ataque · Más de 2.5 goles ahora paga 1.95

🏠 *Cuota actual:* 1.95 en Betsson
https://hablaplay.com/go/betsson?utm_source=whatsapp_channel&utm_medium=alerta_vivo&pid=real-madrid-vs-bayern

⚠ _Cuotas en vivo cambian rápido._
_Para: juan@email.com_
```

### Resumen semanal de lunes

Otro tipo de mensaje, generado los lunes con stats de la semana anterior:

```
📊 *RESUMEN SEMANAL · {Lun DD/MM} - {Dom DD/MM}*

🎯 *Picks de la semana:* {N picks}
✅ *Acertados:* {N} ({pct}%)
❌ *Fallados:* {N}
🟡 *Pendientes:* {N}

💰 *ROI semana:* {pct}% (asumiendo stakes recomendados)

🔥 *Pick de la semana:*
{Pick que más contribuyó al ROI con su info corta}

📅 *Próxima semana:*
{Partidos top próximos a cubrir}

¡Buen domingo! 🎉
```

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- **Markdown WhatsApp simple.** Sin headings, sin tablas, sin links Markdown. Solo `*bold*`, `_italic_`, links plain.
- **Longitud máxima 1024 caracteres** por mensaje (límite WhatsApp). Si el razonamiento es muy largo, truncar con "... (sigue en la web)" + link al pick en `/partidos/[slug]`.
- **Watermark con email** OBLIGATORIO en cada mensaje (decorativo, ayuda a identificar leaks).
- **UTM params** OBLIGATORIOS en links a casas (para tracking de conversiones de afiliación desde WhatsApp).
- **Emojis consistentes** según convención: 🎯 (pick), ⚽ (partido), 🏆 (liga), 📊 (recomendación/stats), 💪 (stake), 📈 (EV+), 🏠 (casa), 📝 (razonamiento), ⚠ (warning), ⚡ (alerta vivo), 🔥 (destacado).
- **Sin acumular `*` sin texto adyacente.** WhatsApp no parsea bien si hay espacios entre `*` y la palabra.

## Pruebas requeridas

Test unitarios en `pick-formato.test.ts`:

1. Pick estándar 1X2 → renderiza correctamente.
2. Pick con casa recomendada `null` → omite línea de "Mejor cuota".
3. Pick sin estadísticas → omite sección "Datos clave".
4. Mensaje completo <1024 chars (validar con razonamiento de 150 palabras).
5. Watermark presente.
6. Link contiene UTM params correctos.
7. Date formatting correcto en zona horaria Lima (-05:00).

## Componentes que reutiliza

- `date-fns` (ya en deps).
- Modelos Prisma (Lote E modelos).

## Mockup de referencia

Visualización del mensaje en el mockup del Paquete 5A:
- `premium-landing.html` sección "WhatsApp Channel mockup" (con 2 ejemplos de pick).
- `00-design-system/mockup-actualizado.html` sección "07 · Premium landing" tiene el mismo mockup.

## Pasos manuales para Gustavo

Ninguno. Es código backend puro.

**Validación post-deploy:**

1. Disparar `formatearPickPremium()` con un pick real desde la consola (test):
   ```typescript
   const pick = await prisma.pickPremium.findFirst({ where: { aprobado: true }, include: { partido: true, casaRecomendada: true }});
   const mensaje = formatearPickPremium(pick, { watermark: 'tu@email.com' });
   console.log(mensaje);
   ```
2. Copiar el mensaje y pegarlo en un chat de WhatsApp tuyo (sin enviarlo, solo para ver formato).
3. Verificar que `*bold*` se ve en negrita, `_italic_` en itálica, y links son clickeables.
4. Verificar longitud <1024 chars.

---

*Versión 1 · Abril 2026 · Pick formato para Lote E*
