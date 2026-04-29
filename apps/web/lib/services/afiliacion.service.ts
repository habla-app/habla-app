// Servicio de afiliación MINCETUR — Lote 7 (May 2026).
//
// Capa de dominio sobre las tablas `afiliados`, `clicks_afiliados` y
// `conversiones_afiliados`. Consume:
//   - el endpoint /go/[slug] (registra click, devuelve urlBase para el redirect),
//   - los componentes MDX (CasaCTA, CasaReviewCard, TablaCasas) que se usarán
//     desde Lote 8 en adelante para inyectar afiliados en artículos editoriales,
//   - los paneles admin /admin/afiliados/* y /admin/conversiones (CRUD + stats).
//
// Privacidad:
//   - La IP cruda nunca se persiste. `registrarClick()` la hashea con
//     SHA-256 + sal in-memory (rotada cada restart) y guarda solo el hash.
//     El hash sirve para deduplicar bursts in-process pero NO permite
//     re-identificar al usuario fuera del proceso.
//   - El hash se hace con `globalThis.crypto.subtle.digest` (Web Crypto),
//     NO con `node:crypto`, porque este service podría ser arrastrado al
//     edge bundle por imports transitivos (ver nota en analytics.service.ts).
//   - El country se extrae del header `cf-ipcountry` del proxy de Cloudflare.

import { prisma, Prisma, type Afiliado } from "@habla/db";
import { logger } from "./logger";

// ---------------------------------------------------------------------------
// Sal del hash de IP — rotada por proceso
// ---------------------------------------------------------------------------
//
// Generada al cargar el módulo. Cualquier restart de Railway invalida los
// hashes previos (deseable: si una IP volvió ayer, no queremos linkearla
// con su click de hoy). 32 bytes random codificados en hex.

const IP_HASH_SALT = generateSalt();

function generateSalt(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashIp(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${IP_HASH_SALT}:${ip}`);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  const arr = Array.from(new Uint8Array(digest));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export const MODELOS_COMISION = ["CPA", "REVSHARE", "HIBRIDO"] as const;
export type ModeloComision = (typeof MODELOS_COMISION)[number];

export function esModeloComisionValido(s: string): s is ModeloComision {
  return (MODELOS_COMISION as readonly string[]).includes(s);
}

export const TIPOS_CONVERSION = ["REGISTRO", "FTD"] as const;
export type TipoConversion = (typeof TIPOS_CONVERSION)[number];

export function esTipoConversionValido(s: string): s is TipoConversion {
  return (TIPOS_CONVERSION as readonly string[]).includes(s);
}

/** Forma serializable del afiliado para componentes MDX y pages. */
export interface AfiliadoVista {
  id: string;
  slug: string;
  nombre: string;
  logoUrl: string | null;
  autorizadoMincetur: boolean;
  urlBase: string;
  modeloComision: string;
  montoCpa: number | null;
  porcentajeRevshare: number | null;
  bonoActual: string | null;
  metodosPago: string[];
  pros: string[];
  contras: string[];
  rating: number | null;
  activo: boolean;
  ordenDestacado: number;
  ultimaVerificacionMincetur: Date | null;
  creadoEn: Date;
  actualizadoEn: Date;
}

function mapAfiliado(a: Afiliado): AfiliadoVista {
  return {
    id: a.id,
    slug: a.slug,
    nombre: a.nombre,
    logoUrl: a.logoUrl,
    autorizadoMincetur: a.autorizadoMincetur,
    urlBase: a.urlBase,
    modeloComision: a.modeloComision,
    montoCpa: a.montoCpa,
    porcentajeRevshare: a.porcentajeRevshare ? Number(a.porcentajeRevshare) : null,
    bonoActual: a.bonoActual,
    metodosPago: a.metodosPago,
    pros: parseStringArray(a.pros),
    contras: parseStringArray(a.contras),
    rating: a.rating ? Number(a.rating) : null,
    activo: a.activo,
    ordenDestacado: a.ordenDestacado,
    ultimaVerificacionMincetur: a.ultimaVerificacionMincetur,
    creadoEn: a.creadoEn,
    actualizadoEn: a.actualizadoEn,
  };
}

function parseStringArray(json: unknown): string[] {
  if (!Array.isArray(json)) return [];
  return json.filter((x): x is string => typeof x === "string");
}

// ---------------------------------------------------------------------------
// Lectura — usado por endpoint /go/[slug], MDX, pages public/admin
// ---------------------------------------------------------------------------

/**
 * Devuelve el afiliado por slug, sin filtros (incluye inactivos). Lectura
 * simple para componentes MDX y endpoint /go/[slug] (este último filtra
 * `activo` por sí mismo para diferenciar 404 vs "Casa no disponible").
 */
export async function obtenerAfiliadoPorSlug(
  slug: string,
): Promise<AfiliadoVista | null> {
  const a = await prisma.afiliado.findUnique({ where: { slug } });
  return a ? mapAfiliado(a) : null;
}

/**
 * Lista afiliados activos + autorizados, ordenados para mostrar en listings.
 * El orden es `ordenDestacado ASC, rating DESC` — el menor `ordenDestacado`
 * va arriba (típico patrón "destacar X"), y el rating desempata.
 */
export async function obtenerActivosOrdenados(): Promise<AfiliadoVista[]> {
  const filas = await prisma.afiliado.findMany({
    where: { activo: true, autorizadoMincetur: true },
    orderBy: [{ ordenDestacado: "asc" }, { rating: "desc" }],
  });
  return filas.map(mapAfiliado);
}

/**
 * Lista TODOS los afiliados (incluye inactivos). Para /admin/afiliados.
 */
export async function listarTodos(): Promise<AfiliadoVista[]> {
  const filas = await prisma.afiliado.findMany({
    orderBy: [{ activo: "desc" }, { ordenDestacado: "asc" }, { nombre: "asc" }],
  });
  return filas.map(mapAfiliado);
}

/**
 * Devuelve afiliado por id (admin detail page). Null si no existe.
 */
export async function obtenerAfiliadoPorId(
  id: string,
): Promise<AfiliadoVista | null> {
  const a = await prisma.afiliado.findUnique({ where: { id } });
  return a ? mapAfiliado(a) : null;
}

// ---------------------------------------------------------------------------
// Tracking de clicks — `/go/[slug]`
// ---------------------------------------------------------------------------

export interface RegistrarClickInput {
  slug: string;
  pagina: string; // referer: la page de Habla! desde donde se hizo el click
  utm: Record<string, string> | null;
  request: { headers: Headers };
  userId?: string | null;
}

export interface RegistrarClickResult {
  /** URL final a la que redirigir al usuario. Null si no se debe redirigir
   *  (afiliado inexistente o inactivo — el handler decide qué responder). */
  urlBase: string | null;
  afiliadoId: string | null;
  /** true si el slug existe en BD pero está marcado `activo=false`. */
  inactivo: boolean;
}

/**
 * Registra el click fire-and-forget y devuelve la urlBase para el redirect.
 *
 * El insert NO es awaited en el caller — se dispara en background. Si la BD
 * se cae, el redirect se hace igual (lo importante es no joder al usuario).
 *
 * Diferenciamos 3 casos en el resultado:
 *   - urlBase != null            → 302 al partner
 *   - urlBase == null && inactivo→ 404 "Casa no disponible" (existe pero apagada)
 *   - urlBase == null && !inactivo → 404 "Casa no disponible" (no existe)
 *
 * El handler usa el mismo mensaje de 404 para ambos casos inválidos para no
 * filtrar info sobre qué slugs existen.
 */
export async function registrarClick(
  input: RegistrarClickInput,
): Promise<RegistrarClickResult> {
  const afiliado = await prisma.afiliado.findUnique({
    where: { slug: input.slug },
    select: { id: true, urlBase: true, activo: true },
  });

  if (!afiliado) {
    return { urlBase: null, afiliadoId: null, inactivo: false };
  }
  if (!afiliado.activo) {
    return { urlBase: null, afiliadoId: afiliado.id, inactivo: true };
  }

  // Hash IP + país antes de soltar la promesa de insert. El insert va
  // fire-and-forget para no bloquear el redirect.
  const ip = extractIp(input.request.headers);
  const ipHashPromise = hashIp(ip);
  const pais = extractCountry(input.request.headers);
  const userAgent =
    input.request.headers.get("user-agent")?.slice(0, 500) ?? null;

  void ipHashPromise
    .then((ipHash) =>
      prisma.clickAfiliado.create({
        data: {
          afiliadoId: afiliado.id,
          userId: input.userId ?? null,
          pagina: input.pagina.slice(0, 500),
          utm: input.utm
            ? (input.utm as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          ipHash,
          userAgent,
          pais,
        },
      }),
    )
    .catch((err) => {
      logger.warn(
        { err, slug: input.slug, source: "afiliacion:registrarClick" },
        "registrarClick: persistencia falló (descartado)",
      );
    });

  return { urlBase: afiliado.urlBase, afiliadoId: afiliado.id, inactivo: false };
}

// ---------------------------------------------------------------------------
// CRUD admin de afiliados
// ---------------------------------------------------------------------------

export interface CrearAfiliadoInput {
  slug: string;
  nombre: string;
  logoUrl?: string | null;
  autorizadoMincetur?: boolean;
  urlBase: string;
  modeloComision: ModeloComision;
  montoCpa?: number | null;
  porcentajeRevshare?: number | null;
  bonoActual?: string | null;
  metodosPago?: string[];
  pros?: string[];
  contras?: string[];
  rating?: number | null;
  activo?: boolean;
  ordenDestacado?: number;
}

export async function crearAfiliado(
  input: CrearAfiliadoInput,
): Promise<AfiliadoVista> {
  const a = await prisma.afiliado.create({
    data: {
      slug: input.slug,
      nombre: input.nombre,
      logoUrl: input.logoUrl ?? null,
      autorizadoMincetur: input.autorizadoMincetur ?? true,
      urlBase: input.urlBase,
      modeloComision: input.modeloComision,
      montoCpa: input.montoCpa ?? null,
      porcentajeRevshare:
        input.porcentajeRevshare !== undefined && input.porcentajeRevshare !== null
          ? new Prisma.Decimal(input.porcentajeRevshare)
          : null,
      bonoActual: input.bonoActual ?? null,
      metodosPago: input.metodosPago ?? [],
      pros: input.pros
        ? (input.pros as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      contras: input.contras
        ? (input.contras as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      rating:
        input.rating !== undefined && input.rating !== null
          ? new Prisma.Decimal(input.rating)
          : null,
      activo: input.activo ?? true,
      ordenDestacado: input.ordenDestacado ?? 100,
    },
  });
  return mapAfiliado(a);
}

export interface ActualizarAfiliadoInput {
  slug?: string;
  nombre?: string;
  logoUrl?: string | null;
  autorizadoMincetur?: boolean;
  urlBase?: string;
  modeloComision?: ModeloComision;
  montoCpa?: number | null;
  porcentajeRevshare?: number | null;
  bonoActual?: string | null;
  metodosPago?: string[];
  pros?: string[];
  contras?: string[];
  rating?: number | null;
  activo?: boolean;
  ordenDestacado?: number;
  ultimaVerificacionMincetur?: Date | null;
}

export async function actualizarAfiliado(
  id: string,
  patch: ActualizarAfiliadoInput,
): Promise<AfiliadoVista> {
  const data: Prisma.AfiliadoUpdateInput = {};
  if (patch.slug !== undefined) data.slug = patch.slug;
  if (patch.nombre !== undefined) data.nombre = patch.nombre;
  if (patch.logoUrl !== undefined) data.logoUrl = patch.logoUrl;
  if (patch.autorizadoMincetur !== undefined)
    data.autorizadoMincetur = patch.autorizadoMincetur;
  if (patch.urlBase !== undefined) data.urlBase = patch.urlBase;
  if (patch.modeloComision !== undefined)
    data.modeloComision = patch.modeloComision;
  if (patch.montoCpa !== undefined) data.montoCpa = patch.montoCpa;
  if (patch.porcentajeRevshare !== undefined) {
    data.porcentajeRevshare =
      patch.porcentajeRevshare === null
        ? null
        : new Prisma.Decimal(patch.porcentajeRevshare);
  }
  if (patch.bonoActual !== undefined) data.bonoActual = patch.bonoActual;
  if (patch.metodosPago !== undefined) data.metodosPago = patch.metodosPago;
  if (patch.pros !== undefined) {
    data.pros = patch.pros as unknown as Prisma.InputJsonValue;
  }
  if (patch.contras !== undefined) {
    data.contras = patch.contras as unknown as Prisma.InputJsonValue;
  }
  if (patch.rating !== undefined) {
    data.rating =
      patch.rating === null ? null : new Prisma.Decimal(patch.rating);
  }
  if (patch.activo !== undefined) data.activo = patch.activo;
  if (patch.ordenDestacado !== undefined)
    data.ordenDestacado = patch.ordenDestacado;
  if (patch.ultimaVerificacionMincetur !== undefined)
    data.ultimaVerificacionMincetur = patch.ultimaVerificacionMincetur;

  const a = await prisma.afiliado.update({ where: { id }, data });
  return mapAfiliado(a);
}

/**
 * Soft delete: setea `activo=false`. Conservamos los clicks/conversiones
 * históricos. Si en el futuro hay que reactivar, se hace por PATCH.
 */
export async function desactivarAfiliado(id: string): Promise<AfiliadoVista> {
  return actualizarAfiliado(id, { activo: false });
}

// ---------------------------------------------------------------------------
// CRUD de conversiones
// ---------------------------------------------------------------------------

export interface RegistrarConversionInput {
  afiliadoId: string;
  tipo: TipoConversion;
  montoComision?: number | null;
  reportadoEn: Date;
  notas?: string | null;
  userId?: string | null;
}

export async function registrarConversionManual(
  input: RegistrarConversionInput,
) {
  return prisma.conversionAfiliado.create({
    data: {
      afiliadoId: input.afiliadoId,
      userId: input.userId ?? null,
      tipo: input.tipo,
      montoComision:
        input.montoComision !== undefined && input.montoComision !== null
          ? new Prisma.Decimal(input.montoComision)
          : null,
      reportadoEn: input.reportadoEn,
      notas: input.notas ?? null,
    },
  });
}

export interface ConversionFila {
  id: string;
  afiliadoId: string;
  afiliadoNombre: string;
  afiliadoSlug: string;
  tipo: string;
  montoComision: number | null;
  reportadoEn: Date;
  notas: string | null;
  creadoEn: Date;
}

export async function listarConversiones(filtros: {
  afiliadoId?: string;
  desde?: Date;
  hasta?: Date;
  limit?: number;
} = {}): Promise<ConversionFila[]> {
  const where: Prisma.ConversionAfiliadoWhereInput = {};
  if (filtros.afiliadoId) where.afiliadoId = filtros.afiliadoId;
  if (filtros.desde || filtros.hasta) {
    where.reportadoEn = {};
    if (filtros.desde) where.reportadoEn.gte = filtros.desde;
    if (filtros.hasta) where.reportadoEn.lte = filtros.hasta;
  }
  const limit = Math.min(500, Math.max(1, filtros.limit ?? 200));

  const rows = await prisma.conversionAfiliado.findMany({
    where,
    include: { afiliado: { select: { nombre: true, slug: true } } },
    orderBy: { reportadoEn: "desc" },
    take: limit,
  });

  return rows.map((r) => ({
    id: r.id,
    afiliadoId: r.afiliadoId,
    afiliadoNombre: r.afiliado.nombre,
    afiliadoSlug: r.afiliado.slug,
    tipo: r.tipo,
    montoComision: r.montoComision ? Number(r.montoComision) : null,
    reportadoEn: r.reportadoEn,
    notas: r.notas,
    creadoEn: r.creadoEn,
  }));
}

// ---------------------------------------------------------------------------
// Stats por afiliado — `/admin/afiliados/[id]`
// ---------------------------------------------------------------------------

export type PeriodoStats = "7d" | "30d" | "90d";

export interface StatsAfiliado {
  periodo: PeriodoStats;
  desde: Date;
  hasta: Date;
  clicksTotales: number;
  clicksUnicos: number; // por ipHash (aproxima usuarios únicos)
  serieClicks: Array<{ dia: string; clicks: number }>;
  conversionesTotales: number;
  conversionesPorTipo: Array<{ tipo: string; count: number }>;
  revenueAcumuladoSoles: number;
}

const DIAS_POR_PERIODO: Record<PeriodoStats, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export async function obtenerStatsAfiliado(input: {
  slug?: string;
  afiliadoId?: string;
  periodo?: PeriodoStats;
}): Promise<StatsAfiliado | null> {
  const periodo = input.periodo ?? "30d";
  const dias = DIAS_POR_PERIODO[periodo];
  const hasta = new Date();
  const desde = new Date(hasta.getTime() - dias * 24 * 60 * 60 * 1000);

  let afiliadoId = input.afiliadoId;
  if (!afiliadoId && input.slug) {
    const a = await prisma.afiliado.findUnique({
      where: { slug: input.slug },
      select: { id: true },
    });
    if (!a) return null;
    afiliadoId = a.id;
  }
  if (!afiliadoId) return null;

  const [clicksTotales, clicksUnicosRaw, serieRaw, conversiones] =
    await Promise.all([
      prisma.clickAfiliado.count({
        where: { afiliadoId, creadoEn: { gte: desde, lte: hasta } },
      }),
      prisma.$queryRaw<Array<{ uniques: bigint }>>(Prisma.sql`
        SELECT COUNT(DISTINCT "ipHash") AS uniques
        FROM clicks_afiliados
        WHERE "afiliadoId" = ${afiliadoId}
          AND "creadoEn" >= ${desde}
          AND "creadoEn" <= ${hasta}
      `),
      prisma.$queryRaw<Array<{ dia: Date; clicks: bigint }>>(Prisma.sql`
        SELECT date_trunc('day', "creadoEn") AS dia, COUNT(*) AS clicks
        FROM clicks_afiliados
        WHERE "afiliadoId" = ${afiliadoId}
          AND "creadoEn" >= ${desde}
          AND "creadoEn" <= ${hasta}
        GROUP BY date_trunc('day', "creadoEn")
        ORDER BY dia ASC
      `),
      prisma.conversionAfiliado.findMany({
        where: { afiliadoId, reportadoEn: { gte: desde, lte: hasta } },
        select: { tipo: true, montoComision: true },
      }),
    ]);

  const conversionesPorTipoMap = new Map<string, number>();
  let revenueAcumulado = 0;
  for (const c of conversiones) {
    conversionesPorTipoMap.set(
      c.tipo,
      (conversionesPorTipoMap.get(c.tipo) ?? 0) + 1,
    );
    if (c.montoComision) revenueAcumulado += Number(c.montoComision);
  }

  return {
    periodo,
    desde,
    hasta,
    clicksTotales,
    clicksUnicos: Number(clicksUnicosRaw[0]?.uniques ?? 0),
    serieClicks: serieRaw.map((r) => ({
      dia: r.dia.toISOString().slice(0, 10),
      clicks: Number(r.clicks),
    })),
    conversionesTotales: conversiones.length,
    conversionesPorTipo: [...conversionesPorTipoMap.entries()].map(
      ([tipo, count]) => ({ tipo, count }),
    ),
    revenueAcumuladoSoles: Math.round(revenueAcumulado * 100) / 100,
  };
}

/**
 * Para la tabla principal `/admin/afiliados`: cuenta clicks 7d, 30d, y
 * conversiones del mes en curso por afiliado en una sola pasada.
 */
export async function obtenerStatsResumenTodos(): Promise<
  Map<
    string,
    {
      clicks7d: number;
      clicks30d: number;
      conversionesMes: number;
    }
  >
> {
  const ahora = new Date();
  const hace7d = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
  const hace30d = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

  const [clicks7d, clicks30d, convsMes] = await Promise.all([
    prisma.clickAfiliado.groupBy({
      by: ["afiliadoId"],
      where: { creadoEn: { gte: hace7d } },
      _count: { _all: true },
    }),
    prisma.clickAfiliado.groupBy({
      by: ["afiliadoId"],
      where: { creadoEn: { gte: hace30d } },
      _count: { _all: true },
    }),
    prisma.conversionAfiliado.groupBy({
      by: ["afiliadoId"],
      where: { reportadoEn: { gte: inicioMes } },
      _count: { _all: true },
    }),
  ]);

  const mapa = new Map<
    string,
    { clicks7d: number; clicks30d: number; conversionesMes: number }
  >();
  function ensure(id: string) {
    let e = mapa.get(id);
    if (!e) {
      e = { clicks7d: 0, clicks30d: 0, conversionesMes: 0 };
      mapa.set(id, e);
    }
    return e;
  }
  for (const r of clicks7d) ensure(r.afiliadoId).clicks7d = r._count._all;
  for (const r of clicks30d) ensure(r.afiliadoId).clicks30d = r._count._all;
  for (const r of convsMes)
    ensure(r.afiliadoId).conversionesMes = r._count._all;

  return mapa;
}

/**
 * Histórico paginado de clicks de un afiliado para `/admin/afiliados/[id]`.
 */
export async function listarClicksDeAfiliado(input: {
  afiliadoId: string;
  page?: number;
  pageSize?: number;
}): Promise<{
  rows: Array<{
    id: string;
    pagina: string;
    pais: string | null;
    userAgent: string | null;
    userId: string | null;
    username: string | null;
    creadoEn: Date;
  }>;
  total: number;
  page: number;
  totalPages: number;
}> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, input.pageSize ?? 50));

  const [total, rows] = await Promise.all([
    prisma.clickAfiliado.count({ where: { afiliadoId: input.afiliadoId } }),
    prisma.clickAfiliado.findMany({
      where: { afiliadoId: input.afiliadoId },
      include: { usuario: { select: { username: true } } },
      orderBy: { creadoEn: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      pagina: r.pagina,
      pais: r.pais,
      userAgent: r.userAgent,
      userId: r.userId,
      username: r.usuario?.username ?? null,
      creadoEn: r.creadoEn,
    })),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// ---------------------------------------------------------------------------
// Helpers de headers (Cloudflare)
// ---------------------------------------------------------------------------

function extractCountry(headers: Headers): string | null {
  const cf = headers.get("cf-ipcountry");
  if (cf && cf !== "XX") return cf.toUpperCase().slice(0, 2);
  const vercel = headers.get("x-vercel-ip-country");
  if (vercel) return vercel.toUpperCase().slice(0, 2);
  return null;
}

function extractIp(headers: Headers): string {
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

// ---------------------------------------------------------------------------
// Utility: parser de UTM params
// ---------------------------------------------------------------------------

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

export function parsearUtm(searchParams: URLSearchParams): Record<string, string> | null {
  const utm: Record<string, string> = {};
  for (const k of UTM_KEYS) {
    const v = searchParams.get(k);
    if (v) utm[k] = v.slice(0, 200);
  }
  return Object.keys(utm).length > 0 ? utm : null;
}
