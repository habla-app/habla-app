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

export interface CriticosResumenInput {
  /** Mes/dia humano del rango — se renderea en el subject. */
  ventana: string;
  total: number;
  topMensajes: Array<{ message: string; count: number; source: string }>;
  porSource: Array<{ source: string; count: number }>;
}

export function criticosResumenTemplate(input: CriticosResumenInput) {
  const subject = `🚨 Habla! · ${input.total} error${input.total === 1 ? "" : "es"} críticos en ${input.ventana}`;
  const adminUrl = `${BASE_URL}/admin/logs?level=critical`;

  const filasMensajes = input.topMensajes
    .map(
      (m) => `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid rgba(0,16,80,0.08);font-size:13px;color:#001050;font-weight:600;">${escapeHtml(m.message).slice(0, 200)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid rgba(0,16,80,0.08);font-size:12px;color:rgba(0,16,80,0.6);font-family:monospace;">${escapeHtml(m.source)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid rgba(0,16,80,0.08);font-size:14px;color:#D32F2F;font-weight:800;text-align:right;">×${m.count}</td>
      </tr>`,
    )
    .join("");

  const filasSource = input.porSource
    .map(
      (s) => `<li style="margin:4px 0;font-size:13px;color:rgba(0,16,80,0.85);">
        <code style="background:rgba(0,16,80,0.06);padding:2px 6px;border-radius:4px;font-size:12px;">${escapeHtml(s.source)}</code> — ${s.count}
      </li>`,
    )
    .join("");

  const html = wrapEmail(
    subject,
    `<h1 style="margin:0 0 8px;font-size:22px;color:#D32F2F;">🚨 ${input.total} error${input.total === 1 ? "" : "es"} críticos</h1>
    <p style="margin:0 0 16px;font-size:14px;color:rgba(0,16,80,0.85);line-height:1.5;">
      En la última hora (${escapeHtml(input.ventana)}). Resumen automático del cron M de Habla!.
    </p>

    ${
      input.topMensajes.length > 0
        ? `<h2 style="margin:20px 0 8px;font-size:15px;color:#001050;">Top mensajes</h2>
    <table style="width:100%;border-collapse:collapse;background:#FAFBFE;border:1px solid rgba(0,16,80,0.08);border-radius:8px;overflow:hidden;">
      <thead><tr style="background:rgba(0,16,80,0.04);">
        <th style="padding:8px 10px;text-align:left;font-size:11px;color:rgba(0,16,80,0.6);text-transform:uppercase;letter-spacing:.05em;">Mensaje</th>
        <th style="padding:8px 10px;text-align:left;font-size:11px;color:rgba(0,16,80,0.6);text-transform:uppercase;letter-spacing:.05em;">Source</th>
        <th style="padding:8px 10px;text-align:right;font-size:11px;color:rgba(0,16,80,0.6);text-transform:uppercase;letter-spacing:.05em;">Count</th>
      </tr></thead>
      <tbody>${filasMensajes}</tbody>
    </table>`
        : ""
    }

    ${
      input.porSource.length > 0
        ? `<h2 style="margin:20px 0 8px;font-size:15px;color:#001050;">Por source</h2>
    <ul style="margin:0;padding-left:20px;list-style:disc;">${filasSource}</ul>`
        : ""
    }

    ${ctaButton("Abrir /admin/logs", adminUrl)}

    <p style="margin:24px 0 0;font-size:11px;color:rgba(0,16,80,0.5);text-align:center;">
      Este email se manda como máximo 1 vez por hora. Si querés que pare, mirá el cron M en apps/web/instrumentation.ts.
    </p>`,
  );

  const textLines = [
    `🚨 ${input.total} errores críticos en Habla! (${input.ventana})`,
    "",
    "Top mensajes:",
    ...input.topMensajes.map((m) => `  · [${m.source}] ×${m.count}: ${m.message.slice(0, 200)}`),
    "",
    "Por source:",
    ...input.porSource.map((s) => `  · ${s.source}: ${s.count}`),
    "",
    `Abrir: ${adminUrl}`,
  ];
  const text = textLines.join("\n");

  return { subject, html, text };
}

// ============================================================================
// Lote 10 — Digest semanal (newsletter editorial)
// ============================================================================

export interface DigestTipsterRow {
  username: string;
  puntos: number;
  posicion: number;
}

export interface DigestPartidoRow {
  partidoId: string;
  equipos: string;
  liga: string;
  kickoff: string;
  mejorCuota: { casa: string; outcome: string; odd: number } | null;
}

export interface DigestArticuloRow {
  slug: string;
  titulo: string;
  excerpt: string;
}

export interface DigestDestacadoRow {
  pronostico: string;
  acerto: boolean;
  casa: string | null;
  link: string | null;
}

export interface DigestCtaRow {
  texto: string;
  url: string;
}

export interface DigestSemanalEmailInput {
  digest: {
    semana: string;
    titulo: string;
    secciones: {
      topTipsters: DigestTipsterRow[];
      partidosTop: DigestPartidoRow[];
      articulosNuevos: DigestArticuloRow[];
      destacadoSemanaAnterior: DigestDestacadoRow | null;
      frase: string;
      ctas: DigestCtaRow[];
    };
  };
  baseUrl: string;
  unsubscribeUrl: string;
}

export function digestSemanalTemplate(input: DigestSemanalEmailInput) {
  const { digest, baseUrl, unsubscribeUrl } = input;
  const subject = digest.titulo || "Tu resumen Habla! de la semana";

  const tipstersHtml =
    digest.secciones.topTipsters.length > 0
      ? `<h2 style="margin:24px 0 8px;font-size:17px;color:#001050;">🏆 Top tipsters del mes</h2>
<table style="width:100%;border-collapse:collapse;background:#FAFBFE;border:1px solid rgba(0,16,80,0.08);border-radius:10px;overflow:hidden;">
  ${digest.secciones.topTipsters
    .map(
      (t) => `<tr>
    <td style="padding:10px 12px;font-size:14px;font-weight:800;color:#FFB800;width:36px;">#${t.posicion}</td>
    <td style="padding:10px 12px;font-size:14px;color:#001050;">@${escapeHtml(t.username)}</td>
    <td style="padding:10px 12px;text-align:right;font-size:13px;color:rgba(0,16,80,0.7);">${t.puntos} pts</td>
  </tr>`,
    )
    .join("")}
</table>`
      : "";

  const partidosHtml =
    digest.secciones.partidosTop.length > 0
      ? `<h2 style="margin:28px 0 8px;font-size:17px;color:#001050;">⚽ Partidos top de la semana</h2>
${digest.secciones.partidosTop
  .map((p) => {
    const cuotaTxt = p.mejorCuota
      ? `<div style="margin-top:6px;font-size:12px;color:rgba(0,16,80,0.7);">Mejor cuota: <strong>${p.mejorCuota.outcome} ${p.mejorCuota.odd.toFixed(2)}</strong> en ${escapeHtml(p.mejorCuota.casa)}</div>`
      : "";
    return `<div style="border:1px solid rgba(0,16,80,0.1);border-radius:10px;padding:14px;margin-bottom:8px;background:#fff;">
      <div style="font-size:11px;font-weight:700;color:#0052CC;text-transform:uppercase;letter-spacing:.05em;">${escapeHtml(p.liga)}</div>
      <div style="font-size:15px;font-weight:700;color:#001050;margin-top:4px;">${escapeHtml(p.equipos)}</div>
      <div style="font-size:12px;color:rgba(0,16,80,0.6);margin-top:4px;">${formatKickoffShort(p.kickoff)}</div>
      ${cuotaTxt}
    </div>`;
  })
  .join("")}`
      : "";

  const articulosHtml =
    digest.secciones.articulosNuevos.length > 0
      ? `<h2 style="margin:28px 0 8px;font-size:17px;color:#001050;">📰 Nuevo en el blog</h2>
${digest.secciones.articulosNuevos
  .map(
    (a) => `<div style="border-left:3px solid #FFB800;padding:8px 14px;margin-bottom:10px;background:#FFFDF5;border-radius:0 8px 8px 0;">
    <a href="${baseUrl}/blog/${encodeURIComponent(a.slug)}" style="text-decoration:none;color:#001050;">
      <div style="font-size:15px;font-weight:700;">${escapeHtml(a.titulo)}</div>
      <div style="font-size:13px;color:rgba(0,16,80,0.7);margin-top:4px;line-height:1.5;">${escapeHtml(a.excerpt)}</div>
    </a>
  </div>`,
  )
  .join("")}`
      : "";

  const destacadoHtml = digest.secciones.destacadoSemanaAnterior
    ? `<h2 style="margin:28px 0 8px;font-size:17px;color:#001050;">⚡ Destacado de la semana pasada</h2>
<div style="border:1.5px solid ${digest.secciones.destacadoSemanaAnterior.acerto ? "#10B981" : "#D32F2F"};border-radius:10px;padding:14px;background:${digest.secciones.destacadoSemanaAnterior.acerto ? "#ECFDF5" : "#FEF2F2"};">
  <div style="font-size:11px;font-weight:700;color:${digest.secciones.destacadoSemanaAnterior.acerto ? "#10B981" : "#D32F2F"};text-transform:uppercase;letter-spacing:.05em;">${digest.secciones.destacadoSemanaAnterior.acerto ? "✅ Acertado" : "❌ Falló"}</div>
  <div style="font-size:14px;color:#001050;margin-top:6px;">${escapeHtml(digest.secciones.destacadoSemanaAnterior.pronostico)}</div>
  ${digest.secciones.destacadoSemanaAnterior.casa ? `<div style="font-size:12px;color:rgba(0,16,80,0.6);margin-top:4px;">Casa: ${escapeHtml(digest.secciones.destacadoSemanaAnterior.casa)}</div>` : ""}
</div>`
    : "";

  const ctasHtml = digest.secciones.ctas
    .map(
      (c) => `<div style="text-align:center;margin:12px 0;">
      <a href="${absUrl(c.url, baseUrl)}" style="display:inline-block;background:#FFB800;color:#001050;font-weight:700;padding:12px 24px;border-radius:10px;text-decoration:none;font-size:14px;">${escapeHtml(c.texto)}</a>
    </div>`,
    )
    .join("");

  const html = wrapEmail(
    subject,
    `<h1 style="margin:0 0 6px;font-size:24px;color:#001050;">${escapeHtml(digest.titulo)}</h1>
<p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#FFB800;text-transform:uppercase;letter-spacing:.06em;">Semana ${escapeHtml(digest.semana)}</p>
<p style="margin:14px 0 0;font-size:14px;color:rgba(0,16,80,0.85);line-height:1.6;">${escapeHtml(digest.secciones.frase)}</p>
${tipstersHtml}
${partidosHtml}
${articulosHtml}
${destacadoHtml}
<div style="margin:32px 0 0;padding-top:20px;border-top:1px solid rgba(0,16,80,0.08);">${ctasHtml}</div>
<p style="margin:24px 0 0;font-size:11px;color:rgba(0,16,80,0.5);text-align:center;line-height:1.55;">
  Recibís este resumen porque te suscribiste o tenés "Resumen semanal" activo en tus preferencias.<br />
  <a href="${unsubscribeUrl}" style="color:rgba(0,16,80,0.5);text-decoration:underline;">Darme de baja</a> · <a href="${baseUrl}/perfil" style="color:rgba(0,16,80,0.5);text-decoration:underline;">Cambiar preferencias</a>
</p>`,
  );

  // Resend acepta headers personalizados via la API. Lo agregamos en el
  // payload del enviarEmail (más abajo): ListUnsubscribe header.
  const text = [
    digest.titulo,
    `Semana ${digest.semana}`,
    "",
    digest.secciones.frase,
    "",
    digest.secciones.topTipsters.length > 0
      ? "Top tipsters del mes:"
      : null,
    ...digest.secciones.topTipsters.map(
      (t) => `  #${t.posicion} @${t.username} — ${t.puntos} pts`,
    ),
    "",
    digest.secciones.partidosTop.length > 0 ? "Partidos top:" : null,
    ...digest.secciones.partidosTop.map(
      (p) =>
        `  · [${p.liga}] ${p.equipos} (${formatKickoffShort(p.kickoff)})`,
    ),
    "",
    digest.secciones.articulosNuevos.length > 0
      ? "Nuevo en el blog:"
      : null,
    ...digest.secciones.articulosNuevos.map(
      (a) => `  · ${a.titulo} — ${baseUrl}/blog/${a.slug}`,
    ),
    "",
    `Darme de baja: ${unsubscribeUrl}`,
  ]
    .filter((x): x is string => x !== null)
    .join("\n");

  return { subject, html, text };
}

function formatKickoffShort(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-PE", {
      timeZone: "America/Lima",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

function absUrl(maybeRelative: string, baseUrl: string): string {
  if (/^https?:\/\//i.test(maybeRelative)) return maybeRelative;
  if (maybeRelative.startsWith("/")) return `${baseUrl}${maybeRelative}`;
  return `${baseUrl}/${maybeRelative}`;
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
// Lote E (May 2026) — Premium emails
// ============================================================================

const PLAN_LABEL: Record<"MENSUAL" | "TRIMESTRAL" | "ANUAL", string> = {
  MENSUAL: "Mensual",
  TRIMESTRAL: "Trimestral",
  ANUAL: "Anual",
};

const PLAN_PRECIO: Record<"MENSUAL" | "TRIMESTRAL" | "ANUAL", number> = {
  MENSUAL: 49,
  TRIMESTRAL: 119,
  ANUAL: 399,
};

function fmtFechaEs(date: Date): string {
  try {
    return date.toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "America/Lima",
    });
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export interface BienvenidaPremiumInput {
  nombre: string;
  plan: "MENSUAL" | "TRIMESTRAL" | "ANUAL";
  proximoCobro: Date;
  channelLink: string | null;
}

export function bienvenidaPremiumTemplate(input: BienvenidaPremiumInput) {
  const subject = `🎉 ¡Bienvenido a Habla! Premium!`;
  const planLabel = PLAN_LABEL[input.plan];
  const proxFecha = fmtFechaEs(input.proximoCobro);
  const channelButton = input.channelLink
    ? ctaButton("📱 Unirme al WhatsApp Channel", input.channelLink)
    : `<div style="background:#F5F7FC;border-left:4px solid #FFB800;padding:14px 16px;border-radius:8px;margin:16px 0;font-size:13px;color:rgba(0,16,80,0.85);line-height:1.5;">
        Te enviaremos el link al WhatsApp Channel privado en las próximas 24 horas.
       </div>`;

  const html = wrapEmail(
    subject,
    `<h1 style="margin:0 0 8px;font-size:26px;color:#001050;">🎉 ¡Bienvenido, ${escapeHtml(input.nombre)}!</h1>
    <p style="margin:0 0 16px;font-size:16px;color:rgba(0,16,80,0.85);line-height:1.55;">
      Tu suscripción <strong>Habla! Premium ${escapeHtml(planLabel)}</strong> está <strong>activa</strong>.
    </p>
    <div style="background:linear-gradient(135deg,#FFF8E1,#FFFDF5);border:1.5px solid #FFB800;border-radius:14px;padding:20px;margin:20px 0;">
      <h2 style="margin:0 0 12px;font-size:16px;color:#001050;">Lo que ahora tienes:</h2>
      <ul style="margin:0;padding-left:22px;font-size:14px;color:rgba(0,16,80,0.85);line-height:1.7;">
        <li><strong>2-4 picks/día</strong> con razonamiento estadístico y EV+</li>
        <li><strong>Casa con mejor cuota</strong> incluida en cada pick</li>
        <li><strong>Alertas en vivo</strong> durante partidos top</li>
        <li><strong>Bot FAQ 24/7</strong> en WhatsApp 1:1</li>
        <li><strong>Resumen semanal</strong> los lunes</li>
      </ul>
    </div>
    ${channelButton}
    <h2 style="margin:24px 0 8px;font-size:18px;color:#001050;">Detalles de tu suscripción</h2>
    <ul style="margin:0 0 16px;padding-left:22px;font-size:14px;color:rgba(0,16,80,0.85);line-height:1.7;">
      <li>Plan: <strong>${escapeHtml(planLabel)}</strong> (S/ ${PLAN_PRECIO[input.plan]})</li>
      <li>Próximo cobro: <strong>${escapeHtml(proxFecha)}</strong></li>
      <li>Garantía: <strong>7 días sin compromiso</strong></li>
    </ul>
    <div style="background:#F5F7FC;border-left:4px solid #0052CC;padding:14px 16px;border-radius:8px;margin:16px 0;font-size:13px;color:rgba(0,16,80,0.85);line-height:1.5;">
      Puedes gestionar tu suscripción en cualquier momento desde
      <a href="${BASE_URL}/premium/mi-suscripcion" style="color:#001050;font-weight:700;">tu panel</a>.
    </div>
    <p style="margin:24px 0 0;font-size:12px;color:rgba(0,16,80,0.58);text-align:center;line-height:1.5;">
      Apuesta responsable. Línea Tugar (gratuita): 0800-19009.
    </p>`,
  );

  const text = `¡Bienvenido a Habla! Premium, ${input.nombre}!
Tu plan ${planLabel} está activo. Próximo cobro: ${proxFecha}.
${input.channelLink ? `Únete al Channel: ${input.channelLink}` : "Te enviaremos el link al WhatsApp Channel en las próximas 24h."}
Gestiona tu suscripción: ${BASE_URL}/premium/mi-suscripcion
Apuesta responsable. Línea Tugar: 0800-19009.`;

  return { subject, html, text };
}

export interface RenovacionPremiumInput {
  nombre: string;
  plan: "MENSUAL" | "TRIMESTRAL" | "ANUAL";
  proximoCobro: Date;
  monto: number; // céntimos de soles
}

export function renovacionPremiumTemplate(input: RenovacionPremiumInput) {
  const planLabel = PLAN_LABEL[input.plan];
  const subject = `✅ Cobro confirmado · Habla! Premium ${planLabel}`;
  const montoSoles = (input.monto / 100).toFixed(2);
  const proxFecha = fmtFechaEs(input.proximoCobro);

  const html = wrapEmail(
    subject,
    `<h1 style="margin:0 0 8px;font-size:24px;color:#001050;">✅ Cobro confirmado</h1>
    <p style="margin:0 0 16px;font-size:15px;color:rgba(0,16,80,0.85);line-height:1.5;">
      ${escapeHtml(input.nombre)}, confirmamos el cobro de tu suscripción
      <strong>Habla! Premium ${escapeHtml(planLabel)}</strong>.
    </p>
    <div style="background:#F5F7FC;border-radius:12px;padding:16px;margin:16px 0;">
      <div style="display:flex;justify-content:space-between;font-size:14px;color:rgba(0,16,80,0.85);line-height:1.7;">
        <span>Monto cobrado</span><span style="font-weight:700;">S/ ${montoSoles}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:14px;color:rgba(0,16,80,0.85);line-height:1.7;">
        <span>Plan</span><span style="font-weight:700;">${escapeHtml(planLabel)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:14px;color:rgba(0,16,80,0.85);line-height:1.7;">
        <span>Próximo cobro</span><span style="font-weight:700;">${escapeHtml(proxFecha)}</span>
      </div>
    </div>
    ${ctaButton("Ver mi suscripción", `${BASE_URL}/premium/mi-suscripcion`)}
    <p style="margin:24px 0 0;font-size:12px;color:rgba(0,16,80,0.58);text-align:center;line-height:1.5;">
      Si no reconoces este cobro, escríbenos a <a href="mailto:soporte@hablaplay.com" style="color:#001050;">soporte@hablaplay.com</a>.
    </p>`,
  );

  const text = `Cobro confirmado: S/ ${montoSoles} (${planLabel}). Próximo cobro: ${proxFecha}. Ver: ${BASE_URL}/premium/mi-suscripcion`;
  return { subject, html, text };
}

export interface ReembolsoPremiumInput {
  nombre: string;
  monto: number; // céntimos
}

export function reembolsoPremiumTemplate(input: ReembolsoPremiumInput) {
  const montoSoles = (input.monto / 100).toFixed(2);
  const subject = `↩️ Reembolso procesado · S/ ${montoSoles}`;
  const html = wrapEmail(
    subject,
    `<h1 style="margin:0 0 8px;font-size:24px;color:#001050;">↩️ Reembolso procesado</h1>
    <p style="margin:0 0 16px;font-size:15px;color:rgba(0,16,80,0.85);line-height:1.5;">
      ${escapeHtml(input.nombre)}, procesamos el reembolso completo de tu suscripción Habla! Premium.
    </p>
    <div style="background:#F5F7FC;border-radius:12px;padding:16px;margin:16px 0;text-align:center;">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:rgba(0,16,80,0.7);">Monto reembolsado</div>
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:40px;font-weight:900;color:#001050;line-height:1;margin:8px 0;">S/ ${montoSoles}</div>
    </div>
    <p style="margin:16px 0;font-size:14px;color:rgba(0,16,80,0.85);line-height:1.5;">
      El reembolso aparecerá en tu cuenta en <strong>3 a 7 días hábiles</strong>, según tu banco.
    </p>
    <p style="margin:16px 0;font-size:14px;color:rgba(0,16,80,0.85);line-height:1.5;">
      Tu acceso al WhatsApp Channel y al bot Premium se desactivó. Si querés volver más adelante:
    </p>
    ${ctaButton("Volver a Premium", `${BASE_URL}/premium`)}
    <p style="margin:24px 0 0;font-size:12px;color:rgba(0,16,80,0.58);text-align:center;line-height:1.5;">
      Cualquier consulta: soporte@hablaplay.com
    </p>`,
  );
  const text = `Reembolso procesado: S/ ${montoSoles}. Aparecerá en tu cuenta en 3-7 días hábiles. Volver a Premium: ${BASE_URL}/premium`;
  return { subject, html, text };
}

export interface FalloPagoPremiumInput {
  nombre: string;
  motivo: string;
}

export function falloPagoPremiumTemplate(input: FalloPagoPremiumInput) {
  const subject = `⚠️ No pudimos procesar tu pago · Habla! Premium`;
  const html = wrapEmail(
    subject,
    `<h1 style="margin:0 0 8px;font-size:24px;color:#001050;">⚠️ Pago rechazado</h1>
    <p style="margin:0 0 16px;font-size:15px;color:rgba(0,16,80,0.85);line-height:1.5;">
      ${escapeHtml(input.nombre)}, intentamos cobrar tu suscripción a Habla! Premium pero el pago fue rechazado.
    </p>
    <div style="background:#FEF2F2;border-left:4px solid #DC2626;padding:14px 16px;border-radius:8px;margin:16px 0;font-size:14px;color:rgba(0,16,80,0.85);line-height:1.5;">
      Motivo: ${escapeHtml(input.motivo)}
    </div>
    <p style="margin:16px 0;font-size:14px;color:rgba(0,16,80,0.85);line-height:1.5;">
      Si querés activar Premium, intentá de nuevo desde la web — podés probar otra tarjeta o método.
    </p>
    ${ctaButton("Reintentar suscripción", `${BASE_URL}/premium/checkout`)}
    <p style="margin:24px 0 0;font-size:12px;color:rgba(0,16,80,0.58);text-align:center;line-height:1.5;">
      Cualquier consulta: soporte@hablaplay.com
    </p>`,
  );
  const text = `Tu pago fue rechazado. Motivo: ${input.motivo}. Reintentar: ${BASE_URL}/premium/checkout`;
  return { subject, html, text };
}

