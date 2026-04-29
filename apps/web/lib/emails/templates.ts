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

// ============================================================================
// Auditoría de balances — alerta interna al admin (Lote 6C-fix3)
// ============================================================================

export interface AuditoriaAlertaInput {
  scaneadoEn: string;
  totalHallazgos: number;
  hallazgosError: number;
  hallazgosWarn: number;
  usuariosConProblemas: number;
  torneosConProblemas: number;
  /** Top hallazgos a mostrar inline en el email. */
  topHallazgos: Array<{
    invariante: string;
    severidad: "error" | "warn";
    username?: string;
    torneoId?: string;
    mensaje: string;
  }>;
  /** Resumen por invariante. */
  invariantes: Array<{
    codigo: string;
    nombre: string;
    ok: number;
    fallidos: number;
  }>;
}

/**
 * Email interno al admin cuando la auditoría diaria detecta hallazgos.
 * Subject prefijado con [Habla! AUDIT] para filtrar fácilmente.
 */
export function auditoriaAlertaTemplate(input: AuditoriaAlertaInput) {
  const subject = `[Habla! AUDIT] ${input.hallazgosError} errores · ${input.hallazgosWarn} warnings · ${input.usuariosConProblemas} usuarios afectados`;

  const filasInvariantesFallidas = input.invariantes
    .filter((i) => i.fallidos > 0)
    .map(
      (i) =>
        `<tr><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-weight:700;color:#001050;">${i.codigo}</td><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:13px;color:rgba(0,16,80,0.85);">${escapeHtml(i.nombre)}</td><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#FF3D3D;font-weight:700;text-align:right;">${i.fallidos}</td><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:13px;color:rgba(0,16,80,0.58);text-align:right;">${i.ok}</td></tr>`,
    )
    .join("");

  const filasTop = input.topHallazgos
    .slice(0, 20)
    .map((h) => {
      const sevColor = h.severidad === "error" ? "#FF3D3D" : "#FF7A00";
      const target = h.username
        ? `@${escapeHtml(h.username)}`
        : h.torneoId
          ? `torneo ${escapeHtml(h.torneoId.slice(0, 12))}…`
          : "—";
      return `<tr><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-family:monospace;color:${sevColor};font-weight:700;">${h.invariante}</td><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:12px;color:rgba(0,16,80,0.85);">${target}</td><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:12px;color:rgba(0,16,80,0.85);">${escapeHtml(h.mensaje)}</td></tr>`;
    })
    .join("");

  const fechaStr = new Date(input.scaneadoEn).toLocaleString("es-PE", {
    timeZone: "America/Lima",
    dateStyle: "short",
    timeStyle: "short",
  });

  const html = wrapEmail(
    subject,
    `<h1 style="margin:0 0 8px;font-size:22px;color:#FF3D3D;">⚠️ Auditoría diaria: hallazgos detectados</h1>
    <p style="margin:0 0 16px;font-size:14px;color:rgba(0,16,80,0.85);line-height:1.5;">
      Scan automático del ${escapeHtml(fechaStr)} (hora Lima).
    </p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
      <tr><td style="padding:8px;background:#F5F7FC;font-weight:700;">Total hallazgos</td><td style="padding:8px;text-align:right;">${input.totalHallazgos}</td></tr>
      <tr><td style="padding:8px;background:#F5F7FC;font-weight:700;color:#FF3D3D;">Errores</td><td style="padding:8px;text-align:right;color:#FF3D3D;font-weight:700;">${input.hallazgosError}</td></tr>
      <tr><td style="padding:8px;background:#F5F7FC;font-weight:700;color:#FF7A00;">Warnings</td><td style="padding:8px;text-align:right;color:#FF7A00;">${input.hallazgosWarn}</td></tr>
      <tr><td style="padding:8px;background:#F5F7FC;font-weight:700;">Usuarios afectados</td><td style="padding:8px;text-align:right;">${input.usuariosConProblemas}</td></tr>
      <tr><td style="padding:8px;background:#F5F7FC;font-weight:700;">Torneos afectados</td><td style="padding:8px;text-align:right;">${input.torneosConProblemas}</td></tr>
    </table>
    ${
      filasInvariantesFallidas
        ? `<h2 style="margin:24px 0 8px;font-size:16px;color:#001050;">Invariantes con fallas</h2><table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="background:#001050;color:#FFFFFF;"><th style="padding:8px;text-align:left;">#</th><th style="padding:8px;text-align:left;">Invariante</th><th style="padding:8px;text-align:right;">Falla</th><th style="padding:8px;text-align:right;">OK</th></tr></thead><tbody>${filasInvariantesFallidas}</tbody></table>`
        : ""
    }
    ${
      filasTop
        ? `<h2 style="margin:24px 0 8px;font-size:16px;color:#001050;">Top hallazgos (máx 20)</h2><table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr style="background:#001050;color:#FFFFFF;"><th style="padding:8px;text-align:left;">Inv</th><th style="padding:8px;text-align:left;">Target</th><th style="padding:8px;text-align:left;">Mensaje</th></tr></thead><tbody>${filasTop}</tbody></table>`
        : ""
    }
    <p style="margin:24px 0 0;font-size:13px;color:rgba(0,16,80,0.85);line-height:1.5;">
      Para investigar usuarios específicos, abrí la consola del navegador en hablaplay.com y corré:
      <br/><code style="background:#F5F7FC;padding:4px 8px;border-radius:4px;font-size:12px;">GET /api/v1/admin/auditoria/usuario/&lt;userId&gt;</code>
    </p>`,
  );

  const text = [
    `Auditoría diaria — ${fechaStr}`,
    `Hallazgos: ${input.totalHallazgos} (errores: ${input.hallazgosError}, warnings: ${input.hallazgosWarn})`,
    `Usuarios afectados: ${input.usuariosConProblemas} · Torneos: ${input.torneosConProblemas}`,
    "",
    "Invariantes con fallas:",
    ...input.invariantes
      .filter((i) => i.fallidos > 0)
      .map((i) => `  · ${i.codigo} ${i.nombre}: ${i.fallidos} falla(s) · ${i.ok} ok`),
    "",
    "Top hallazgos:",
    ...input.topHallazgos
      .slice(0, 20)
      .map(
        (h) =>
          `  · [${h.severidad}] ${h.invariante} ${h.username ? `@${h.username}` : h.torneoId ?? "—"}: ${h.mensaje}`,
      ),
  ].join("\n");

  return { subject, html, text };
}

// ============================================================================
// Backups — alerta interna al admin (Lote 7)
// ============================================================================

export interface BackupFalloInput {
  /** Últimos 2 intentos consecutivos fallidos, más reciente primero. */
  intentos: Array<{
    fechaIntento: Date;
    errorMsg: string;
    durationMs: number | null;
  }>;
}

/**
 * Email interno al admin cuando el job de backup falla 2 veces seguidas.
 * Subject prefijado con [Habla! BACKUP] para filtrar en el inbox.
 */
export function backupFalloTemplate(input: BackupFalloInput) {
  const subject = `[Habla! BACKUP] 2 fallos consecutivos del backup diario`;

  const filas = input.intentos
    .map((i) => {
      const fecha = i.fechaIntento.toLocaleString("es-PE", {
        timeZone: "America/Lima",
        dateStyle: "short",
        timeStyle: "short",
      });
      const dur = i.durationMs != null ? `${i.durationMs} ms` : "—";
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:13px;color:rgba(0,16,80,0.85);white-space:nowrap;">${escapeHtml(fecha)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:13px;color:rgba(0,16,80,0.58);white-space:nowrap;">${dur}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#FF3D3D;font-family:monospace;">${escapeHtml(i.errorMsg)}</td>
      </tr>`;
    })
    .join("");

  const html = wrapEmail(
    subject,
    `<h1 style="margin:0 0 8px;font-size:22px;color:#FF3D3D;">⚠️ Backup diario: 2 fallos consecutivos</h1>
    <p style="margin:0 0 16px;font-size:14px;color:rgba(0,16,80,0.85);line-height:1.5;">
      El job de backup a Cloudflare R2 falló los <strong>últimos 2 intentos consecutivos</strong>.
      La integridad del histórico de backups está en riesgo — revisar Railway / R2 cuanto antes.
    </p>
    <h2 style="margin:24px 0 8px;font-size:16px;color:#001050;">Últimos intentos</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead><tr style="background:#001050;color:#FFFFFF;">
        <th style="padding:8px;text-align:left;">Fecha (Lima)</th>
        <th style="padding:8px;text-align:left;">Duración</th>
        <th style="padding:8px;text-align:left;">Error</th>
      </tr></thead>
      <tbody>${filas}</tbody>
    </table>
    <h2 style="margin:24px 0 8px;font-size:16px;color:#001050;">Sugerencias de revisión</h2>
    <ul style="margin:0;padding-left:20px;font-size:13px;color:rgba(0,16,80,0.85);line-height:1.6;">
      <li>Logs del web service en Railway (filtro: <code>backup-r2</code>).</li>
      <li>Validar que <code>R2_ACCOUNT_ID</code>, <code>R2_BUCKET_BACKUPS</code>, <code>R2_ENDPOINT</code>, <code>R2_ACCESS_KEY_ID</code> y <code>R2_SECRET_ACCESS_KEY</code> sigan configuradas.</li>
      <li>Que el bucket exista en Cloudflare R2 y que la API key tenga permisos read/write.</li>
      <li>Que el binario <code>pg_dump</code> versión &gt;= 16 esté disponible en el container (Dockerfile: <code>postgresql16-client</code>).</li>
      <li>Disparar manual: <code>POST /api/v1/admin/backup/ejecutar</code> con <code>Bearer CRON_SECRET</code> y leer la respuesta.</li>
    </ul>`,
  );

  const text = [
    `Backup diario: 2 fallos consecutivos`,
    "",
    "Últimos intentos:",
    ...input.intentos.map((i) => {
      const fecha = i.fechaIntento.toISOString();
      const dur = i.durationMs != null ? `${i.durationMs}ms` : "—";
      return `  · ${fecha} (${dur}): ${i.errorMsg}`;
    }),
    "",
    "Sugerencias:",
    "  · Logs en Railway (filtro: backup-r2)",
    "  · Verificar env vars R2_*",
    "  · Verificar pg_dump >= 16 en el container",
    "  · Disparar manual: POST /api/v1/admin/backup/ejecutar",
  ].join("\n");

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// Auditoría contable — alerta interna (Lote 8 §2.D)
// ---------------------------------------------------------------------------

export interface AuditoriaContableAlertaInput {
  scaneadoEn: string;
  totalHallazgos: number;
  errores: number;
  warns: number;
  hallazgos: Array<{
    codigo: string;
    severidad: "error" | "warn";
    mensaje: string;
  }>;
}

/**
 * Email interno al admin cuando Job I detecta hallazgos `error` 2 veces
 * seguidas. Patrón idéntico al de backup. Subject prefijado con [Habla! AUDIT].
 */
export function auditoriaContableAlertaTemplate(
  input: AuditoriaContableAlertaInput,
) {
  const subject = `[Habla! AUDIT] ${input.errores} hallazgos contables — auditoría diaria`;
  const filas = input.hallazgos
    .slice(0, 25)
    .map((h) => {
      const color = h.severidad === "error" ? "#FF3D3D" : "#FFB800";
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:13px;color:${color};font-weight:700;">${escapeHtml(h.codigo)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:13px;color:rgba(0,16,80,0.85);">${escapeHtml(h.mensaje)}</td>
      </tr>`;
    })
    .join("");

  const html = wrapEmail(
    subject,
    `<h1 style="margin:0 0 8px;font-size:22px;color:#FF3D3D;">⚠️ Auditoría contable: ${input.errores} hallazgos error</h1>
    <p style="margin:0 0 16px;font-size:14px;color:rgba(0,16,80,0.85);line-height:1.5;">
      Job I detectó <strong>${input.errores} hallazgos error</strong> y ${input.warns} warns en el último scan.
      Revisar el balance general y los asientos antes de que el problema escale.
    </p>
    <p style="margin:0 0 16px;font-size:13px;color:rgba(0,16,80,0.58);">
      Scaneado: ${escapeHtml(input.scaneadoEn)}
    </p>
    <h2 style="margin:24px 0 8px;font-size:16px;color:#001050;">Hallazgos (top 25)</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead><tr style="background:#001050;color:#FFFFFF;">
        <th style="padding:8px;text-align:left;">Código</th>
        <th style="padding:8px;text-align:left;">Mensaje</th>
      </tr></thead>
      <tbody>${filas}</tbody>
    </table>
    <h2 style="margin:24px 0 8px;font-size:16px;color:#001050;">Acciones sugeridas</h2>
    <ul style="margin:0;padding-left:20px;font-size:13px;color:rgba(0,16,80,0.85);line-height:1.6;">
      <li>Drill-down: <code>POST /api/v1/admin/contabilidad/auditoria/ejecutar</code> con <code>Bearer CRON_SECRET</code>.</li>
      <li>Revisar el balance general: <code>GET /api/v1/admin/contabilidad/balance-general</code>.</li>
      <li>Si C1 falla (Activo ≠ Pasivo+Patrimonio+Resultado): hay un asiento desbalanceado o un hook contable que omitió alguna cuenta.</li>
      <li>Si C4 falla (pasivos Lukas ≠ usuarios): cruzar con la auditoría de balances Job G — probablemente hay correlación.</li>
    </ul>`,
  );

  const text = [
    `Auditoría contable: ${input.errores} hallazgos error / ${input.warns} warns`,
    `Scaneado: ${input.scaneadoEn}`,
    "",
    "Hallazgos (top 25):",
    ...input.hallazgos.slice(0, 25).map((h) => `  [${h.codigo}] ${h.severidad}: ${h.mensaje}`),
  ].join("\n");

  return { subject, html, text };
}

