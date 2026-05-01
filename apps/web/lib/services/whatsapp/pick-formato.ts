// Formato del pick para WhatsApp Channel + bot 1:1 — Lote E.
//
// Convención canónica del mensaje (ver
// `docs/ux-spec/04-pista-usuario-premium/pick-formato.spec.md`):
//
//   🎯 *PICK PREMIUM #N · DD/MM*
//   ⚽ {Local} vs {Visita}
//   🏆 {Liga} · {DD/MM HH:mm}
//   📊 *Recomendación:* {mercado} @ *{cuota}*
//   💪 *Stake sugerido:* {N}% del bankroll
//   📈 *EV+ estimado:* {N}%
//   🏠 *Mejor cuota:* {Casa}
//   {link /go/[casa]?utm=…}
//   📝 *Por qué este pick:* {razonamiento}
//   📊 *Datos clave:* {bullets}
//   ⚠ _Apuesta responsable. Cuotas pueden cambiar._
//   _Pick generado para: {watermark}_
//
// Reglas duras:
//   - Markdown WhatsApp simple: *bold*, _italic_, links plain.
//   - Length máx 1024 caracteres por mensaje. Si supera, truncamos el
//     razonamiento y agregamos "... (sigue en la web) {link}".
//   - Watermark con email del usuario OBLIGATORIO.
//   - UTM params OBLIGATORIOS en links a casas.
//   - Emojis consistentes según convención.

import type { Afiliado, Partido, PickPremium } from "@habla/db";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://hablaplay.com";

const WHATSAPP_LIMIT = 1024;

const MERCADO_LABEL: Record<
  PickPremium["mercado"],
  (outcome: string) => string
> = {
  RESULTADO_1X2: (o) => {
    if (o === "home") return "Gana local";
    if (o === "draw") return "Empate";
    if (o === "away") return "Gana visitante";
    return `Resultado: ${o}`;
  },
  BTTS: (o) =>
    o === "btts_si" ? "Ambos anotan: SÍ" : o === "btts_no" ? "Ambos anotan: NO" : `BTTS: ${o}`,
  OVER_UNDER_25: (o) =>
    o === "over"
      ? "Más de 2.5 goles"
      : o === "under"
        ? "Menos de 2.5 goles"
        : `2.5 goles: ${o}`,
  TARJETA_ROJA: (o) =>
    o === "roja_si" ? "Habrá tarjeta roja" : o === "roja_no" ? "Sin tarjeta roja" : `Roja: ${o}`,
  MARCADOR_EXACTO: (o) => `Marcador exacto: ${o}`,
};

export interface FormatearPickOptions {
  /** Email del usuario destinatario (watermark anti-leak). */
  watermark: string;
  /**
   * Número del pick (en la secuencia mensual o global). Si no se pasa, usamos
   * los últimos 4 chars del id como fallback.
   */
  numeroSecuencial?: number;
}

/**
 * Genera el mensaje listo para enviar. Si supera 1024 chars, trunca el
 * razonamiento conservando el resto del bloque.
 */
export function formatearPickPremium(
  pick: PickPremium & {
    partido: Partido;
    casaRecomendada: Afiliado | null;
  },
  opts: FormatearPickOptions,
): string {
  const numero: number | string =
    opts.numeroSecuencial ??
    (parseInt(pick.id.slice(-4).replace(/[^0-9]/g, ""), 36) ||
      pick.id.slice(-4));

  const fechaPub = formatDate(pick.fechaPublicacion, { dia: true, hora: false });
  const fechaPartido = formatDate(pick.partido.fechaInicio, {
    dia: true,
    hora: true,
  });

  const mercadoLabel =
    MERCADO_LABEL[pick.mercado]?.(pick.outcome) ??
    `${pick.mercado}: ${pick.outcome}`;

  const stakePct = Math.round((pick.stakeSugerido ?? 0) * 100);
  const evPct =
    pick.evPctSugerido != null
      ? Math.round(pick.evPctSugerido * 100)
      : null;

  const linkCasa = pick.casaRecomendada
    ? buildAffiliateLink({
        casaSlug: pick.casaRecomendada.slug,
        numero,
        partidoId: pick.partidoId,
        canal: "whatsapp_channel",
      })
    : null;

  // Stats: jsonb { h2h?, formaReciente?, factorClave? }
  const stats = (pick.estadisticas ?? null) as
    | { h2h?: string; formaReciente?: string; factorClave?: string }
    | null;
  const statsLines = stats
    ? [
        stats.h2h && `🔸 H2H: ${stats.h2h}`,
        stats.formaReciente && `🔸 Forma: ${stats.formaReciente}`,
        stats.factorClave && `🔸 Factor clave: ${stats.factorClave}`,
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const cuota = pick.cuotaSugerida.toFixed(2);

  const partes: string[] = [];
  partes.push(`🎯 *PICK PREMIUM #${numero} · ${fechaPub}*`);
  partes.push("");
  partes.push(`⚽ ${pick.partido.equipoLocal} vs ${pick.partido.equipoVisita}`);
  partes.push(`🏆 ${pick.partido.liga} · ${fechaPartido}`);
  partes.push("");
  partes.push(`📊 *Recomendación:*`);
  partes.push(`${mercadoLabel} @ *${cuota}*`);
  partes.push("");
  partes.push(`💪 *Stake sugerido:* ${stakePct}% del bankroll`);
  if (evPct !== null) partes.push(`📈 *EV+ estimado:* ${evPct}%`);
  if (pick.casaRecomendada) {
    partes.push("");
    partes.push(`🏠 *Mejor cuota:* ${pick.casaRecomendada.nombre}`);
    if (linkCasa) partes.push(linkCasa);
  }
  partes.push("");
  partes.push(`📝 *Por qué este pick:*`);
  partes.push(pick.razonamiento);
  if (statsLines) {
    partes.push("");
    partes.push(`📊 *Datos clave:*`);
    partes.push(statsLines);
  }
  partes.push("");
  partes.push(`⚠ _Apuesta responsable. Cuotas pueden cambiar antes del partido._`);
  partes.push(`_Pick generado para: ${opts.watermark}_`);

  let mensaje = partes.join("\n");
  if (mensaje.length > WHATSAPP_LIMIT) {
    mensaje = truncarConLink(mensaje, pick, opts);
  }
  return mensaje;
}

// ---------------------------------------------------------------------------
// Alerta en vivo — versión corta del formato
// ---------------------------------------------------------------------------

export interface AlertaVivoInput {
  partidoId: string;
  partido: { local: string; visita: string };
  golLocal: number;
  golVisita: number;
  minuto: number;
  descripcion: string;
  cuotaActual: number;
  casa: { slug: string; nombre: string } | null;
}

export function formatearAlertaVivo(
  alerta: AlertaVivoInput,
  opts: { watermark: string },
): string {
  const link = alerta.casa
    ? buildAffiliateLink({
        casaSlug: alerta.casa.slug,
        numero: alerta.partidoId.slice(-4),
        partidoId: alerta.partidoId,
        canal: "whatsapp_channel",
        medio: "alerta_vivo",
      })
    : null;
  const cuota = alerta.cuotaActual.toFixed(2);

  const lines: string[] = [];
  lines.push(`⚡ *ALERTA EN VIVO*`);
  lines.push("");
  lines.push(
    `⚽ ${alerta.partido.local} ${alerta.golLocal} - ${alerta.golVisita} ${alerta.partido.visita}`,
  );
  lines.push(`⏱ Min ${alerta.minuto}'`);
  lines.push("");
  lines.push(`🎯 *Oportunidad:*`);
  lines.push(alerta.descripcion);
  if (alerta.casa) {
    lines.push("");
    lines.push(`🏠 *Cuota actual:* ${cuota} en ${alerta.casa.nombre}`);
    if (link) lines.push(link);
  }
  lines.push("");
  lines.push(`⚠ _Cuotas en vivo cambian rápido._`);
  lines.push(`_Para: ${opts.watermark}_`);

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(
  d: Date,
  opts: { dia: boolean; hora: boolean },
): string {
  // Lima es UTC-5 sin DST. Calculamos manual para evitar un Intl que en
  // edge runtime no siempre funciona.
  const offsetMs = 5 * 60 * 60 * 1000;
  const limaMs = d.getTime() - offsetMs;
  const lima = new Date(limaMs);
  const dd = String(lima.getUTCDate()).padStart(2, "0");
  const mm = String(lima.getUTCMonth() + 1).padStart(2, "0");
  const HH = String(lima.getUTCHours()).padStart(2, "0");
  const MI = String(lima.getUTCMinutes()).padStart(2, "0");
  if (opts.dia && opts.hora) return `${dd}/${mm} ${HH}:${MI}`;
  if (opts.dia) return `${dd}/${mm}`;
  return `${HH}:${MI}`;
}

function buildAffiliateLink(input: {
  casaSlug: string;
  numero: number | string;
  partidoId: string;
  canal: string;
  medio?: string;
}): string {
  const params = new URLSearchParams({
    utm_source: input.canal,
    utm_medium: input.medio ?? "pick",
    utm_campaign: `pick_${input.numero}`,
    pid: input.partidoId,
  });
  return `${APP_URL}/go/${input.casaSlug}?${params.toString()}`;
}

function truncarConLink(
  mensaje: string,
  pick: PickPremium & { partido: Partido },
  opts: FormatearPickOptions,
): string {
  // Reservamos espacio para "... (sigue en la web) {link}\n_Pick generado…_"
  const linkPartido = `${APP_URL}/partidos/${pick.partidoId}`;
  const tail = `…\n_Sigue en la web: ${linkPartido}_\n_Pick generado para: ${opts.watermark}_`;
  const limit = WHATSAPP_LIMIT - tail.length;
  if (mensaje.length <= limit) return mensaje;
  // Truncamos al límite y aseguramos que terminamos en boundary de palabra.
  const cut = mensaje.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  const safe = lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
  return safe + tail;
}
