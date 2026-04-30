// Servicio de verificación MINCETUR — Lote 10 (May 2026).
//
// Cada lunes ≥06:00 hora Lima, el cron K (instrumentation.ts) llama a
// `verificarTodasActivas()`, que itera los afiliados activos y verifica
// contra el registro oficial del MINCETUR
// (https://apuestasdeportivas.mincetur.gob.pe/) que sigan autorizados.
//
// Estrategia de scrape:
//   - Pedimos el HTML de la página principal del registro MINCETUR.
//   - Extraemos los nombres de las casas autorizadas matcheando contra
//     una whitelist de patrones de tablas/listas conocidas. El portal
//     puede cambiar de DOM, por eso documentamos la decisión: priorizamos
//     ROBUSTEZ sobre PRECISIÓN — si no encontramos el match con seguridad,
//     marcamos `verificacionPendiente=true` (no tocamos `autorizadoMincetur`)
//     y disparamos email warn al admin para revisión humana.
//   - El match es case-insensitive y tolerante a acentos. El nombre del
//     afiliado en BD (campo `nombre`) tiene que aparecer como substring del
//     texto canonicalizado del registro.
//
// Estados resultantes para el afiliado:
//   - "ok" → match encontrado. `autorizadoMincetur=true`,
//             `ultimaVerificacionMincetur=now()`, `verificacionPendiente=false`.
//   - "perdio" → match NO encontrado pero el scrape llegó a parsear texto.
//             `autorizadoMincetur=false`, `activo=false`, email crítico.
//   - "indeterminado" → fetch falló, DOM vino vacío, o el contenido no se
//             pudo parsear. NO modifica el afiliado. Setea
//             `verificacionPendiente=true` y manda email warn al admin.
//
// Privacidad / cortesía: throttle de 5s entre verificaciones (evitar
// hammering del sitio público del MINCETUR — son pocas casas, vale la pena
// ser respetuoso).

import { prisma } from "@habla/db";
import {
  obtenerActivosOrdenados,
  obtenerAfiliadoPorSlug,
  type AfiliadoVista,
} from "./afiliacion.service";
import { enviarEmail } from "./email.service";
import { logger } from "./logger";
import { registrarError } from "./logs.service";

const MINCETUR_REGISTRO_URL =
  "https://apuestasdeportivas.mincetur.gob.pe/";
const FETCH_TIMEOUT_MS = 15_000;
const THROTTLE_MS = 5_000;

export type EstadoVerificacion = "ok" | "perdio" | "indeterminado";

export interface ResultadoVerificacion {
  slug: string;
  nombre: string;
  estado: EstadoVerificacion;
  /** Razón cuando estado = "indeterminado". Texto libre para diagnóstico. */
  motivo?: string;
}

// ---------------------------------------------------------------------------
// Cache in-memory del HTML — dentro de una corrida, NO refetchear
// ---------------------------------------------------------------------------
//
// `verificarTodasActivas()` itera N afiliados y los chequea contra el mismo
// HTML. Lo bajamos UNA vez al inicio y lo reusamos para no abusar del sitio.

interface ScrapeFetch {
  ok: boolean;
  texto: string;
  motivo?: string;
}

async function fetchRegistroMincetur(): Promise<ScrapeFetch> {
  // AbortController para timeout — fetch no respeta defaults de timeout en
  // Node 20.
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(MINCETUR_REGISTRO_URL, {
      signal: ac.signal,
      // Identificamos el bot honestamente — si MINCETUR quiere bloquear,
      // que lo haga, no nos disfrazamos.
      headers: {
        "User-Agent":
          "Habla! verificador-mincetur (https://hablaplay.com — bot semanal)",
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        ok: false,
        texto: "",
        motivo: `HTTP ${res.status}`,
      };
    }
    const html = await res.text();
    // Texto canonicalizado: sin tags, sin acentos, en minúsculas. La
    // detección de match se hace contra esto.
    const canon = canonicalizar(stripHtml(html));
    if (canon.length < 500) {
      // El registro real tiene >100KB de texto. Si llegó <500 chars el
      // scrape probablemente devolvió sólo el shell (SPA o página de
      // mantenimiento) — indeterminado.
      return {
        ok: false,
        texto: canon,
        motivo: "texto-vacio-o-shell",
      };
    }
    return { ok: true, texto: canon };
  } catch (err) {
    return {
      ok: false,
      texto: "",
      motivo:
        err instanceof Error
          ? `${err.name}: ${err.message}`.slice(0, 200)
          : "fetch-error",
    };
  } finally {
    clearTimeout(timer);
  }
}

function stripHtml(html: string): string {
  // Strip básico — no bajamos un parser HTML completo para no agregar
  // dependencias. Quitamos scripts/styles/comments y luego tags.
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacríticos
    .toLowerCase();
}

// ---------------------------------------------------------------------------
// Verificación individual
// ---------------------------------------------------------------------------

/**
 * Verifica un afiliado contra el registro MINCETUR y persiste el resultado.
 * Retorna un `ResultadoVerificacion` para que el caller (cron K, endpoint
 * admin) pueda agregar.
 *
 * Si scrape falla → estado="indeterminado", `verificacionPendiente=true`,
 * email warn. NO modifica `autorizadoMincetur`/`activo`.
 *
 * Si scrape ok pero no hay match → estado="perdio", `autorizadoMincetur=false`,
 * `activo=false`, email crítico.
 *
 * Si scrape ok y hay match → estado="ok", `autorizadoMincetur=true`,
 * `verificacionPendiente=false`, `ultimaVerificacionMincetur=now()`.
 */
export async function verificarCasa(
  slug: string,
  options: { textoCanonico?: string } = {},
): Promise<ResultadoVerificacion> {
  const afiliado = await obtenerAfiliadoPorSlug(slug);
  if (!afiliado) {
    return {
      slug,
      nombre: slug,
      estado: "indeterminado",
      motivo: "afiliado-no-existe",
    };
  }

  // Cache de scrape entre calls dentro de la misma corrida del cron.
  let texto = options.textoCanonico;
  if (texto === undefined) {
    const scrape = await fetchRegistroMincetur();
    if (!scrape.ok) {
      await marcarPendiente(afiliado.id);
      const motivo = scrape.motivo ?? "fetch-fallo";
      await notificarVerificacionPendiente(afiliado, motivo);
      return {
        slug,
        nombre: afiliado.nombre,
        estado: "indeterminado",
        motivo,
      };
    }
    texto = scrape.texto;
  }

  const nombreCanon = canonicalizar(afiliado.nombre);
  const match = texto.includes(nombreCanon);

  if (match) {
    await prisma.afiliado.update({
      where: { id: afiliado.id },
      data: {
        autorizadoMincetur: true,
        ultimaVerificacionMincetur: new Date(),
        verificacionPendiente: false,
      },
    });
    logger.info(
      { slug, source: "mincetur-check" },
      "verificarCasa: match ok",
    );
    return { slug, nombre: afiliado.nombre, estado: "ok" };
  }

  // Sin match: la casa perdió autorización (o cambió de nombre, raro pero
  // posible). Desactivamos y mandamos email crítico para revisión humana.
  await prisma.afiliado.update({
    where: { id: afiliado.id },
    data: {
      autorizadoMincetur: false,
      activo: false,
      ultimaVerificacionMincetur: new Date(),
      verificacionPendiente: false,
    },
  });
  await registrarError({
    level: "critical",
    source: "mincetur-check",
    message: `Afiliado pierde autorización MINCETUR: ${afiliado.nombre} (${slug})`,
    metadata: { slug, afiliadoId: afiliado.id },
  });
  await notificarPerdidaAutorizacion(afiliado);
  return { slug, nombre: afiliado.nombre, estado: "perdio" };
}

async function marcarPendiente(afiliadoId: string): Promise<void> {
  await prisma.afiliado.update({
    where: { id: afiliadoId },
    data: { verificacionPendiente: true },
  });
}

// ---------------------------------------------------------------------------
// Verificación masiva (cron K)
// ---------------------------------------------------------------------------

export interface VerificacionMasivaResult {
  iniciadoEn: Date;
  finalizadoEn: Date;
  total: number;
  ok: number;
  perdio: number;
  indeterminado: number;
  resultados: ResultadoVerificacion[];
}

/**
 * Itera todos los afiliados activos y verifica cada uno. Throttle 5s entre
 * llamadas. Reusa el mismo HTML del registro MINCETUR para todas las
 * verificaciones de la corrida.
 *
 * Idempotencia: si el HTML del registro no se pudo bajar, marca a TODOS los
 * afiliados como `verificacionPendiente=true` (no individualmente — se hace
 * en lote). El admin lo resuelve manualmente o el próximo cron K lo intenta
 * de nuevo.
 */
export async function verificarTodasActivas(): Promise<VerificacionMasivaResult> {
  const iniciadoEn = new Date();
  const activos = await obtenerActivosOrdenados();

  if (activos.length === 0) {
    logger.info(
      { source: "mincetur-check" },
      "verificarTodasActivas: no hay afiliados activos — skip",
    );
    return {
      iniciadoEn,
      finalizadoEn: new Date(),
      total: 0,
      ok: 0,
      perdio: 0,
      indeterminado: 0,
      resultados: [],
    };
  }

  const scrape = await fetchRegistroMincetur();
  if (!scrape.ok) {
    // Fail-soft global: marcamos a TODOS pendientes y mandamos UN email
    // warn (no spamear con N emails idénticos).
    await prisma.afiliado.updateMany({
      where: { id: { in: activos.map((a) => a.id) } },
      data: { verificacionPendiente: true },
    });
    await registrarError({
      level: "warn",
      source: "mincetur-check",
      message: `Verificación MINCETUR pendiente: scrape falló (${scrape.motivo ?? "desconocido"})`,
      metadata: { motivo: scrape.motivo, afiliadosAfectados: activos.length },
    });
    await enviarEmail({
      to: process.env.ADMIN_ALERT_EMAIL ?? "",
      subject: "⚠️ Verificación MINCETUR pendiente — scrape falló",
      html: `<p>El cron K de Habla! no pudo bajar el registro MINCETUR.</p>
<p>Motivo: <code>${escapeHtml(scrape.motivo ?? "desconocido")}</code></p>
<p>Se marcaron <strong>${activos.length}</strong> afiliados como <code>verificacionPendiente=true</code>. Revisá <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://hablaplay.com"}/admin/afiliados">/admin/afiliados</a> y disparalo de nuevo manualmente desde <code>POST /api/v1/admin/mincetur/verificar</code>.</p>`,
      text: `Verificación MINCETUR pendiente: scrape falló (${scrape.motivo ?? "desconocido"}). ${activos.length} afiliados marcados como verificacionPendiente. Revisá /admin/afiliados y disparalo de nuevo manualmente.`,
    });
    return {
      iniciadoEn,
      finalizadoEn: new Date(),
      total: activos.length,
      ok: 0,
      perdio: 0,
      indeterminado: activos.length,
      resultados: activos.map((a) => ({
        slug: a.slug,
        nombre: a.nombre,
        estado: "indeterminado",
        motivo: scrape.motivo ?? "fetch-fallo",
      })),
    };
  }

  const resultados: ResultadoVerificacion[] = [];
  for (let i = 0; i < activos.length; i++) {
    const a = activos[i];
    if (!a) continue;
    const r = await verificarCasa(a.slug, { textoCanonico: scrape.texto });
    resultados.push(r);
    if (i < activos.length - 1) {
      await new Promise((res) => setTimeout(res, THROTTLE_MS));
    }
  }

  const ok = resultados.filter((r) => r.estado === "ok").length;
  const perdio = resultados.filter((r) => r.estado === "perdio").length;
  const indeterminado = resultados.filter(
    (r) => r.estado === "indeterminado",
  ).length;

  logger.info(
    {
      total: resultados.length,
      ok,
      perdio,
      indeterminado,
      source: "mincetur-check",
    },
    "verificarTodasActivas: corrida completa",
  );

  return {
    iniciadoEn,
    finalizadoEn: new Date(),
    total: resultados.length,
    ok,
    perdio,
    indeterminado,
    resultados,
  };
}

// ---------------------------------------------------------------------------
// Helpers de "ya corrió esta semana"
// ---------------------------------------------------------------------------

/**
 * Devuelve la fecha del último lunes 00:00 hora Lima — usado como cota
 * para preguntar "¿alguien ya verificó esta semana?". El cron K corre
 * los lunes ≥06:00 PET; cualquier `ultimaVerificacionMincetur >= último
 * lunes` cuenta como "ya corrió".
 */
export function inicioSemanaLima(now: Date = new Date()): Date {
  // Lima es UTC-5 sin DST. Calcular el lunes local es estable.
  const offsetMs = 5 * 60 * 60 * 1000;
  const limaMs = now.getTime() - offsetMs;
  const limaDate = new Date(limaMs);
  // getUTCDay(): 0=domingo, 1=lunes, ..., 6=sábado. Convertimos a "días
  // desde el lunes" donde 0=lunes y 6=domingo.
  const dow = limaDate.getUTCDay();
  const sinceMonday = dow === 0 ? 6 : dow - 1;
  const lunesLimaMidnight = new Date(
    Date.UTC(
      limaDate.getUTCFullYear(),
      limaDate.getUTCMonth(),
      limaDate.getUTCDate() - sinceMonday,
      0,
      0,
      0,
    ),
  );
  // De vuelta a UTC absoluto: lunesLimaMidnight ya es a "00:00 Lima",
  // que en UTC son las 05:00.
  return new Date(lunesLimaMidnight.getTime() + offsetMs);
}

export async function yaVerificadoEstaSemana(now: Date = new Date()): Promise<boolean> {
  const desde = inicioSemanaLima(now);
  const count = await prisma.afiliado.count({
    where: { ultimaVerificacionMincetur: { gte: desde } },
  });
  return count > 0;
}

// ---------------------------------------------------------------------------
// Notificaciones
// ---------------------------------------------------------------------------

async function notificarPerdidaAutorizacion(a: AfiliadoVista): Promise<void> {
  const to = process.env.ADMIN_ALERT_EMAIL;
  if (!to) return;
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://hablaplay.com";
  await enviarEmail({
    to,
    subject: `🚨 Casa pierde autorización MINCETUR: ${a.nombre}`,
    html: `<p>El cron K de Habla! verificó hoy el registro MINCETUR y <strong>${escapeHtml(a.nombre)}</strong> ya no aparece como autorizada.</p>
<p>El afiliado se marcó como <code>autorizadoMincetur=false</code> y <code>activo=false</code>. Las CTAs y la review pública dejaron de exponerlo automáticamente.</p>
<p><a href="${baseUrl}/admin/afiliados/${a.id}">Abrir /admin/afiliados/${a.id}</a> para revisar y, si es un falso positivo, reactivarlo manualmente.</p>`,
    text: `Casa pierde autorización MINCETUR: ${a.nombre}. Marcado como autorizadoMincetur=false y activo=false. Revisar ${baseUrl}/admin/afiliados/${a.id}.`,
  });
}

async function notificarVerificacionPendiente(
  a: AfiliadoVista,
  motivo: string,
): Promise<void> {
  const to = process.env.ADMIN_ALERT_EMAIL;
  if (!to) return;
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://hablaplay.com";
  await enviarEmail({
    to,
    subject: `⚠️ Verificación MINCETUR pendiente para ${a.nombre}`,
    html: `<p>El cron K de Habla! intentó verificar a <strong>${escapeHtml(a.nombre)}</strong> contra el registro MINCETUR pero no pudo completar el scrape.</p>
<p>Motivo: <code>${escapeHtml(motivo)}</code></p>
<p>El afiliado NO fue modificado — sigue como estaba. Se marcó <code>verificacionPendiente=true</code>. Revisar manualmente en <a href="${baseUrl}/admin/afiliados/${a.id}">/admin/afiliados/${a.id}</a>.</p>`,
    text: `Verificación MINCETUR pendiente para ${a.nombre}. Motivo: ${motivo}. Afiliado sin modificar; verificacionPendiente=true. Revisar ${baseUrl}/admin/afiliados/${a.id}.`,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
