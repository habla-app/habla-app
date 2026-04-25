// Templates de email para Sub-Sprint 6 y 7.
//
// Por qué HTML strings y no React Email: evitamos agregar deps (`@react-email/*`)
// al package.json y mantenemos el build simple. Cada template es una función
// pura que recibe un payload tipado y devuelve `{ subject, html, text }`.
// Los helpers de formato (Lukas, fechas) viven en `datetime.ts` o inline.
//
// Convenciones visuales (para que los emails "se sientan Habla!"):
//   - Fondo navy (#001050) sobre contenido con card blanca y borde dorado.
//   - CTA principal dorado (#FFB800) con texto navy.
//   - Footer con link a hablaplay.com + dirección legal.
// Hex hardcodeados permitidos AQUÍ — CLAUDE.md §14 la regla es para JSX/TSX,
// no para emails que se renderean en clientes sin Tailwind.

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://habla-app-production.up.railway.app";

function wrapEmail(titulo: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8" />
<title>${escapeHtml(titulo)}</title>
</head>
<body style="margin:0;padding:0;background:#F5F7FC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#001050;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="text-align:center;padding:16px 0;">
      <span style="font-size:24px;font-weight:800;color:#001050;letter-spacing:-0.5px;">Habla!</span>
      <span style="color:#FFB800;font-weight:800;font-size:24px;">⚡</span>
    </div>
    <div style="background:#FFFFFF;border-radius:16px;padding:32px;box-shadow:0 4px 24px rgba(0,16,80,0.06);border:1px solid rgba(0,16,80,0.06);">
      ${bodyHtml}
    </div>
    <div style="padding:24px 16px;text-align:center;font-size:12px;color:rgba(0,16,80,0.58);">
      <p style="margin:0 0 8px;">Habla! — Hecho en Perú 🇵🇪</p>
      <p style="margin:0;"><a href="${BASE_URL}" style="color:rgba(0,16,80,0.58);text-decoration:underline;">hablaplay.com</a> · <a href="${BASE_URL}/perfil" style="color:rgba(0,16,80,0.58);text-decoration:underline;">Cambiar preferencias</a></p>
    </div>
  </div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function ctaButton(label: string, href: string): string {
  return `<div style="text-align:center;margin:24px 0;">
    <a href="${href}" style="display:inline-block;background:#FFB800;color:#001050;font-weight:700;padding:14px 32px;border-radius:12px;text-decoration:none;font-size:16px;">
      ${escapeHtml(label)}
    </a>
  </div>`;
}

// ============================================================================
// Templates
// ============================================================================

export interface PremioGanadoInput {
  nombreGanador: string;
  torneoNombre: string;
  posicion: number;
  premioLukas: number;
  partido: string; // "Liverpool vs Arsenal"
}

export function premioGanadoTemplate(input: PremioGanadoInput) {
  const emojiPuesto =
    input.posicion === 1 ? "🥇" : input.posicion === 2 ? "🥈" : input.posicion === 3 ? "🥉" : "🏆";
  const subject = `${emojiPuesto} Ganaste ${input.premioLukas} Lukas en ${input.partido}`;
  const html = wrapEmail(
    subject,
    `<h1 style="margin:0 0 8px;font-size:28px;color:#001050;">${emojiPuesto} ¡Felicidades, ${escapeHtml(input.nombreGanador)}!</h1>
    <p style="margin:0 0 16px;font-size:16px;color:rgba(0,16,80,0.85);line-height:1.5;">
      Terminaste <strong>${input.posicion}° lugar</strong> en el torneo <strong>${escapeHtml(input.torneoNombre)}</strong>
      (${escapeHtml(input.partido)}).
    </p>
    <div style="background:linear-gradient(135deg,#FFB800,#FF7A00);border-radius:12px;padding:24px;text-align:center;color:#001050;margin:20px 0;">
      <div style="font-size:14px;font-weight:600;opacity:0.7;">Ganaste</div>
      <div style="font-size:48px;font-weight:900;margin:8px 0;">${input.premioLukas} 🪙</div>
      <div style="font-size:14px;opacity:0.8;">Acreditados en tu balance</div>
    </div>
    <p style="margin:16px 0;font-size:14px;color:rgba(0,16,80,0.58);">
      Canjea tus Lukas por premios reales — entradas, camisetas, gift cards y más.
    </p>
    ${ctaButton("🎁 Ir a la tienda", `${BASE_URL}/tienda`)}`,
  );
  const text = `${emojiPuesto} ¡Ganaste!\n\n${input.nombreGanador}, terminaste ${input.posicion}° lugar en ${input.torneoNombre} (${input.partido}) y ganaste ${input.premioLukas} Lukas.\n\nCanjéalos aquí: ${BASE_URL}/tienda`;
  return { subject, html, text };
}

export interface CanjeSolicitadoInput {
  nombreUsuario: string;
  nombrePremio: string;
  lukasUsados: number;
  requiereDireccion: boolean;
}

export function canjeSolicitadoTemplate(input: CanjeSolicitadoInput) {
  const subject = `🛍️ Canje solicitado: ${input.nombrePremio}`;
  const html = wrapEmail(
    subject,
    `<h1 style="margin:0 0 8px;font-size:24px;color:#001050;">🛍️ Canje recibido</h1>
    <p style="margin:0 0 16px;font-size:15px;color:rgba(0,16,80,0.85);line-height:1.5;">
      ${escapeHtml(input.nombreUsuario)}, recibimos tu solicitud de canje.
    </p>
    <div style="background:#F5F7FC;border-radius:12px;padding:20px;margin:16px 0;">
      <div style="font-size:13px;color:rgba(0,16,80,0.58);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Premio</div>
      <div style="font-size:18px;font-weight:700;color:#001050;margin-bottom:12px;">${escapeHtml(input.nombrePremio)}</div>
      <div style="font-size:13px;color:rgba(0,16,80,0.58);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Lukas usados</div>
      <div style="font-size:18px;font-weight:700;color:#001050;">${input.lukasUsados} 🪙</div>
    </div>
    <p style="margin:16px 0;font-size:14px;color:rgba(0,16,80,0.85);line-height:1.5;">
      ${input.requiereDireccion
        ? "Nuestro equipo se comunicará contigo en las próximas 24 horas para coordinar la entrega."
        : "Tu premio se procesará digitalmente y te llegará en las próximas 48 horas por este mismo correo."}
    </p>
    ${ctaButton("Ver mis canjes", `${BASE_URL}/perfil`)}`,
  );
  const text = `Canje solicitado: ${input.nombrePremio} · ${input.lukasUsados} Lukas. Seguimiento: ${BASE_URL}/perfil`;
  return { subject, html, text };
}

export interface CanjeEnviadoInput {
  nombreUsuario: string;
  nombrePremio: string;
  metodo: string;
  codigoSeguimiento?: string;
}

export function canjeEnviadoTemplate(input: CanjeEnviadoInput) {
  const subject = `📦 Tu canje "${input.nombrePremio}" está en camino`;
  const html = wrapEmail(
    subject,
    `<h1 style="margin:0 0 8px;font-size:24px;color:#001050;">📦 En camino</h1>
    <p style="margin:0 0 16px;font-size:15px;color:rgba(0,16,80,0.85);line-height:1.5;">
      ${escapeHtml(input.nombreUsuario)}, acabamos de despachar tu canje.
    </p>
    <div style="background:#F5F7FC;border-radius:12px;padding:20px;margin:16px 0;">
      <div style="font-size:18px;font-weight:700;color:#001050;margin-bottom:8px;">${escapeHtml(input.nombrePremio)}</div>
      <div style="font-size:14px;color:rgba(0,16,80,0.85);">Método: ${escapeHtml(input.metodo)}</div>
      ${input.codigoSeguimiento ? `<div style="font-size:14px;color:rgba(0,16,80,0.85);margin-top:4px;">Seguimiento: <code>${escapeHtml(input.codigoSeguimiento)}</code></div>` : ""}
    </div>
    ${ctaButton("Ver detalle", `${BASE_URL}/perfil`)}`,
  );
  const text = `Tu canje "${input.nombrePremio}" está en camino. Método: ${input.metodo}${input.codigoSeguimiento ? ` · Seguimiento: ${input.codigoSeguimiento}` : ""}`;
  return { subject, html, text };
}

export interface CanjeEntregadoInput {
  nombreUsuario: string;
  nombrePremio: string;
}

export function canjeEntregadoTemplate(input: CanjeEntregadoInput) {
  const subject = `✅ "${input.nombrePremio}" entregado`;
  const html = wrapEmail(
    subject,
    `<h1 style="margin:0 0 8px;font-size:24px;color:#001050;">✅ ¡Entregado!</h1>
    <p style="margin:0 0 16px;font-size:15px;color:rgba(0,16,80,0.85);line-height:1.5;">
      ${escapeHtml(input.nombreUsuario)}, registramos la entrega de tu premio <strong>${escapeHtml(input.nombrePremio)}</strong>.
    </p>
    <p style="margin:16px 0;font-size:14px;color:rgba(0,16,80,0.85);line-height:1.5;">
      Si no lo recibiste o hay algún problema, respondenos directamente este correo.
    </p>
    ${ctaButton("Seguir jugando", `${BASE_URL}/matches`)}`,
  );
  const text = `"${input.nombrePremio}" entregado. ¿Algún problema? Respondé este correo.`;
  return { subject, html, text };
}

export interface TorneoCanceladoInput {
  nombreUsuario: string;
  torneoNombre: string;
  partido: string;
  entradaReembolsada: number;
}

export function torneoCanceladoTemplate(input: TorneoCanceladoInput) {
  const subject = `↩️ Torneo cancelado — ${input.entradaReembolsada} Lukas devueltos`;
  const html = wrapEmail(
    subject,
    `<h1 style="margin:0 0 8px;font-size:24px;color:#001050;">↩️ Torneo cancelado</h1>
    <p style="margin:0 0 16px;font-size:15px;color:rgba(0,16,80,0.85);line-height:1.5;">
      ${escapeHtml(input.nombreUsuario)}, el torneo <strong>${escapeHtml(input.torneoNombre)}</strong>
      (${escapeHtml(input.partido)}) se canceló por no alcanzar el mínimo de inscritos.
    </p>
    <div style="background:#F5F7FC;border-radius:12px;padding:20px;margin:16px 0;">
      <div style="font-size:13px;color:rgba(0,16,80,0.58);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Reembolso</div>
      <div style="font-size:28px;font-weight:800;color:#00D68F;">+${input.entradaReembolsada} 🪙</div>
      <div style="font-size:13px;color:rgba(0,16,80,0.58);margin-top:4px;">Acreditados en tu balance</div>
    </div>
    ${ctaButton("🎯 Ver otros torneos", `${BASE_URL}/matches`)}`,
  );
  const text = `Torneo cancelado: ${input.torneoNombre}. Se te devolvieron ${input.entradaReembolsada} Lukas. Ver otros torneos: ${BASE_URL}/matches`;
  return { subject, html, text };
}

export interface VerifCodigoSmsInput {
  nombreUsuario: string;
  codigo: string;
  expiraEnMin: number;
}

export function verifCodigoSmsEmailTemplate(input: VerifCodigoSmsInput) {
  // Fallback por email si el SMS no se puede enviar (modo dev sin Twilio).
  const subject = `Tu código de verificación: ${input.codigo}`;
  const html = wrapEmail(
    subject,
    `<h1 style="margin:0 0 8px;font-size:24px;color:#001050;">Código de verificación</h1>
    <p style="margin:0 0 16px;font-size:15px;color:rgba(0,16,80,0.85);line-height:1.5;">
      ${escapeHtml(input.nombreUsuario)}, tu código para verificar tu teléfono:
    </p>
    <div style="background:#001050;color:#FFB800;border-radius:12px;padding:24px;text-align:center;margin:20px 0;font-size:36px;font-weight:900;letter-spacing:8px;">
      ${escapeHtml(input.codigo)}
    </div>
    <p style="margin:16px 0;font-size:13px;color:rgba(0,16,80,0.58);text-align:center;">
      Expira en ${input.expiraEnMin} minutos. Si no lo solicitaste, ignora este correo.
    </p>`,
  );
  const text = `Tu código: ${input.codigo} (expira en ${input.expiraEnMin} min).`;
  return { subject, html, text };
}

export interface SolicitudEliminarInput {
  nombreUsuario: string;
  tokenUrl: string;
  balanceLukas: number;
}

export function solicitudEliminarTemplate(input: SolicitudEliminarInput) {
  const subject = `Confirma la eliminación de tu cuenta`;
  const tieneSaldo = input.balanceLukas > 0;
  const html = wrapEmail(
    subject,
    `<h1 style="margin:0 0 8px;font-size:24px;color:#001050;">Eliminar tu cuenta</h1>
    <p style="margin:0 0 16px;font-size:15px;color:rgba(0,16,80,0.85);line-height:1.5;">
      ${escapeHtml(input.nombreUsuario)}, recibimos tu solicitud para eliminar tu cuenta de Habla!.
    </p>
    ${tieneSaldo ? `<div style="background:#FFEDD5;border-left:4px solid #FF7A00;padding:16px;border-radius:8px;margin:16px 0;">
      <strong>⚠️ Perderás ${input.balanceLukas} Lukas canjeables.</strong><br/>
      <span style="font-size:13px;color:rgba(0,16,80,0.85);">Si querés canjearlos antes, ignora este correo y visita la tienda.</span>
    </div>` : ""}
    <p style="margin:16px 0;font-size:14px;color:rgba(0,16,80,0.85);line-height:1.5;">
      Este enlace es válido por <strong>48 horas</strong>. Si no lo pediste, ignora este correo y tu cuenta seguirá activa.
    </p>
    ${ctaButton("Confirmar eliminación", input.tokenUrl)}
    <p style="margin:24px 0 0;font-size:12px;color:rgba(0,16,80,0.42);word-break:break-all;">
      Si el botón no funciona, copia este link: ${input.tokenUrl}
    </p>`,
  );
  const text = `Confirma la eliminación de tu cuenta: ${input.tokenUrl} (válido 48h). ${tieneSaldo ? `Perderás ${input.balanceLukas} Lukas canjeables.` : ""}`;
  return { subject, html, text };
}

export interface DatosDescargadosInput {
  nombreUsuario: string;
  urlDescarga: string;
  expiraEnHoras: number;
}

export function datosDescargadosTemplate(input: DatosDescargadosInput) {
  const subject = `📥 Tus datos de Habla! están listos`;
  const html = wrapEmail(
    subject,
    `<h1 style="margin:0 0 8px;font-size:24px;color:#001050;">📥 Datos listos</h1>
    <p style="margin:0 0 16px;font-size:15px;color:rgba(0,16,80,0.85);line-height:1.5;">
      ${escapeHtml(input.nombreUsuario)}, tu archivo con todos los datos personales está disponible.
    </p>
    <p style="margin:16px 0;font-size:14px;color:rgba(0,16,80,0.85);line-height:1.5;">
      Incluye: perfil, transacciones, tickets, canjes, preferencias.
    </p>
    ${ctaButton("📦 Descargar ZIP", input.urlDescarga)}
    <p style="margin:24px 0 0;font-size:13px;color:rgba(0,16,80,0.58);text-align:center;">
      El link expira en ${input.expiraEnHoras} horas.
    </p>`,
  );
  const text = `Tus datos están listos: ${input.urlDescarga} (expira en ${input.expiraEnHoras}h).`;
  return { subject, html, text };
}

// ============================================================================
// Templates de vencimiento de Lukas — Lote 6A
// ============================================================================

export interface LukasVencidosInput {
  nombreUsuario: string;
  monto: number;
  fechaCompra: Date;
}

export function lukasVencidosTemplate(input: LukasVencidosInput) {
  const subject = `⚠️ ${input.monto} Lukas expirados de tu cuenta`;
  const fechaStr = input.fechaCompra.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Lima",
  });
  const html = wrapEmail(
    subject,
    `<h1 style="margin:0 0 8px;font-size:24px;color:#001050;">⚠️ Lukas expirados</h1>
    <p style="margin:0 0 16px;font-size:15px;color:rgba(0,16,80,0.85);line-height:1.5;">
      ${escapeHtml(input.nombreUsuario)}, ${input.monto} Lukas comprados el ${fechaStr} expiraron hoy
      por los 36 meses de vigencia.
    </p>
    <div style="background:#FFF3CD;border-left:4px solid #FFB800;padding:16px;border-radius:8px;margin:16px 0;">
      <strong>💡 Tip para la próxima:</strong> usa tus Lukas antes de que venzan inscribiéndote en torneos.
    </div>
    <p style="margin:16px 0;font-size:14px;color:rgba(0,16,80,0.85);line-height:1.5;">
      ¿Tienes Lukas ganados? Los Lukas de premio no vencen nunca. Canjéalos en la tienda.
    </p>
    ${ctaButton("🎯 Ver torneos", `${BASE_URL}/matches`)}`,
  );
  const text = `${input.monto} Lukas expirados. Comprados el ${fechaStr}. Tus Lukas ganados en torneos no vencen. Ver torneos: ${BASE_URL}/matches`;
  return { subject, html, text };
}

export interface LukasPorVencerInput {
  nombreUsuario: string;
  monto: number;
  venceEn: Date;
  diasRestantes: number;
}

export function lukasPorVencer30dTemplate(input: LukasPorVencerInput) {
  const fechaStr = input.venceEn.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Lima",
  });
  const subject = `📅 ${input.monto} Lukas vencen en 30 días (${fechaStr})`;
  const html = wrapEmail(
    subject,
    `<h1 style="margin:0 0 8px;font-size:24px;color:#001050;">📅 Lukas por vencer</h1>
    <p style="margin:0 0 16px;font-size:15px;color:rgba(0,16,80,0.85);line-height:1.5;">
      ${escapeHtml(input.nombreUsuario)}, tienes <strong>${input.monto} Lukas comprados</strong>
      que vencen el ${fechaStr} — en 30 días.
    </p>
    <p style="margin:16px 0;font-size:14px;color:rgba(0,16,80,0.85);line-height:1.5;">
      Úsalos antes de esa fecha inscribiéndote en torneos. Si ganas, los Lukas de premio no vencen nunca.
    </p>
    ${ctaButton("🎯 Ver torneos disponibles", `${BASE_URL}/matches`)}`,
  );
  const text = `${input.monto} Lukas vencen el ${fechaStr} (en 30 días). Úsalos en torneos: ${BASE_URL}/matches`;
  return { subject, html, text };
}

export function lukasPorVencer7dTemplate(input: LukasPorVencerInput) {
  const fechaStr = input.venceEn.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Lima",
  });
  const subject = `🚨 ${input.monto} Lukas vencen en 7 días — ¡úsalos ya!`;
  const html = wrapEmail(
    subject,
    `<h1 style="margin:0 0 8px;font-size:24px;color:#FF3D3D;">🚨 Último aviso de vencimiento</h1>
    <p style="margin:0 0 16px;font-size:15px;color:rgba(0,16,80,0.85);line-height:1.5;">
      ${escapeHtml(input.nombreUsuario)}, tus <strong>${input.monto} Lukas comprados</strong>
      vencen el <strong>${fechaStr}</strong> — solo quedan <strong>7 días</strong>.
    </p>
    <div style="background:#FFEDD5;border-left:4px solid #FF3D3D;padding:16px;border-radius:8px;margin:16px 0;">
      <strong>⏰ ¡Actúa ahora!</strong> Inscríbete en un torneo y ponlos a trabajar antes de que expiren.
    </div>
    ${ctaButton("🎯 Ver torneos ahora", `${BASE_URL}/matches`)}`,
  );
  const text = `URGENTE: ${input.monto} Lukas vencen el ${fechaStr} (en 7 días). Úsalos en torneos: ${BASE_URL}/matches`;
  return { subject, html, text };
}

export interface CuentaEliminadaInput {
  nombreUsuario: string;
  modo: "hard" | "soft";
}

/**
 * Confirmación post-eliminación. Se envía AL EMAIL ORIGINAL antes de la
 * anonimización (caller debe leer el email y luego ejecutar la
 * eliminación). Mini-lote 7.6.
 */
export function cuentaEliminadaTemplate(input: CuentaEliminadaInput) {
  const subject = `Tu cuenta de Habla! fue eliminada`;
  const detalleModo =
    input.modo === "hard"
      ? "Tu cuenta y todos los datos asociados se borraron por completo."
      : "Tu cuenta se anonimizó: borramos tus datos personales (nombre, email, teléfono, imagen). Conservamos solo los registros de tickets y transacciones por motivos de auditoría e integridad de los torneos en los que participaste, sin asociación a tu identidad.";
  const html = wrapEmail(
    subject,
    `<h1 style="margin:0 0 8px;font-size:24px;color:#001050;">Cuenta eliminada</h1>
    <p style="margin:0 0 16px;font-size:15px;color:rgba(0,16,80,0.85);line-height:1.5;">
      ${escapeHtml(input.nombreUsuario)}, confirmamos la eliminación de tu cuenta de Habla!.
    </p>
    <p style="margin:16px 0;font-size:14px;color:rgba(0,16,80,0.85);line-height:1.5;">
      ${detalleModo}
    </p>
    <div style="background:#FFEDD5;border-left:4px solid #FF7A00;padding:16px;border-radius:8px;margin:16px 0;font-size:13px;color:rgba(0,16,80,0.85);line-height:1.5;">
      Si esto fue un error, escribinos a <a href="mailto:equipo@hablaplay.com" style="color:#001050;font-weight:700;">equipo@hablaplay.com</a> dentro de los próximos 30 días.
    </div>
    <p style="margin:24px 0 0;font-size:13px;color:rgba(0,16,80,0.58);text-align:center;">
      Gracias por haber sido parte de Habla!. Te vamos a extrañar 💛
    </p>`,
  );
  const text = `Confirmamos la eliminación de tu cuenta de Habla!. ${detalleModo} Si fue un error, escribinos a equipo@hablaplay.com dentro de 30 días.`;
  return { subject, html, text };
}
