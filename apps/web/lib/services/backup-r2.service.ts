// Lote 7 — Backups automatizados de Postgres a Cloudflare R2.
//
// Flujo:
//   1. Spawn `pg_dump -Fc` (formato custom, comprimido) sobre DATABASE_URL.
//   2. Buffer del stdout en memoria (la BD del MVP es pequeña; switch a
//      lib-storage Upload solo cuando el dump supere ~100 MB).
//   3. Upload a R2 con key `daily/habla-YYYY-MM-DD.dump`.
//   4. El día 1 del mes (UTC) se sube además `monthly/habla-YYYY-MM.dump`.
//   5. Aplica retención: borra dailies con > 30 días. Mensuales: indefinido.
//   6. Inserta row en `BackupLog` (alimenta `/api/health`).
//
// Lote 4 (Abr 2026) eliminó la alerta de email tras 2 fallos consecutivos
// junto con el resto de la maquinaria contable. El monitoreo activo se
// re-introduce en Lote 6 con el sistema de eventos in-house.
//
// Pre-requisito: el binario `pg_dump` versión >= 16 tiene que estar en
// el PATH. El Dockerfile instala `postgresql18-client` (Railway corre
// Postgres 18.3 desde Abr 2026).
//
// CAVEAT: si en el futuro escalamos web a >1 réplica, cada réplica
// haría su propio backup. Soluciones cuando llegue ese punto: leader-lock
// en Redis o mover el job a un service dedicado con replicas=1. Para MVP
// con 1 réplica el guard `__hablaCronRegistered` en instrumentation.ts
// alcanza.

import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type ListObjectsV2CommandOutput,
} from "@aws-sdk/client-s3";
import { prisma } from "@habla/db";
// Sin prefix `node:` — Webpack 5 no lo maneja nativamente y rompe el
// build con UnhandledSchemeError. Los módulos siguen siendo built-in y
// quedan externos en el server bundle.
import { spawn } from "child_process";
import { logger } from "./logger";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const RETENTION_DAYS = 30;

/** Naming: `daily/habla-2026-04-27.dump` */
const DAILY_KEY_RE = /^daily\/habla-(\d{4})-(\d{2})-(\d{2})\.dump$/;

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export interface BackupResult {
  ok: boolean;
  archivo?: string;
  /** Solo presente si fue día 1 del mes y se subió también el monthly. */
  archivoMensual?: string;
  bytes?: number;
  durationMs?: number;
  retencionAplicada?: { kept: number; deleted: number };
  error?: string;
}

export interface BackupLogRow {
  id: string;
  fechaIntento: Date;
  ok: boolean;
  archivo: string | null;
  bytes: number | null;
  durationMs: number | null;
  errorMsg: string | null;
}

// ---------------------------------------------------------------------------
// Configuración R2
// ---------------------------------------------------------------------------

interface R2Env {
  accountId: string;
  bucket: string;
  endpoint: string;
  accessKey: string;
  secretKey: string;
}

function readR2Env(): R2Env | null {
  // R2_ACCOUNT_ID es informativo (ya está embebido en R2_ENDPOINT) pero
  // exigimos su presencia como sanity check de configuración completa.
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET_BACKUPS;
  const endpoint = process.env.R2_ENDPOINT;
  const accessKey = process.env.R2_ACCESS_KEY_ID;
  const secretKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !bucket || !endpoint || !accessKey || !secretKey) {
    return null;
  }
  return { accountId, bucket, endpoint, accessKey, secretKey };
}

export function isR2Configured(): boolean {
  return readR2Env() !== null;
}

let _s3: S3Client | null = null;

function getS3Client(env: R2Env): S3Client {
  if (_s3) return _s3;
  // R2 es S3-compatible pero requiere `region: "auto"` y endpoint custom.
  // `forcePathStyle: true` es necesario; el SDK por default usa
  // virtual-hosted-style (`<bucket>.<host>`) que R2 no acepta universalmente.
  _s3 = new S3Client({
    region: "auto",
    endpoint: env.endpoint,
    credentials: {
      accessKeyId: env.accessKey,
      secretAccessKey: env.secretKey,
    },
    forcePathStyle: true,
  });
  return _s3;
}

// ---------------------------------------------------------------------------
// pg_dump
// ---------------------------------------------------------------------------

/**
 * Ejecuta `pg_dump -Fc` apuntando a `databaseUrl` y devuelve el dump
 * binario como Buffer. Resuelve solo si pg_dump exit 0.
 *
 * Usamos formato custom (-Fc) porque:
 *   - Trae compresión incorporada (sin gzip externo).
 *   - `pg_restore` puede restaurar selectivamente (tablas individuales).
 *   - Es la recomendación oficial de Postgres para dumps de prod.
 */
async function pgDumpToBuffer(databaseUrl: string): Promise<Buffer> {
  // Args: `--no-owner --no-privileges` evitan que la restauración requiera
  // el rol exacto de prod (útil cuando restauramos a una BD local con
  // rol distinto).
  const child = spawn(
    "pg_dump",
    ["-Fc", "--no-owner", "--no-privileges", databaseUrl],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  const chunks: Buffer[] = [];
  let stderrBuf = "";

  child.stdout.on("data", (chunk: Buffer) => {
    chunks.push(chunk);
  });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    stderrBuf += chunk;
    if (stderrBuf.length > 4096) stderrBuf = stderrBuf.slice(-4096);
  });

  return new Promise<Buffer>((resolve, reject) => {
    child.on("error", (err) => {
      reject(
        new Error(
          err.message.includes("ENOENT")
            ? "pg_dump no encontrado en PATH (¿postgresql-client instalado?)"
            : err.message,
        ),
      );
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(new Error(`pg_dump exit ${code}: ${stderrBuf.trim()}`));
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Naming + fecha
// ---------------------------------------------------------------------------

interface NamingPayload {
  dailyKey: string;
  monthlyKey: string | null;
  yyyy: string;
  mm: string;
  dd: string;
}

function computeNaming(now: Date): NamingPayload {
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const dailyKey = `daily/habla-${yyyy}-${mm}-${dd}.dump`;
  const monthlyKey = dd === "01" ? `monthly/habla-${yyyy}-${mm}.dump` : null;
  return { dailyKey, monthlyKey, yyyy, mm, dd };
}

// ---------------------------------------------------------------------------
// Retención
// ---------------------------------------------------------------------------

/**
 * Borra dailies con fecha > 30 días. Los mensuales nunca se borran.
 * Exportada como función separada para que tests unitarios puedan
 * invocarla independientemente del flujo completo.
 */
export async function aplicarRetencion(): Promise<{
  kept: number;
  deleted: number;
}> {
  const env = readR2Env();
  if (!env) {
    throw new Error(
      "R2 no configurado: faltan R2_ACCOUNT_ID/BUCKET_BACKUPS/ENDPOINT/ACCESS_KEY_ID/SECRET_ACCESS_KEY",
    );
  }
  const client = getS3Client(env);
  const cutoffMs = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const toDelete: string[] = [];
  let kept = 0;
  let token: string | undefined = undefined;

  do {
    const resp: ListObjectsV2CommandOutput = await client.send(
      new ListObjectsV2Command({
        Bucket: env.bucket,
        Prefix: "daily/",
        ContinuationToken: token,
      }),
    );
    for (const obj of resp.Contents ?? []) {
      if (!obj.Key) continue;
      const m = DAILY_KEY_RE.exec(obj.Key);
      if (!m) {
        kept++;
        continue;
      }
      const [, yyyy, mm, dd] = m;
      const dateMs = Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd));
      if (dateMs < cutoffMs) {
        toDelete.push(obj.Key);
      } else {
        kept++;
      }
    }
    token = resp.NextContinuationToken;
  } while (token);

  // S3 admite hasta 1000 keys por DeleteObjects.
  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += 1000) {
    const batch = toDelete.slice(i, i + 1000);
    await client.send(
      new DeleteObjectsCommand({
        Bucket: env.bucket,
        Delete: { Objects: batch.map((Key) => ({ Key })) },
      }),
    );
    deleted += batch.length;
  }

  return { kept, deleted };
}

// ---------------------------------------------------------------------------
// Persistencia de intentos
// ---------------------------------------------------------------------------

async function registrarIntento(input: {
  ok: boolean;
  archivo: string | null;
  bytes: number | null;
  durationMs: number | null;
  errorMsg: string | null;
}): Promise<void> {
  await prisma.backupLog.create({
    data: {
      ok: input.ok,
      archivo: input.archivo,
      bytes: input.bytes,
      durationMs: input.durationMs,
      errorMsg: input.errorMsg,
    },
  });
}

// ---------------------------------------------------------------------------
// Entry point: backup diario completo
// ---------------------------------------------------------------------------

/**
 * Flujo completo: dump → upload daily (+ monthly si día 1) → retención.
 * Independientemente del resultado, registra el intento en `BackupLog`
 * (lo lee `/api/health` y la página `/admin/backup/historial`).
 */
export async function ejecutarBackupDiario(): Promise<BackupResult> {
  const started = Date.now();
  const env = readR2Env();
  if (!env) {
    const error =
      "R2 no configurado: faltan R2_ACCOUNT_ID/BUCKET_BACKUPS/ENDPOINT/ACCESS_KEY_ID/SECRET_ACCESS_KEY";
    await registrarIntento({
      ok: false,
      archivo: null,
      bytes: null,
      durationMs: 0,
      errorMsg: error,
    });
    return { ok: false, error };
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    const error = "DATABASE_URL ausente";
    await registrarIntento({
      ok: false,
      archivo: null,
      bytes: null,
      durationMs: 0,
      errorMsg: error,
    });
    return { ok: false, error };
  }

  const naming = computeNaming(new Date());
  const client = getS3Client(env);

  try {
    const dump = await pgDumpToBuffer(databaseUrl);
    if (dump.length < 1024) {
      throw new Error(
        `dump demasiado chico (${dump.length} bytes); pg_dump probablemente falló silenciosamente`,
      );
    }

    await client.send(
      new PutObjectCommand({
        Bucket: env.bucket,
        Key: naming.dailyKey,
        Body: dump,
        ContentType: "application/octet-stream",
      }),
    );

    let archivoMensual: string | undefined;
    if (naming.monthlyKey) {
      await client.send(
        new PutObjectCommand({
          Bucket: env.bucket,
          Key: naming.monthlyKey,
          Body: dump,
          ContentType: "application/octet-stream",
        }),
      );
      archivoMensual = naming.monthlyKey;
    }

    const durationMs = Date.now() - started;
    logger.info(
      { archivo: naming.dailyKey, archivoMensual, bytes: dump.length, durationMs },
      "backup-r2: subida exitosa",
    );

    let retencionAplicada: { kept: number; deleted: number } | undefined;
    try {
      retencionAplicada = await aplicarRetencion();
      logger.info(
        { kept: retencionAplicada.kept, deleted: retencionAplicada.deleted },
        "backup-r2: retención aplicada",
      );
    } catch (err) {
      // Retención fallida no rompe el éxito del backup principal — solo warn.
      logger.warn(
        { err: (err as Error).message },
        "backup-r2: retención falló (no crítico)",
      );
    }

    await registrarIntento({
      ok: true,
      archivo: naming.dailyKey,
      bytes: dump.length,
      durationMs,
      errorMsg: null,
    });

    return {
      ok: true,
      archivo: naming.dailyKey,
      archivoMensual,
      bytes: dump.length,
      durationMs,
      retencionAplicada,
    };
  } catch (err) {
    const errorMsg = (err as Error).message ?? String(err);
    const durationMs = Date.now() - started;
    logger.error({ err: errorMsg, durationMs }, "backup-r2: falló");
    await registrarIntento({
      ok: false,
      archivo: null,
      bytes: null,
      durationMs,
      errorMsg,
    });
    return { ok: false, error: errorMsg, durationMs };
  }
}

// ---------------------------------------------------------------------------
// Lectura del historial (para endpoint admin + health check)
// ---------------------------------------------------------------------------

/** Devuelve las últimas N filas de BackupLog, más recientes primero. */
export async function listarIntentos(limit = 30): Promise<BackupLogRow[]> {
  return prisma.backupLog.findMany({
    orderBy: { fechaIntento: "desc" },
    take: limit,
  });
}

/** Último intento exitoso (para health check / decisiones del job). */
export async function ultimoExitoso(): Promise<BackupLogRow | null> {
  return prisma.backupLog.findFirst({
    where: { ok: true },
    orderBy: { fechaIntento: "desc" },
  });
}

export type BackupHealthState = "ok" | "stale" | "missing" | "unconfigured";

const STALE_AFTER_MS = 26 * 60 * 60 * 1000; // 26h

export async function getBackupHealth(): Promise<{
  state: BackupHealthState;
  lastSuccessAt: string | null;
  ageHours: number | null;
}> {
  if (!isR2Configured()) {
    return { state: "unconfigured", lastSuccessAt: null, ageHours: null };
  }
  const last = await ultimoExitoso();
  if (!last) {
    return { state: "missing", lastSuccessAt: null, ageHours: null };
  }
  const ageMs = Date.now() - last.fechaIntento.getTime();
  const ageHours = ageMs / (60 * 60 * 1000);
  return {
    state: ageMs > STALE_AFTER_MS ? "stale" : "ok",
    lastSuccessAt: last.fechaIntento.toISOString(),
    ageHours: Math.round(ageHours * 10) / 10,
  };
}
