// Backup automatizado de Postgres a Cloudflare R2 (Lote 7).
//
// El job corre 1x/día (in-process desde instrumentation.ts) y también
// puede dispararse manualmente vía POST /api/cron/backup-db.
//
// Flujo:
//   1. Spawn `pg_dump` apuntando a DATABASE_URL.
//   2. Stream stdout → gzip → archivo temporal en /tmp.
//   3. Upload del archivo a R2 con key `habla-{YYYY-MM-DD}-{HHmm}.sql.gz`.
//   4. Aplica retención: borra > 30 días que no sean día 1 del mes.
//   5. Limpia el archivo local.
//
// Estado in-memory (`state`) sobrevive entre llamadas dentro del mismo
// container — al boot lo hidratamos desde R2 (`hydrateBackupStateFromR2`)
// para que un restart no resetee el "último backup exitoso".
//
// Pre-requisito: el binario `pg_dump` tiene que estar en el PATH. El
// Dockerfile instala `postgresql16-client` en la imagen base.
//
// CAVEAT: si en el futuro se escala la web a >1 réplica, cada réplica
// haría su propio backup. Soluciones cuando llegue ese punto: leader-lock
// en Redis o mover el job a un service dedicado con replicas=1. Para MVP
// con 1 réplica, basta con el guard `__hablaCronRegistered`.

import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type _Object,
  type ListObjectsV2CommandOutput,
} from "@aws-sdk/client-s3";
import * as Sentry from "@sentry/nextjs";
// Sin prefix `node:` — Webpack 5 no lo maneja nativamente y rompe el
// build con UnhandledSchemeError. Los módulos siguen siendo built-in y
// quedan externos en el server bundle.
import { spawn } from "child_process";
import { createWriteStream } from "fs";
import { readFile, stat, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { pipeline } from "stream/promises";
import { createGzip } from "zlib";
import { logger } from "./logger";

const RETENTION_DAYS = 30;
const STALE_AFTER_MS = 26 * 60 * 60 * 1000; // 26h
const KEY_RE = /^habla-(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})\.sql\.gz$/;

function envR2(): {
  bucket?: string;
  endpoint?: string;
  accessKey?: string;
  secretKey?: string;
} {
  return {
    bucket: process.env.R2_BUCKET,
    endpoint: process.env.R2_ENDPOINT,
    accessKey: process.env.R2_ACCESS_KEY_ID,
    secretKey: process.env.R2_SECRET_ACCESS_KEY,
  };
}

export function isR2Configured(): boolean {
  const { bucket, endpoint, accessKey, secretKey } = envR2();
  return Boolean(bucket && endpoint && accessKey && secretKey);
}

let _s3: S3Client | null = null;

function getS3Client(): S3Client {
  if (_s3) return _s3;
  const { endpoint, accessKey, secretKey } = envR2();
  if (!endpoint || !accessKey || !secretKey) {
    throw new Error("R2 no configurado: faltan R2_ENDPOINT/KEY/SECRET");
  }
  // R2 es S3-compatible pero requiere `region: "auto"` y endpoint custom.
  // `forcePathStyle: true` también es necesario; el SDK por default usa
  // virtual-hosted-style (`<bucket>.<host>`) que R2 no soporta para todos
  // los endpoints.
  _s3 = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    forcePathStyle: true,
  });
  return _s3;
}

// State in-memory. Persiste mientras el container vive; al boot se hidrata
// desde R2 vía `hydrateBackupStateFromR2()`.
interface BackupState {
  lastSuccessAt: Date | null;
  lastAttemptAt: Date | null;
  lastFailureReason: string | null;
  consecutiveFailures: number;
  hydrated: boolean;
}

const state: BackupState = {
  lastSuccessAt: null,
  lastAttemptAt: null,
  lastFailureReason: null,
  consecutiveFailures: 0,
  hydrated: false,
};

export function getBackupState(): Readonly<BackupState> {
  return { ...state };
}

export type BackupHealthState =
  | "ok"
  | "stale"
  | "missing"
  | "unconfigured";

export function getBackupHealth(): {
  state: BackupHealthState;
  lastSuccessAt: string | null;
  ageHours: number | null;
} {
  if (!isR2Configured()) {
    return { state: "unconfigured", lastSuccessAt: null, ageHours: null };
  }
  if (!state.lastSuccessAt) {
    return { state: "missing", lastSuccessAt: null, ageHours: null };
  }
  const ageMs = Date.now() - state.lastSuccessAt.getTime();
  const ageHours = ageMs / (60 * 60 * 1000);
  return {
    state: ageMs > STALE_AFTER_MS ? "stale" : "ok",
    lastSuccessAt: state.lastSuccessAt.toISOString(),
    ageHours: Math.round(ageHours * 10) / 10,
  };
}

/**
 * Hidrata `state.lastSuccessAt` desde R2 listando los backups existentes.
 * Llamar al boot del container para que un restart no haga aparecer el
 * sistema como "missing" cuando en realidad ayer hubo backup ok.
 */
export async function hydrateBackupStateFromR2(): Promise<void> {
  if (state.hydrated) return;
  if (!isR2Configured()) {
    state.hydrated = true;
    return;
  }
  try {
    const client = getS3Client();
    const { bucket } = envR2();
    let mostRecent: Date | null = null;
    let token: string | undefined = undefined;
    do {
      const resp: ListObjectsV2CommandOutput = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket!,
          ContinuationToken: token,
        }),
      );
      for (const obj of resp.Contents ?? []) {
        if (!obj.Key || !obj.LastModified) continue;
        if (!KEY_RE.test(obj.Key)) continue;
        if (!mostRecent || obj.LastModified > mostRecent) {
          mostRecent = obj.LastModified;
        }
      }
      token = resp.NextContinuationToken;
    } while (token);
    if (mostRecent) {
      state.lastSuccessAt = mostRecent;
      logger.info(
        { lastSuccessAt: mostRecent.toISOString() },
        "backup: state hidratado desde R2",
      );
    } else {
      logger.info("backup: bucket vacío o sin backups previos");
    }
  } catch (err) {
    logger.warn(
      { err: (err as Error).message },
      "backup: no se pudo hidratar state desde R2 (no crítico)",
    );
  } finally {
    state.hydrated = true;
  }
}

/**
 * Ejecuta `pg_dump $DATABASE_URL`, comprime stdout con gzip, y escribe
 * a `outPath`. Resuelve si pg_dump exit 0 + el pipeline terminó OK.
 */
async function pgDumpToGzip(
  databaseUrl: string,
  outPath: string,
): Promise<void> {
  // Args: `--no-owner --no-privileges` reducen el dump y evitan que la
  // restauración requiera el rol exacto de prod (útil cuando restauramos
  // a una BD local con rol distinto).
  const child = spawn(
    "pg_dump",
    [databaseUrl, "--no-owner", "--no-privileges"],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  let stderrBuf = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    stderrBuf += chunk;
    if (stderrBuf.length > 4096) stderrBuf = stderrBuf.slice(-4096);
  });

  const fileStream = createWriteStream(outPath);
  const gzip = createGzip({ level: 6 });

  const pipelinePromise = pipeline(child.stdout, gzip, fileStream);
  const childPromise = new Promise<void>((resolve, reject) => {
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
      if (code === 0) resolve();
      else reject(new Error(`pg_dump exit ${code}: ${stderrBuf.trim()}`));
    });
  });

  await Promise.all([pipelinePromise, childPromise]);
}

/**
 * Aplica la política de retención sobre el bucket:
 *   - Borra backups con > 30 días que NO sean del día 1 del mes.
 *   - Backups del día 1 del mes se conservan indefinidamente.
 *   - Cualquier objeto que no matchee el naming `habla-*.sql.gz` se ignora.
 */
async function applyRetention(
  client: S3Client,
  bucket: string,
): Promise<{ kept: number; deleted: number }> {
  const cutoffMs = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const toDelete: string[] = [];
  let kept = 0;
  let token: string | undefined = undefined;

  do {
    const resp: ListObjectsV2CommandOutput = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }),
    );
    for (const obj of resp.Contents ?? []) {
      if (!obj.Key) continue;
      const m = KEY_RE.exec(obj.Key);
      if (!m) {
        kept++;
        continue;
      }
      const [, yyyy, mm, dd] = m;
      // Día 1 del mes → retención indefinida.
      if (dd === "01") {
        kept++;
        continue;
      }
      // Usamos la fecha del nombre (UTC) para decidir, no LastModified —
      // el nombre es la verdad de cuándo se intentó el backup.
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
        Bucket: bucket,
        Delete: { Objects: batch.map((Key) => ({ Key })) },
      }),
    );
    deleted += batch.length;
  }

  return { kept, deleted };
}

export interface BackupResult {
  ok: boolean;
  key?: string;
  sizeBytes?: number;
  durationMs?: number;
  retention?: { kept: number; deleted: number };
  reason?: string;
}

/**
 * Ejecuta el flujo completo: dump → gzip → upload a R2 → retención.
 * Maneja errores con Sentry alerts si hay 2+ fallos seguidos.
 */
export async function runBackup(): Promise<BackupResult> {
  const started = Date.now();
  state.lastAttemptAt = new Date();

  if (!isR2Configured()) {
    return { ok: false, reason: "R2 no configurado en este ambiente" };
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return { ok: false, reason: "DATABASE_URL ausente" };
  }

  const { bucket } = envR2();
  const client = getS3Client();

  // Naming: timestamp UTC para evitar colisiones por DST de Lima.
  const ts = new Date();
  const yyyy = ts.getUTCFullYear();
  const mm = String(ts.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(ts.getUTCDate()).padStart(2, "0");
  const hh = String(ts.getUTCHours()).padStart(2, "0");
  const min = String(ts.getUTCMinutes()).padStart(2, "0");
  const key = `habla-${yyyy}-${mm}-${dd}-${hh}${min}.sql.gz`;

  const outPath = join(
    tmpdir(),
    `habla-backup-${ts.getTime()}-${process.pid}.sql.gz`,
  );

  try {
    await pgDumpToGzip(databaseUrl, outPath);
    const stats = await stat(outPath);
    if (stats.size < 1024) {
      throw new Error(
        `archivo demasiado chico (${stats.size} bytes); pg_dump probablemente falló silenciosamente`,
      );
    }

    const body = await readFile(outPath);
    await client.send(
      new PutObjectCommand({
        Bucket: bucket!,
        Key: key,
        Body: body,
        ContentType: "application/gzip",
      }),
    );

    state.lastSuccessAt = new Date();
    state.lastFailureReason = null;
    state.consecutiveFailures = 0;
    const durationMs = Date.now() - started;

    logger.info(
      { key, sizeBytes: stats.size, durationMs },
      "backup: subida exitosa a R2",
    );

    // Retención (si falla, no rompe el backup principal — solo warn).
    let retention: { kept: number; deleted: number } | undefined;
    try {
      retention = await applyRetention(client, bucket!);
      logger.info(
        { kept: retention.kept, deleted: retention.deleted },
        "backup: retención aplicada",
      );
    } catch (err) {
      const detail = (err as Error).message ?? String(err);
      logger.warn({ err: detail }, "backup: retención falló (no crítico)");
      Sentry.captureMessage("backup retention failed", {
        level: "warning",
        tags: { component: "backup", phase: "retention" },
        extra: { detail },
      });
    }

    return {
      ok: true,
      key,
      sizeBytes: stats.size,
      durationMs,
      retention,
    };
  } catch (err) {
    state.consecutiveFailures++;
    const reason = (err as Error).message ?? String(err);
    state.lastFailureReason = reason;
    logger.error(
      { err: reason, consecutiveFailures: state.consecutiveFailures },
      "backup: falló",
    );

    // Si fallan 2 backups consecutivos escalamos a `error` con tag
    // `backup-failed` para que la regla de Sentry mande email.
    const level = state.consecutiveFailures >= 2 ? "error" : "warning";
    Sentry.captureException(err, {
      level,
      tags: {
        component: "backup",
        "backup-failed": state.consecutiveFailures >= 2 ? "true" : "false",
      },
      extra: { consecutiveFailures: state.consecutiveFailures, key },
    });

    return { ok: false, reason };
  } finally {
    // Cleanup del archivo temp.
    try {
      await unlink(outPath);
    } catch {
      // ENOENT ok — el dump pudo no haber creado el archivo si pg_dump
      // ni siquiera arrancó. No es un error.
    }
  }
}

/**
 * Lista los últimos N backups en el bucket (más recientes primero).
 * Útil para el endpoint de status y el runbook de restauración.
 */
export async function listRecentBackups(
  limit = 10,
): Promise<
  Array<{ key: string; sizeBytes: number; lastModified: string }>
> {
  if (!isR2Configured()) return [];
  const client = getS3Client();
  const { bucket } = envR2();
  const all: _Object[] = [];
  let token: string | undefined = undefined;
  do {
    const resp: ListObjectsV2CommandOutput = await client.send(
      new ListObjectsV2Command({ Bucket: bucket!, ContinuationToken: token }),
    );
    all.push(...(resp.Contents ?? []));
    token = resp.NextContinuationToken;
  } while (token);

  return all
    .filter((o) => o.Key && o.LastModified && KEY_RE.test(o.Key))
    .sort(
      (a, b) =>
        (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0),
    )
    .slice(0, limit)
    .map((o) => ({
      key: o.Key!,
      sizeBytes: o.Size ?? 0,
      lastModified: o.LastModified!.toISOString(),
    }));
}
