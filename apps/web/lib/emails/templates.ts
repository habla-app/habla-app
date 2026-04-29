// Templates de email.
//
// Por qué HTML strings y no React Email: evitamos agregar deps al package.json
// y mantenemos el build simple. Cada template es una función pura que recibe
// un payload tipado y devuelve `{ subject, html, text }`.
//
// Convenciones visuales:
//   - Fondo navy (#001050) sobre contenido con card blanca y borde dorado.
//   - CTA principal dorado (#FFB800) con texto navy.
//   - Footer con link a hablaplay.com + dirección legal.
// Hex hardcodeados permitidos AQUÍ — la regla de no-hex es para JSX/TSX,
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

export interface TorneoCanceladoInput {
  nombreUsuario: string;
  torneoNombre: string;
  partido: string;
}

export function torneoCanceladoTemplate(input: TorneoCanceladoInput) {
  const subject = `↩️ Torneo cancelado — ${input.torneoNombre}`;
  const html = wrapEmail(
    subject,
    `<h1 style="margin:0 0 8px;font-size:24px;color:#001050;">↩️ Torneo cancelado</h1>
    <p style="margin:0 0 16px;font-size:15px;color:rgba(0,16,80,0.85);line-height:1.5;">
      ${escapeHtml(input.nombreUsuario)}, el torneo <strong>${escapeHtml(input.torneoNombre)}</strong>
      (${escapeHtml(input.partido)}) se canceló por no alcanzar el mínimo de inscritos.
    </p>
    ${ctaButton("🎯 Ver otros torneos", `${BASE_URL}/matches`)}`,
  );
  const text = `Torneo cancelado: ${input.torneoNombre}. Ver otros torneos: ${BASE_URL}/matches`;
  return { subject, html, text };
}

export interface SolicitudEliminarInput {
  nombreUsuario: string;
  tokenUrl: string;
}

export function solicitudEliminarTemplate(input: SolicitudEliminarInput) {
  const subject = `Confirma la eliminación de tu cuenta`;
  const html = wrapEmail(
    subject,
    `<h1 style="margin:0 0 8px;font-size:24px;color:#001050;">Eliminar tu cuenta</h1>
    <p style="margin:0 0 16px;font-size:15px;color:rgba(0,16,80,0.85);line-height:1.5;">
      ${escapeHtml(input.nombreUsuario)}, recibimos tu solicitud para eliminar tu cuenta de Habla!.
    </p>
    <p style="margin:16px 0;font-size:14px;color:rgba(0,16,80,0.85);line-height:1.5;">
      Este enlace es válido por <strong>48 horas</strong>. Si no lo pediste, ignora este correo y tu cuenta seguirá activa.
    </p>
    ${ctaButton("Confirmar eliminación", input.tokenUrl)}
    <p style="margin:24px 0 0;font-size:12px;color:rgba(0,16,80,0.42);word-break:break-all;">
      Si el botón no funciona, copia este link: ${input.tokenUrl}
    </p>`,
  );
  const text = `Confirma la eliminación de tu cuenta: ${input.tokenUrl} (válido 48h).`;
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
      Incluye: perfil, tickets, preferencias.
    </p>
    ${ctaButton("📦 Descargar ZIP", input.urlDescarga)}
    <p style="margin:24px 0 0;font-size:13px;color:rgba(0,16,80,0.58);text-align:center;">
      El link expira en ${input.expiraEnHoras} horas.
    </p>`,
  );
  const text = `Tus datos están listos: ${input.urlDescarga} (expira en ${input.expiraEnHoras}h).`;
  return { subject, html, text };
}

export interface PremioMensualGanadoInput {
  username: string;
  posicion: number;
  nombreMes: string;       // "abril 2026"
  nombreMesSiguiente: string; // "mayo 2026"
  montoSoles: number;
  premioPrimerPuestoSoles: number;
}

export function premioMensualGanadoTemplate(input: PremioMensualGanadoInput) {
  const subject = `🏆 ¡Felicidades! Quedaste #${input.posicion} en ${input.nombreMes} — S/ ${input.montoSoles}`;
  const ordinal = ordinalEs(input.posicion);
  const html = wrapEmail(
    subject,
    `<h1 style="margin:0 0 8px;font-size:26px;color:#001050;">🏆 ¡Felicidades, @${escapeHtml(input.username)}!</h1>
    <p style="margin:0 0 16px;font-size:16px;color:rgba(0,16,80,0.85);line-height:1.55;">
      Quedaste en el <strong>${escapeHtml(ordinal)} puesto</strong> del leaderboard de Habla! del mes de <strong>${escapeHtml(input.nombreMes)}</strong>.
    </p>
    <div style="background:linear-gradient(135deg,#FFF8E1,#FFFDF5);border:1.5px solid #FFB800;border-radius:14px;padding:20px;text-align:center;margin:20px 0;">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#8B6200;">Has ganado</div>
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:48px;font-weight:900;color:#001050;line-height:1;margin:8px 0;">S/ ${input.montoSoles}</div>
      <div style="font-size:13px;color:rgba(0,16,80,0.7);">en efectivo</div>
    </div>
    <h2 style="margin:24px 0 8px;font-size:18px;color:#001050;">Para coordinar tu pago, respondé este email con:</h2>
    <ul style="margin:0 0 16px;padding-left:22px;font-size:14px;color:rgba(0,16,80,0.85);line-height:1.7;">
      <li>Tu <strong>nombre completo</strong></li>
      <li>Tu <strong>DNI</strong></li>
      <li>Método preferido: <strong>Yape · Plin · transferencia bancaria</strong></li>
      <li>Número de celular (Yape/Plin) o cuenta + banco (transferencia)</li>
    </ul>
    <div style="background:#F5F7FC;border-left:4px solid #0052CC;padding:14px 16px;border-radius:8px;margin:16px 0;font-size:13px;color:rgba(0,16,80,0.85);line-height:1.5;">
      Te confirmamos el pago en <strong>máximo 3 días hábiles</strong>.
    </div>
    <p style="margin:24px 0 0;font-size:14px;color:rgba(0,16,80,0.7);line-height:1.55;text-align:center;">
      ¡Seguí compitiendo en <strong>${escapeHtml(input.nombreMesSiguiente)}</strong>! El premio del 1° lugar es <strong>S/ ${input.premioPrimerPuestoSoles}</strong>.
    </p>`,
  );
  const text = `¡Felicidades @${input.username}!

Quedaste en el puesto ${input.posicion} del leaderboard de Habla! del mes de ${input.nombreMes}.
Has ganado S/ ${input.montoSoles} en efectivo.

Para coordinar tu pago, respondé este email con:
- Tu nombre completo
- Tu DNI
- Método preferido (Yape / Plin / transferencia bancaria)
- Número o cuenta correspondiente

Te confirmamos el pago en máximo 3 días hábiles.

¡Seguí compitiendo en ${input.nombreMesSiguiente}! El premio del 1° lugar es S/ ${input.premioPrimerPuestoSoles}.`;
  return { subject, html, text };
}

function ordinalEs(n: number): string {
  // Ordinales escritos para los puestos 1-10 (los únicos que pagan en el
  // modelo). Para n>10 cae al genérico "N°".
  const map: Record<number, string> = {
    1: "1°",
    2: "2°",
    3: "3°",
    4: "4°",
    5: "5°",
    6: "6°",
    7: "7°",
    8: "8°",
    9: "9°",
    10: "10°",
  };
  return map[n] ?? `${n}°`;
}

export interface CuentaEliminadaInput {
  nombreUsuario: string;
  modo: "hard" | "soft";
}

export function cuentaEliminadaTemplate(input: CuentaEliminadaInput) {
  const subject = `Tu cuenta de Habla! fue eliminada`;
  const detalleModo =
    input.modo === "hard"
      ? "Tu cuenta y todos los datos asociados se borraron por completo."
      : "Tu cuenta se anonimizó: borramos tus datos personales (nombre, email, teléfono, imagen). Conservamos solo los registros de tickets por motivos de auditoría e integridad de los torneos en los que participaste, sin asociación a tu identidad.";
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

