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

export interface PremioGanadoInput {
  nombreGanador: string;
  torneoNombre: string;
  posicion: number;
  partido: string;
}

export function premioGanadoTemplate(input: PremioGanadoInput) {
  const emojiPuesto =
    input.posicion === 1 ? "🥇" : input.posicion === 2 ? "🥈" : input.posicion === 3 ? "🥉" : "🏆";
  const subject = `${emojiPuesto} Quedaste ${input.posicion}° en ${input.partido}`;
  const html = wrapEmail(
    subject,
    `<h1 style="margin:0 0 8px;font-size:28px;color:#001050;">${emojiPuesto} ¡Felicidades, ${escapeHtml(input.nombreGanador)}!</h1>
    <p style="margin:0 0 16px;font-size:16px;color:rgba(0,16,80,0.85);line-height:1.5;">
      Terminaste <strong>${input.posicion}° lugar</strong> en el torneo <strong>${escapeHtml(input.torneoNombre)}</strong>
      (${escapeHtml(input.partido)}).
    </p>
    <p style="margin:16px 0;font-size:14px;color:rgba(0,16,80,0.58);">
      Sigue prediciendo gratis los próximos partidos para subir en el ranking.
    </p>
    ${ctaButton("🎯 Ver torneos abiertos", `${BASE_URL}/matches`)}`,
  );
  const text = `${emojiPuesto} ¡Felicidades!\n\n${input.nombreGanador}, terminaste ${input.posicion}° lugar en ${input.torneoNombre} (${input.partido}).\n\nSeguí prediciendo: ${BASE_URL}/matches`;
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
    ${ctaButton("Seguir prediciendo", `${BASE_URL}/matches`)}`,
  );
  const text = `"${input.nombrePremio}" entregado. ¿Algún problema? Respondé este correo.`;
  return { subject, html, text };
}

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
      Incluye: perfil, tickets, canjes, preferencias.
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

// ============================================================================
// Backups — alerta interna al admin
// ============================================================================

export interface BackupFalloInput {
  /** Últimos 2 intentos consecutivos fallidos, más reciente primero. */
  intentos: Array<{
    fechaIntento: Date;
    errorMsg: string;
    durationMs: number | null;
  }>;
}

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
// Auditoría contable — alerta interna
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
    </table>`,
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
