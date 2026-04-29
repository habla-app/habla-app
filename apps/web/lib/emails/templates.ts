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

