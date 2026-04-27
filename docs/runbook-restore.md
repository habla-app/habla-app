# Runbook — Restauración de backup desde R2 (Lote 7)

Procedimiento de emergencia para restaurar Postgres a partir de un backup en Cloudflare R2. Backups generados por `lib/services/backup-r2.service.ts` (Job H, in-process).

> **Audiencia:** Gustavo + cualquier admin con acceso a R2 + Railway. Pensado para ejecutarse bajo presión: pasos secuenciales, comandos copy-paste.

## 1. Pre-requisitos

- Credenciales R2 (vault 1Password "Habla! Infra"): `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_BACKUPS`, `R2_ENDPOINT`.
- `pg_restore` versión >= 16. macOS: `brew install postgresql@16`. Ubuntu: `sudo apt install postgresql-client-16`.
- AWS CLI (S3-compatible). `brew install awscli` o `sudo apt install awscli`.

```bash
aws configure --profile r2-habla   # pegar access key + secret key, region: auto
export R2_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
export R2_BUCKET="habla-backups"   # = R2_BUCKET_BACKUPS
```

## 2. Paso 1 — Descargar el .dump de R2

```bash
# Listar últimos backups disponibles
aws s3 ls "s3://${R2_BUCKET}/daily/"   --profile r2-habla --endpoint-url "${R2_ENDPOINT}" | sort -r | head -10
aws s3 ls "s3://${R2_BUCKET}/monthly/" --profile r2-habla --endpoint-url "${R2_ENDPOINT}"

# Descargar (ejemplo: el más reciente)
BACKUP_KEY="daily/habla-2026-04-27.dump"   # ← reemplazar
aws s3 cp "s3://${R2_BUCKET}/${BACKUP_KEY}" . --profile r2-habla --endpoint-url "${R2_ENDPOINT}"
ls -lh "$(basename ${BACKUP_KEY})"   # debería ser > 1MB
```

## 3. Paso 2 — Restaurar a una BD nueva

`pg_restore` con `-Fc` (formato custom). El comando crea las tablas y carga los datos.

```bash
# DRY-RUN local primero (muy recomendado): contenedor desechable
docker run --rm -d --name habla-restore-test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=habladb_restored -p 5544:5432 postgres:16-alpine
sleep 5
pg_restore --no-owner --no-privileges -d "postgresql://postgres:test@localhost:5544/habladb_restored" "$(basename ${BACKUP_KEY})"

# Restauración a producción (Railway): pausar el web service primero, luego:
export PROD_DATABASE_URL="postgresql://postgres:<pwd>@<host>:<port>/railway"
psql "${PROD_DATABASE_URL}" -c 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'
pg_restore --no-owner --no-privileges -d "${PROD_DATABASE_URL}" "$(basename ${BACKUP_KEY})"
```

## 4. Paso 3 — Verificación rápida

```bash
psql "${DATABASE_URL_RESTAURADA}" <<'EOF'
SELECT 'usuarios' AS tabla, COUNT(*) FROM "usuarios"
UNION ALL SELECT 'torneos',          COUNT(*) FROM "torneos"
UNION ALL SELECT 'tickets',          COUNT(*) FROM "tickets"
UNION ALL SELECT 'transacciones',    COUNT(*) FROM "transacciones_lukas";
EOF
```

Si los counts son razonables (no en cero, fechas recientes en los rows), el restore es bueno. Re-aplicar migraciones pendientes si el dump es viejo: `DATABASE_URL=... pnpm --filter @habla/db exec prisma migrate deploy`. Reiniciar el web service en Railway.

## 5. Levantar una BD nueva en Railway (incidente mayor)

Dashboard → New → Database → PostgreSQL 16 → copiar `DATABASE_URL` al web service. Restaurar como en Paso 2 contra esa nueva URL.

## 6. Post-restauración

- Disparar `POST /api/v1/admin/backup/ejecutar` con `Bearer CRON_SECRET` para confirmar que el ciclo siga sano.
- `GET /api/v1/admin/backup/historial` para ver los últimos 30 intentos.
- Escribir post-mortem en `docs/post-mortems/YYYY-MM-DD-restore.md`: línea de tiempo, causa raíz, datos perdidos (si los hubo), prevención.

## 7. Política de retención

- `daily/habla-YYYY-MM-DD.dump`: últimos 30 días. Borrado automático.
- `monthly/habla-YYYY-MM.dump`: subido el día 1 de cada mes. Retención **indefinida**.
- Lógica en `aplicarRetencion()` en [`backup-r2.service.ts`](../apps/web/lib/services/backup-r2.service.ts), corre tras cada backup exitoso.
