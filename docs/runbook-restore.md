# Runbook — Restauración de backup desde R2

Procedimiento de emergencia para restaurar la base de datos de Habla! a partir de un backup en Cloudflare R2.

> **Audiencia:** Gustavo + cualquier admin con acceso a R2 + Railway. Pensado para ejecutarse bajo presión: pasos secuenciales, comandos copy-paste.

---

## 1. Cuándo usar este runbook

- Corrupción de datos en Postgres (regresión catastrófica de un deploy reciente).
- Rollback de una migración destructiva.
- Borrado accidental de tablas/registros críticos.
- Pérdida del volumen de Railway Postgres (escenario worst-case).

Si el problema es solo de un servicio (ej. Redis caído, web app crashea), **no restaures** — debug primero. La restauración tiene downtime y rollback parcial es mejor que rollback total.

---

## 2. Pre-requisitos

### Acceso

- Credenciales R2 (en 1Password, vault `Habla! Infra`):
  - `R2_ACCESS_KEY_ID`
  - `R2_SECRET_ACCESS_KEY`
  - `R2_ENDPOINT` (formato `https://<account-id>.r2.cloudflarestorage.com`)
  - `R2_BUCKET` (`habla-db-backups`)
- Acceso a Cloudflare dashboard (`dash.cloudflare.com` → R2 → habla-db-backups) como alternativa visual al CLI.
- Acceso a Railway dashboard (Postgres service + variables del web service).

### Herramientas

```bash
# Cliente Postgres (idéntico al instalado en el container)
brew install postgresql@16            # macOS
sudo apt install postgresql-client-16 # Ubuntu/Debian

# AWS CLI (S3-compatible para R2)
brew install awscli                   # macOS
sudo apt install awscli               # Ubuntu/Debian

# gunzip viene con cualquier sistema Unix base.
```

### Configurar AWS CLI para R2

R2 es S3-compatible. Configurá un perfil dedicado:

```bash
aws configure --profile r2-habla
# AWS Access Key ID: <pegar R2_ACCESS_KEY_ID>
# AWS Secret Access Key: <pegar R2_SECRET_ACCESS_KEY>
# Default region: auto
# Default output: json
```

Para todos los comandos de abajo, exportá:

```bash
export R2_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
export R2_BUCKET="habla-db-backups"
```

---

## 3. Paso 1 — Identificar el backup a restaurar

### Listar backups disponibles

```bash
aws s3 ls "s3://${R2_BUCKET}/" \
  --profile r2-habla \
  --endpoint-url "${R2_ENDPOINT}" \
  | sort -r \
  | head -40
```

Output esperado (más reciente primero):

```
2026-04-25 03:01:12     45 MiB habla-2026-04-25-0301.sql.gz
2026-04-24 03:00:58     45 MiB habla-2026-04-24-0301.sql.gz
2026-04-23 03:01:05     45 MiB habla-2026-04-23-0301.sql.gz
...
2026-04-01 03:00:54     43 MiB habla-2026-04-01-0301.sql.gz   ← día 1: retención indefinida
...
```

### Elegí cuál

- **Default**: el más reciente (último backup exitoso).
- **Si la corrupción es vieja**: el último backup ANTES de que apareciera el problema. Mirá Sentry / Railway logs / commits para ubicar la ventana.
- **Si dudás**: backup del día 1 del mes anterior — esos se conservan indefinidamente.

Anotá el nombre exacto del archivo (ej. `habla-2026-04-25-0301.sql.gz`).

---

## 4. Paso 2 — Descargar el backup

```bash
BACKUP_KEY="habla-2026-04-25-0301.sql.gz"   # ← reemplazar
mkdir -p ~/habla-restore && cd ~/habla-restore

aws s3 cp "s3://${R2_BUCKET}/${BACKUP_KEY}" . \
  --profile r2-habla \
  --endpoint-url "${R2_ENDPOINT}"

# Verificar tamaño (debería ser > 1MB)
ls -lh "${BACKUP_KEY}"
```

### Descomprimir y validar

```bash
gunzip -k "${BACKUP_KEY}"   # -k mantiene el .gz original como respaldo
SQL_FILE="${BACKUP_KEY%.gz}"
ls -lh "${SQL_FILE}"

# Sanity check: las primeras 30 líneas deberían tener el header de pg_dump
head -30 "${SQL_FILE}"

# Sanity check: deberían existir las tablas críticas
grep -E "CREATE TABLE.*\"(Usuario|Torneo|Ticket|TransaccionLukas)\"" "${SQL_FILE}" | head -5
```

Si algo no cuadra (archivo trunco, sin tablas) — **no continuar**: probar con un backup anterior.

---

## 5. Paso 3 — Restauración local (DRY RUN obligatorio)

**ANTES** de tocar producción, restaurá a una BD local desechable para confirmar que el backup es bueno.

```bash
# Spin up Postgres local (Docker)
docker run --rm -d \
  --name habla-restore-test \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=habladb_restored \
  -p 5544:5432 \
  postgres:16-alpine

# Esperar 5s a que arranque
sleep 5

# Restaurar
psql "postgresql://postgres:test@localhost:5544/habladb_restored" < "${SQL_FILE}"
```

### Validación con queries de smoke test

```bash
psql "postgresql://postgres:test@localhost:5544/habladb_restored" <<'EOF'
-- Conteo de filas en tablas críticas
SELECT 'Usuario'         AS tabla, COUNT(*) FROM "Usuario"
UNION ALL SELECT 'Torneo',          COUNT(*) FROM "Torneo"
UNION ALL SELECT 'Ticket',          COUNT(*) FROM "Ticket"
UNION ALL SELECT 'TransaccionLukas',COUNT(*) FROM "TransaccionLukas"
UNION ALL SELECT 'Partido',         COUNT(*) FROM "Partido"
UNION ALL SELECT 'Premio',          COUNT(*) FROM "Premio";

-- Último torneo
SELECT id, "createdAt", estado FROM "Torneo" ORDER BY "createdAt" DESC LIMIT 1;

-- Última transacción
SELECT id, "createdAt", tipo, monto FROM "TransaccionLukas" ORDER BY "createdAt" DESC LIMIT 1;
EOF
```

Si los counts y las fechas tienen sentido (no están en cero, fechas recientes), el backup es bueno.

```bash
# Limpiar el contenedor de prueba
docker stop habla-restore-test
```

---

## 6. Paso 4 — Restauración en producción

> **AVISO**: este paso causa downtime. Coordiná con el equipo y comunicá a usuarios (ver §8).

### 4a. Pausar la app

En Railway dashboard → web service → Settings → "Pause service".

Esto evita que mientras restaurás, usuarios escriban a la BD que estás por sobreescribir.

### 4b. Conectarte a Postgres prod

Obtené `DATABASE_URL` desde Railway (Postgres service → Connect → "Postgres Connection URL"). Copialo a una variable local:

```bash
# CUIDADO: esto contiene la password de prod. No la pegues a logs/Slack.
export PROD_DATABASE_URL="postgresql://postgres:<pwd>@<host>:<port>/railway"
```

### 4c. Backup de seguridad ANTES de restaurar (paranoia obligatoria)

Antes de tocar nada en prod, hacé un dump del estado actual por si la restauración rompe algo y querés volver al "antes".

```bash
pg_dump "${PROD_DATABASE_URL}" --no-owner --no-privileges \
  | gzip > "habla-pre-restore-$(date -u +%Y%m%d-%H%M).sql.gz"
ls -lh habla-pre-restore-*.sql.gz
```

### 4d. Drop + recreate del schema público

> **Esta es la operación destructiva.** Una vez ejecutada, los datos actuales en prod se pierden (excepto el backup de §4c).

```bash
psql "${PROD_DATABASE_URL}" <<'EOF'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
EOF
```

### 4e. Restaurar el dump

```bash
psql "${PROD_DATABASE_URL}" < "${SQL_FILE}"
```

Esperá a que termine (puede tardar 1-5 min según tamaño). Cualquier error sale por stderr — leelo si aparece.

### 4f. Aplicar migraciones pendientes (si las hay)

Si el backup es viejo y desde entonces hubo migraciones merged a `main`, hay que aplicarlas:

```bash
# Desde tu clone local de habla-app:
DATABASE_URL="${PROD_DATABASE_URL}" \
  pnpm --filter @habla/db exec prisma migrate deploy
```

Si no hay migraciones pendientes, este comando dice "No pending migrations".

### 4g. Reiniciar la app

Railway dashboard → web service → Settings → "Resume service".

---

## 7. Paso 5 — Validación post-restauración

```bash
# Health
curl -s https://hablaplay.com/api/health | jq

# Smoke test: home + matches deben cargar
curl -sI https://hablaplay.com/ | head -3
curl -sI https://hablaplay.com/matches | head -3

# Inscripciones de un torneo conocido (cualquiera ABIERTO)
psql "${PROD_DATABASE_URL}" -c "
  SELECT id, estado, \"totalInscritos\", \"pozoBruto\"
  FROM \"Torneo\"
  ORDER BY \"createdAt\" DESC
  LIMIT 5;
"
```

### Disparar un backup manual nuevo (verificar que el ciclo siga sano)

```bash
curl -X POST https://hablaplay.com/api/cron/backup-db \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

---

## 8. Comunicación con usuarios

### Si la restauración fue planificada

Avisar 24h antes en redes (Instagram + WhatsApp comunidad):

> Habrá mantenimiento programado en Habla! el [fecha/hora] por aprox 30 minutos. Los torneos en curso quedan pausados; los Lukas y predicciones están a salvo.

### Si la restauración fue de emergencia

Inmediatamente al detectar el incidente, post breve:

> Estamos resolviendo un problema técnico en Habla!. Los Lukas y datos de cuenta están seguros. Volvemos en menos de 1 hora.

Después de resolver, post de cierre:

> Habla! ya está operativa nuevamente. Disculpas por la interrupción. Cualquier consulta: soporte@hablaplay.com.

### Si hubo pérdida real de datos (entre el último backup y el incidente)

Esto es serio. Comunicación 1-a-1 con usuarios afectados:
1. Identificar usuarios cuyos tickets/transacciones del rango perdido sí estaban procesadas.
2. Email manual desde `soporte@hablaplay.com` explicando.
3. Compensación con Lukas BONUS si corresponde.

---

## 9. Post-mortem

Después de cada restauración, escribí un post-mortem en `docs/post-mortems/YYYY-MM-DD-restore.md` con:

- Línea de tiempo del incidente.
- Causa raíz.
- Backup usado (key + fecha).
- Datos perdidos (si hubo).
- Cambios para prevenir el próximo (¿más backups? ¿feature flag? ¿guard de migración?).

---

## 10. Política de retención (referencia)

- 30 backups diarios (últimos 30 días).
- Backup del día 1 de cada mes: retención **indefinida**.
- La retención se aplica automáticamente en `applyRetention()` después de cada backup exitoso. Lógica en [`backup.service.ts`](../apps/web/lib/services/backup.service.ts).

Si necesitás liberar espacio manualmente en R2 (no debería ser necesario), se puede borrar archivos del bucket vía dashboard de Cloudflare o vía CLI:

```bash
aws s3 rm "s3://${R2_BUCKET}/<key>" \
  --profile r2-habla \
  --endpoint-url "${R2_ENDPOINT}"
```

**Nunca borrar el más reciente.** Conservá al menos 7 backups en cualquier momento.
