// Servicio del newsletter editorial — Lote 10 (May 2026).
//
// Responsabilidades:
//   - `generarDigestSemanal()`: arma el JSONB del digest a partir de fuentes
//     ya construidas (leaderboard mensual del Lote 5, partidos+odds del
//     Lote 9, artículos del blog del Lote 8). Idempotente: la persistencia
//     vive en `digests_enviados.semana` (UNIQUE).
//   - `enviarDigest()`: dispara el send a la unión de suscriptores
//     confirmados + usuarios con `notifSemanal=true`. Lotes de 50 vía
//     Resend. Cada email lleva header `List-Unsubscribe` con magic link
//     firmado.
//   - Tokens de confirmación + unsubscribe: firmados con AUTH_SECRET +
//     HS256 (jose). Misma estrategia que `socket-auth.ts` — TTL 7d para
//     confirm, TTL 90d para unsubscribe.
//
// La generación es PURA (no toca DB de digests). La persistencia + envío
// los hace `crearDraftSemanal()` y `aprobarYEnviarDigest()` — separados
// para que el cron L pueda generar drafts y el endpoint admin los apruebe.

import { prisma, Prisma } from "@habla/db";
import { jwtVerify, SignJWT } from "jose";
import * as articles from "../content/articles";
import { obtenerLeaderboardMesActual } from "./leaderboard.service";
import { obtenerOddsCacheadas } from "./odds-cache.service";
import { logger } from "./logger";
import { enviarEmail } from "./email.service";
import { digestSemanalTemplate } from "../emails/templates";

// ---------------------------------------------------------------------------
// JWT — confirmación + unsubscribe
// ---------------------------------------------------------------------------

const JWT_ALG = "HS256";
export const NEWSLETTER_CONFIRM_TTL_SECONDS = 7 * 24 * 60 * 60; /* 7d */
export const NEWSLETTER_UNSUBSCRIBE_TTL_SECONDS = 90 * 24 * 60 * 60; /* 90d */

function getJwtKey(): Uint8Array {
  const secret =
    process.env.AUTH_SECRET ??
    process.env.JWT_SECRET ??
    process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_SECRET/JWT_SECRET no configurado — newsletter no puede firmar tokens.",
    );
  }
  return new TextEncoder().encode(secret);
}

export type NewsletterTokenPurpose = "confirm" | "unsub";

export interface NewsletterTokenPayload {
  email: string;
  purpose: NewsletterTokenPurpose;
}

export async function firmarTokenNewsletter(
  email: string,
  purpose: NewsletterTokenPurpose,
): Promise<string> {
  const ttl =
    purpose === "confirm"
      ? NEWSLETTER_CONFIRM_TTL_SECONDS
      : NEWSLETTER_UNSUBSCRIBE_TTL_SECONDS;
  return new SignJWT({ email, purpose })
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(getJwtKey());
}

export async function verificarTokenNewsletter(
  token: string,
): Promise<NewsletterTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtKey(), {
      algorithms: [JWT_ALG],
    });
    const email = (payload as { email?: string }).email;
    const purpose = (payload as { purpose?: string }).purpose;
    if (!email || typeof email !== "string") return null;
    if (purpose !== "confirm" && purpose !== "unsub") return null;
    return { email, purpose };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Forma del digest
// ---------------------------------------------------------------------------

export interface DigestTipster {
  username: string;
  puntos: number;
  posicion: number;
}

export interface DigestPartido {
  partidoId: string;
  equipos: string;
  liga: string;
  kickoff: string; // ISO
  mejorCuota: { casa: string; outcome: string; odd: number } | null;
}

export interface DigestArticulo {
  slug: string;
  titulo: string;
  excerpt: string;
}

export interface DigestDestacado {
  pronostico: string;
  acerto: boolean;
  casa: string | null;
  link: string | null;
}

export interface DigestCta {
  texto: string;
  url: string;
}

export interface DigestSemanal {
  /** Formato YYYY-WW (ISO 8601 week date). */
  semana: string;
  titulo: string;
  secciones: {
    topTipsters: DigestTipster[];
    partidosTop: DigestPartido[];
    articulosNuevos: DigestArticulo[];
    destacadoSemanaAnterior: DigestDestacado | null;
    frase: string;
    ctas: DigestCta[];
  };
}

// ---------------------------------------------------------------------------
// Helpers de fechas — semana ISO
// ---------------------------------------------------------------------------

/**
 * Devuelve la clave ISO 8601 de la semana (YYYY-WW) que contiene `d` en
 * UTC. La ISO week empieza el lunes; la semana 1 contiene el primer
 * jueves del año.
 */
export function getSemanaIsoKey(d: Date = new Date()): string {
  const target = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  // ISO week: thursday-anchor.
  const dayNum = target.getUTCDay() || 7; /* 1..7 */
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((target.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Generación del digest
// ---------------------------------------------------------------------------

const DEFAULT_PARTIDOS_LOOKAHEAD_DAYS = 7;
const TOP_TIPSTERS_LIMIT = 3;
const PARTIDOS_TOP_LIMIT = 5;
const ARTICULOS_NUEVOS_LIMIT = 2;

export async function generarDigestSemanal(
  reference: Date = new Date(),
): Promise<DigestSemanal> {
  const semana = getSemanaIsoKey(reference);

  const [topTipsters, partidosTop, articulosNuevos, destacadoSemanaAnterior] =
    await Promise.all([
      obtenerTopTipstersDelMes(),
      obtenerPartidosTopProximos(reference),
      Promise.resolve(obtenerArticulosNuevos()),
      // Por ahora siempre null — la resolución manual del destacado de
      // la semana se hará cuando los `<PronosticoBox>` editoriales del
      // Lote 14 estén en producción. Documentado en el reporte como
      // pendiente.
      Promise.resolve(null as DigestDestacado | null),
    ]);

  return {
    semana,
    titulo: "Tu resumen Habla! de la semana",
    secciones: {
      topTipsters,
      partidosTop,
      articulosNuevos,
      destacadoSemanaAnterior,
      frase: "Sigue prediciendo gratis y compite por S/ 1,250 mensuales.",
      ctas: [
        { texto: "🎯 Ver torneos abiertos", url: "/matches" },
        { texto: "🏆 Ver leaderboard del mes", url: "/comunidad" },
      ],
    },
  };
}

async function obtenerTopTipstersDelMes(): Promise<DigestTipster[]> {
  try {
    const lb = await obtenerLeaderboardMesActual();
    return lb.filas.slice(0, TOP_TIPSTERS_LIMIT).map((f) => ({
      username: f.username,
      puntos: f.puntos,
      posicion: f.posicion,
    }));
  } catch (err) {
    logger.warn(
      { err, source: "newsletter:top-tipsters" },
      "obtenerTopTipstersDelMes: fallo al leer leaderboard — vacío",
    );
    return [];
  }
}

async function obtenerPartidosTopProximos(
  reference: Date,
): Promise<DigestPartido[]> {
  const desde = new Date(reference);
  const hasta = new Date(
    reference.getTime() + DEFAULT_PARTIDOS_LOOKAHEAD_DAYS * 86_400_000,
  );

  const partidos = await prisma.partido.findMany({
    where: {
      fechaInicio: { gte: desde, lte: hasta },
      estado: "PROGRAMADO",
    },
    orderBy: { fechaInicio: "asc" },
    take: PARTIDOS_TOP_LIMIT,
    select: {
      id: true,
      liga: true,
      equipoLocal: true,
      equipoVisita: true,
      fechaInicio: true,
    },
  });

  // Para cada partido, buscamos la mejor cuota cacheada (Lote 9).
  const result: DigestPartido[] = [];
  for (const p of partidos) {
    let mejorCuota: DigestPartido["mejorCuota"] = null;
    try {
      const cache = await obtenerOddsCacheadas(p.id);
      if (cache) {
        // La "mejor cuota" del partido para mostrar en el digest: el
        // outcome con odd más alta entre 1X2/local/empate/visita. Es
        // simplificado; el comparador completo vive en /cuotas.
        const candidatos = [
          cache.mercados["1X2"].local
            ? {
                outcome: "Local",
                ...cache.mercados["1X2"].local,
              }
            : null,
          cache.mercados["1X2"].empate
            ? {
                outcome: "Empate",
                ...cache.mercados["1X2"].empate,
              }
            : null,
          cache.mercados["1X2"].visita
            ? {
                outcome: "Visita",
                ...cache.mercados["1X2"].visita,
              }
            : null,
        ].filter((x): x is NonNullable<typeof x> => x !== null);
        const best = candidatos.sort((a, b) => b.odd - a.odd)[0];
        if (best) {
          mejorCuota = {
            casa: best.casaNombre,
            outcome: best.outcome,
            odd: best.odd,
          };
        }
      }
    } catch (err) {
      logger.warn(
        { err, partidoId: p.id, source: "newsletter:partidos-top" },
        "obtenerPartidosTopProximos: fallo al leer odds cache — null",
      );
    }
    result.push({
      partidoId: p.id,
      equipos: `${p.equipoLocal} vs ${p.equipoVisita}`,
      liga: p.liga,
      kickoff: p.fechaInicio.toISOString(),
      mejorCuota,
    });
  }
  return result;
}

function obtenerArticulosNuevos(): DigestArticulo[] {
  try {
    return articles
      .getAll()
      .slice(0, ARTICULOS_NUEVOS_LIMIT)
      .map((d) => ({
        slug: d.frontmatter.slug,
        titulo: d.frontmatter.title,
        excerpt: d.frontmatter.excerpt,
      }));
  } catch (err) {
    logger.warn(
      { err, source: "newsletter:articulos" },
      "obtenerArticulosNuevos: fallo al cargar blog — vacío",
    );
    return [];
  }
}

// ---------------------------------------------------------------------------
// Persistencia — drafts y envíos
// ---------------------------------------------------------------------------

/**
 * Crea (o devuelve existente) un draft semanal. Si la fila para esta semana
 * ya existe, la deja como está — no regenera el contenido. El admin puede
 * editar el JSONB desde /admin/newsletter antes de aprobar.
 */
export async function crearDraftSemanal(
  reference: Date = new Date(),
): Promise<{ semana: string; created: boolean; digestId: string }> {
  const semana = getSemanaIsoKey(reference);
  const existente = await prisma.digestEnviado.findUnique({
    where: { semana },
  });
  if (existente) {
    return { semana, created: false, digestId: existente.id };
  }

  const digest = await generarDigestSemanal(reference);
  const fila = await prisma.digestEnviado.create({
    data: {
      semana,
      contenido: digest as unknown as Prisma.InputJsonValue,
    },
  });
  logger.info({ semana, source: "newsletter:draft" }, "draft semanal creado");
  return { semana, created: true, digestId: fila.id };
}

export interface DraftSemanalFila {
  id: string;
  semana: string;
  contenido: DigestSemanal;
  destinatarios: number;
  enviadoEn: Date | null;
  aprobadoPor: string | null;
  creadoEn: Date;
}

export async function obtenerDraftPorSemana(
  semana: string,
): Promise<DraftSemanalFila | null> {
  const fila = await prisma.digestEnviado.findUnique({ where: { semana } });
  if (!fila) return null;
  return {
    id: fila.id,
    semana: fila.semana,
    contenido: parseDigestContenido(fila.contenido),
    destinatarios: fila.destinatarios,
    enviadoEn: fila.enviadoEn,
    aprobadoPor: fila.aprobadoPor,
    creadoEn: fila.creadoEn,
  };
}

export async function listarDigests(limit = 50): Promise<DraftSemanalFila[]> {
  const filas = await prisma.digestEnviado.findMany({
    orderBy: { creadoEn: "desc" },
    take: Math.min(200, Math.max(1, limit)),
  });
  return filas.map((fila) => ({
    id: fila.id,
    semana: fila.semana,
    contenido: parseDigestContenido(fila.contenido),
    destinatarios: fila.destinatarios,
    enviadoEn: fila.enviadoEn,
    aprobadoPor: fila.aprobadoPor,
    creadoEn: fila.creadoEn,
  }));
}

function parseDigestContenido(json: Prisma.JsonValue): DigestSemanal {
  // Defensivo — si por alguna razón el JSONB se corrompió, devolvemos un
  // shape válido vacío para que la UI no crashee.
  if (!json || typeof json !== "object") {
    return shellVacio();
  }
  const obj = json as Record<string, unknown>;
  const semana = typeof obj.semana === "string" ? obj.semana : "";
  const titulo =
    typeof obj.titulo === "string" ? obj.titulo : "Tu resumen Habla! de la semana";
  const sec = (obj.secciones as Record<string, unknown> | undefined) ?? {};
  return {
    semana,
    titulo,
    secciones: {
      topTipsters: arr<DigestTipster>(sec.topTipsters),
      partidosTop: arr<DigestPartido>(sec.partidosTop),
      articulosNuevos: arr<DigestArticulo>(sec.articulosNuevos),
      destacadoSemanaAnterior:
        sec.destacadoSemanaAnterior &&
        typeof sec.destacadoSemanaAnterior === "object"
          ? (sec.destacadoSemanaAnterior as DigestDestacado)
          : null,
      frase:
        typeof sec.frase === "string"
          ? sec.frase
          : "Sigue prediciendo gratis y compite por S/ 1,250 mensuales.",
      ctas: arr<DigestCta>(sec.ctas),
    },
  };
}

function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function shellVacio(): DigestSemanal {
  return {
    semana: "",
    titulo: "Tu resumen Habla! de la semana",
    secciones: {
      topTipsters: [],
      partidosTop: [],
      articulosNuevos: [],
      destacadoSemanaAnterior: null,
      frase: "Sigue prediciendo gratis y compite por S/ 1,250 mensuales.",
      ctas: [],
    },
  };
}

// ---------------------------------------------------------------------------
// Aprobación + envío
// ---------------------------------------------------------------------------

/**
 * Calcula la unión deduplicada de destinatarios:
 *   - Suscriptores con `confirmadoEn != null` y `unsubscribedEn = null`.
 *   - Usuarios con `notifSemanal=true`, `emailVerified != null`, no soft-deleted.
 * Dedup por email (case-insensitive — emails se persisten lowercase).
 */
export async function obtenerDestinatariosDigest(): Promise<string[]> {
  const [suscriptores, usuarios] = await Promise.all([
    prisma.suscriptorNewsletter.findMany({
      where: { confirmadoEn: { not: null }, unsubscribedEn: null },
      select: { email: true },
    }),
    prisma.usuario.findMany({
      where: {
        emailVerified: { not: null },
        deletedAt: null,
        preferenciasNotif: { notifSemanal: true },
      },
      select: { email: true },
    }),
  ]);

  const set = new Set<string>();
  for (const s of suscriptores) set.add(s.email.toLowerCase());
  for (const u of usuarios) {
    if (u.email) set.add(u.email.toLowerCase());
  }
  return [...set];
}

export interface AprobarYEnviarResult {
  semana: string;
  destinatarios: number;
  enviados: number;
  fallidos: number;
}

/**
 * Aprueba el digest de una semana y dispara el envío. Idempotente: si ya
 * fue enviado (`enviadoEn != null`), no reenvía — devuelve `enviados:0`.
 *
 * Lotes de 50 emails. Cada email lleva header `List-Unsubscribe`
 * apuntando al magic link firmado del email destino.
 */
export async function aprobarYEnviarDigest(input: {
  semana: string;
  aprobadoPor: string;
}): Promise<AprobarYEnviarResult> {
  const fila = await prisma.digestEnviado.findUnique({
    where: { semana: input.semana },
  });
  if (!fila) {
    throw new Error(`No existe digest para semana ${input.semana}`);
  }
  if (fila.enviadoEn) {
    logger.info(
      { semana: input.semana, source: "newsletter:enviar" },
      "aprobarYEnviarDigest: ya enviado — skip",
    );
    return {
      semana: input.semana,
      destinatarios: fila.destinatarios,
      enviados: 0,
      fallidos: 0,
    };
  }

  const digest = parseDigestContenido(fila.contenido);
  const destinatarios = await obtenerDestinatariosDigest();

  let enviados = 0;
  let fallidos = 0;
  const BATCH = 50;
  for (let i = 0; i < destinatarios.length; i += BATCH) {
    const lote = destinatarios.slice(i, i + BATCH);
    const promesas = lote.map(async (email) => {
      const tpl = await renderEmailDigest(digest, email);
      const r = await enviarEmail({ to: email, ...tpl });
      if (r.ok) {
        enviados++;
      } else {
        fallidos++;
      }
    });
    await Promise.allSettled(promesas);
  }

  await prisma.digestEnviado.update({
    where: { id: fila.id },
    data: {
      enviadoEn: new Date(),
      destinatarios: destinatarios.length,
      aprobadoPor: input.aprobadoPor,
    },
  });

  logger.info(
    {
      semana: input.semana,
      destinatarios: destinatarios.length,
      enviados,
      fallidos,
      source: "newsletter:enviar",
    },
    "digest enviado",
  );

  return {
    semana: input.semana,
    destinatarios: destinatarios.length,
    enviados,
    fallidos,
  };
}

async function renderEmailDigest(
  digest: DigestSemanal,
  emailDestino: string,
) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://hablaplay.com";
  const unsubToken = await firmarTokenNewsletter(emailDestino, "unsub");
  const unsubscribeUrl = `${baseUrl}/api/v1/newsletter/unsubscribe?token=${encodeURIComponent(unsubToken)}`;
  return digestSemanalTemplate({
    digest,
    baseUrl,
    unsubscribeUrl,
  });
}

// ---------------------------------------------------------------------------
// Suscripción + confirmación + unsubscribe
// ---------------------------------------------------------------------------

export interface SuscribirInput {
  email: string;
  fuente?: string;
}

export interface SuscribirResult {
  /** "creado" si la fila no existía; "reenvio-confirm" si existía sin
   *  confirmar; "ya-confirmado" si el suscriptor ya está activo;
   *  "reactivado" si tenía unsubscribedEn pero el flujo decidió revertir
   *  (no implementado por simplicidad — preferimos pedir suscribir de nuevo
   *  desde 0 vía /suscribir, lo cual es lo que vamos a soportar). */
  estado: "creado" | "reenvio-confirm" | "ya-confirmado";
  /** Email canonicalizado (lowercase, trim). */
  email: string;
}

/**
 * Crea o reusa un suscriptor. Manda email de confirmación con magic link
 * firmado. NO requiere autenticación.
 *
 * Política con `unsubscribedEn`: si el suscriptor existe con
 * `unsubscribedEn != null`, lo tratamos como nuevo: limpiamos `unsubscribedEn`
 * y reenviamos confirm. (Esto es lo que un usuario espera al volver a
 * suscribirse desde la página pública.)
 */
export async function suscribirEmail(
  input: SuscribirInput,
): Promise<SuscribirResult> {
  const email = input.email.trim().toLowerCase();

  const existente = await prisma.suscriptorNewsletter.findUnique({
    where: { email },
  });

  if (existente && existente.confirmadoEn && !existente.unsubscribedEn) {
    return { estado: "ya-confirmado", email };
  }

  if (existente) {
    await prisma.suscriptorNewsletter.update({
      where: { id: existente.id },
      data: {
        unsubscribedEn: null,
        // Si vuelven a suscribirse, no reseteamos confirmadoEn — ya lo
        // habían confirmado antes. Pero para los que crearon la fila y
        // nunca confirmaron, dejamos confirmadoEn=null y mandamos email.
      },
    });
  } else {
    await prisma.suscriptorNewsletter.create({
      data: {
        email,
        fuente: input.fuente?.slice(0, 100) ?? null,
      },
    });
  }

  const token = await firmarTokenNewsletter(email, "confirm");
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://hablaplay.com";
  const confirmUrl = `${baseUrl}/api/v1/newsletter/confirmar?token=${encodeURIComponent(token)}`;

  await enviarEmail({
    to: email,
    subject: "Confirma tu suscripción al newsletter de Habla!",
    html: `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#F5F7FC;color:#001050;padding:40px 20px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;box-shadow:0 4px 24px rgba(0,16,80,0.06);">
    <h1 style="margin:0 0 12px;font-size:22px;color:#001050;">Confirma tu suscripción</h1>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:rgba(0,16,80,0.85);">¡Gracias por sumarte al newsletter editorial de Habla!! Hacé click en el botón para confirmar tu email y empezar a recibir el resumen semanal.</p>
    <p style="text-align:center;margin:24px 0;"><a href="${confirmUrl}" style="display:inline-block;background:#FFB800;color:#001050;font-weight:700;padding:14px 28px;border-radius:12px;text-decoration:none;">Confirmar suscripción</a></p>
    <p style="margin:16px 0 0;font-size:12px;color:rgba(0,16,80,0.58);">Si no fuiste vos quien pidió esto, ignorá este correo y no pasa nada.</p>
    <p style="margin:8px 0 0;font-size:11px;color:rgba(0,16,80,0.42);word-break:break-all;">El link expira en 7 días: ${confirmUrl}</p>
  </div>
</body></html>`,
    text: `Confirma tu suscripción al newsletter de Habla!: ${confirmUrl} (válido 7 días).`,
  });

  return {
    estado: existente ? "reenvio-confirm" : "creado",
    email,
  };
}

export async function confirmarSuscripcion(
  token: string,
): Promise<{ ok: true; email: string } | { ok: false; reason: string }> {
  const payload = await verificarTokenNewsletter(token);
  if (!payload) return { ok: false, reason: "TOKEN_INVALIDO" };
  if (payload.purpose !== "confirm") return { ok: false, reason: "TOKEN_PROPOSITO" };

  const fila = await prisma.suscriptorNewsletter.findUnique({
    where: { email: payload.email },
  });
  if (!fila) return { ok: false, reason: "SUSCRIPCION_NO_ENCONTRADA" };

  if (!fila.confirmadoEn) {
    await prisma.suscriptorNewsletter.update({
      where: { id: fila.id },
      data: { confirmadoEn: new Date(), unsubscribedEn: null },
    });
  }
  return { ok: true, email: payload.email };
}

export async function desuscribir(
  token: string,
): Promise<{ ok: true; email: string } | { ok: false; reason: string }> {
  const payload = await verificarTokenNewsletter(token);
  if (!payload) return { ok: false, reason: "TOKEN_INVALIDO" };
  if (payload.purpose !== "unsub") return { ok: false, reason: "TOKEN_PROPOSITO" };

  const fila = await prisma.suscriptorNewsletter.findUnique({
    where: { email: payload.email },
  });
  // Si no existe la fila, tratamos el unsubscribe como ok (el destinatario
  // pudo haber sido un usuario con notifSemanal=true que no era suscriptor
  // externo). Marcamos su flag de usuario.
  if (!fila) {
    await prisma.usuario.updateMany({
      where: { email: payload.email },
      data: {
        preferenciasNotif: {
          update: { notifSemanal: false },
        },
      } as never,
    }).catch(() => {
      /* ignore — el upsert exacto se hace abajo si hay usuario */
    });
  } else {
    await prisma.suscriptorNewsletter.update({
      where: { id: fila.id },
      data: { unsubscribedEn: new Date() },
    });
  }

  // Además, si hay un Usuario con ese email, desactivamos su notifSemanal
  // — un sólo unsubscribe debería cortar AMBOS canales (suscriptor externo
  // + usuario logueado).
  const usuario = await prisma.usuario.findUnique({
    where: { email: payload.email },
    select: { id: true },
  });
  if (usuario) {
    await prisma.preferenciasNotif.upsert({
      where: { usuarioId: usuario.id },
      create: {
        usuarioId: usuario.id,
        notifSemanal: false,
      },
      update: { notifSemanal: false },
    });
  }

  return { ok: true, email: payload.email };
}
