# Runbook lanzamiento 8 mayo 2026 — Habla! v3.1

> **Owner:** Gustavo (Product Owner).
> **Acompaña:** Claude Code (hot-fixes en branch).
> **Window:** lanzamiento 8 may 2026, 09:00 PET (lunes).
> **Backup window:** 15 may 2026 si surge bloqueante crítico (Plan B mencionado en plan v3.1 §10).

Asume cero conocimiento técnico previo y cubre todo paso a paso. Cada item tiene **owner** y **deadline**. La sigla **PET** = Perú Estándar Tiempo (UTC-5).

---

## 1. Variables de entorno en Railway

**Owner:** Gustavo.
**Deadline:** 6 mayo 2026 — 18:00 PET (T-2 días).

Entrar a Railway → proyecto Habla! → servicio `web` → tab "Variables".

### Existentes (lotes 0-11) — verificar presencia (no editar)

```
DATABASE_URL  REDIS_URL
AUTH_SECRET  NEXTAUTH_URL  GOOGLE_CLIENT_ID  GOOGLE_CLIENT_SECRET
API_FOOTBALL_KEY  API_FOOTBALL_HOST
RESEND_API_KEY
NEXT_PUBLIC_APP_URL  JWT_SECRET  NODE_ENV=production
CRON_SECRET  ADMIN_ALERT_EMAIL  ADMIN_EMAIL
R2_ACCOUNT_ID  R2_ACCESS_KEY_ID  R2_SECRET_ACCESS_KEY  R2_BUCKET_BACKUPS  R2_ENDPOINT
LEGAL_RAZON_SOCIAL  LEGAL_RUC  LEGAL_PARTIDA_REGISTRAL  LEGAL_DOMICILIO_FISCAL
LEGAL_DISTRITO  LEGAL_TITULAR_NOMBRE  LEGAL_TITULAR_DNI
```

### Nuevas v3.1 (Lote E + G + H) — setear sí o sí

```
# OpenPay BBVA (Lote E) — SI alguna falta, /premium degrada a "Próximamente · Avísame".
OPENPAY_MERCHANT_ID=<del dashboard OpenPay>
OPENPAY_PRIVATE_KEY=<sk_...>
OPENPAY_PUBLIC_KEY=<pk_...>
OPENPAY_PRODUCTION=true   # false durante el sandbox de testing
OPENPAY_WEBHOOK_SECRET=<rotar antes de prod>

# WhatsApp Business API (Lote E) — sin esto, picks Premium no salen.
META_BUSINESS_ID=<id de Meta Business Manager>
WHATSAPP_PHONE_NUMBER_ID=<el del número verificado>
WHATSAPP_ACCESS_TOKEN=<System User Token, NO User Token personal>
WHATSAPP_VERIFY_TOKEN=<random 32+ chars que pongas también en Meta Console>
WHATSAPP_APP_SECRET=<App Secret de Meta Developer Console>
WHATSAPP_CHANNEL_PREMIUM_INVITE_LINK=https://whatsapp.com/channel/<HASH>
WHATSAPP_BUSINESS_PHONE_NUMBER=+51XXXXXXXXX

# Anthropic Claude API (Lote E) — sin esto, picks no se generan, bot no responde.
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-opus-4-7

# PageSpeed Insights (Lote G) — opcional. Sin esto, cron Lighthouse skip silencioso.
PAGESPEED_API_KEY=AIza...

# Resend webhook (Lote F newsletter) — opcional.
RESEND_WEBHOOK_SECRET=<de Resend → Webhooks>
```

✅ **Validar:** después de setear, click "Deploy" para que Railway re-arranque el web service con las nuevas vars.

---

## 2. Servicios externos — setup paso a paso

### 2.1 OpenPay BBVA dashboard

**Owner:** Gustavo.
**Deadline:** 5 may 2026 (T-3 días).

1. Login en https://dashboard.openpay.pe (cuenta business ya verificada en KYC).
2. Crear 3 **Planes**:
   - **Mensual**: monto S/ 39, frecuencia mensual, ID de plan `habla-premium-mensual`.
   - **Trimestral**: S/ 89 cada 3 meses, ID `habla-premium-trimestral`.
   - **Anual**: S/ 299 cada 12 meses, ID `habla-premium-anual`.
3. Configurar **webhook**:
   - URL: `https://hablaplay.com/api/v1/openpay/webhook`
   - Eventos a suscribir: `charge.succeeded`, `charge.failed`, `subscription.canceled`, `subscription.expired`.
   - Secret: pegar el mismo valor que pusiste en `OPENPAY_WEBHOOK_SECRET`.
4. Test del webhook desde el dashboard de OpenPay → debe responder 200.
5. Modo: confirmar que está **PRODUCTION**, no sandbox, antes del 8 mayo.

✅ **Validar:** `curl -X POST https://hablaplay.com/api/v1/openpay/webhook -H "X-Openpay-Signature: invalid" -d '{}'` debe responder **401**.

---

### 2.2 Meta Business Manager + WhatsApp Business API

**Owner:** Gustavo.
**Deadline:** 5 may 2026 (T-3 días).

> ⚠️ **Riesgo más alto del lanzamiento.** La verificación de Meta toma 2-7 días hábiles. Si no está aprobado para el 5 mayo: Plan B = lanzar Premium con WhatsApp regular del operador y migrar después.

1. Login en https://business.facebook.com.
2. **Verificación de negocio**: confirmar que tiene check verde. Si no, completar.
3. Ir a **WhatsApp Manager** → tu número Habla! debe estar verificado y conectado al Business Manager.
4. Crear los **7 templates HSM** (texto exacto en `apps/web/lib/services/whatsapp/templates.ts`):
   - `bienvenida_premium` (UTILITY)
   - `pago_confirmado` (UTILITY)
   - `pago_fallido` (UTILITY)
   - `renovacion_proxima` (UTILITY)
   - `cancelacion_confirmada` (UTILITY)
   - `premio_solicitar_datos` (UTILITY)
   - `premio_pagado` (UTILITY)

   Submitir cada uno → esperar aprobación de Meta (1-3 días).
5. Generar **System User Token** (NO User Token personal, no expira):
   - Settings → Users → System users → "Habla! API user" → Generate token.
   - Permisos: `whatsapp_business_messaging`, `whatsapp_business_management`.
   - Pegar en Railway como `WHATSAPP_ACCESS_TOKEN`.
6. Configurar **webhook**:
   - URL: `https://hablaplay.com/api/v1/whatsapp/webhook`
   - Verify token: el mismo de `WHATSAPP_VERIFY_TOKEN` (random 32+ chars).
   - Subscribir a: `messages`, `message_status`.
7. **Crear Channel privado** "Habla! Picks":
   - Desde la cuenta WhatsApp Business → Channels → Create.
   - Modo: **Private** (link de invite explícito). NO Public discoverable.
   - Subir 3-5 picks históricos como primer contenido.
   - Copiar el invite link → pegarlo en `WHATSAPP_CHANNEL_PREMIUM_INVITE_LINK`.
8. **Crear Channel público** "Habla!" (marketing):
   - Modo: Public. SEO description.
   - Subir 5-10 posts iniciales.

✅ **Validar:**
- `curl https://hablaplay.com/api/v1/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=<TU_TOKEN>&hub.challenge=test` → responde `test`.
- Submit del primer pick a un usuario de prueba debería llegar en ≤ 30s.

---

### 2.3 Anthropic Console

**Owner:** Gustavo.
**Deadline:** 4 may 2026 (T-4 días).

1. Login en https://console.anthropic.com.
2. **Plan + payment method**: setear método de pago.
3. **Spending limit**: $50/mes para empezar (suficiente para ~3K picks generados + 5K mensajes bot).
4. Crear API key → pegar en `ANTHROPIC_API_KEY`.
5. **Modelo**: confirmar que `claude-opus-4-7` está disponible para tu account (default v3.1).

✅ **Validar:** `curl -H "x-api-key: $KEY" -H "anthropic-version: 2023-06-01" https://api.anthropic.com/v1/models` debe listar `claude-opus-4-7`.

---

### 2.4 Resend — DNS y webhook

**Owner:** Gustavo.
**Deadline:** 5 may 2026 (T-3 días).

1. Login en https://resend.com → Domains.
2. Verificar `hablaplay.com` con SPF + DKIM + DMARC. Los registros DNS van a Cloudflare:
   - SPF: `v=spf1 include:_spf.resend.com ~all`
   - DKIM: 3 registros CNAME que Resend te muestra.
   - DMARC: `v=DMARC1; p=none; rua=mailto:postmaster@hablaplay.com`.
3. Esperar verificación verde en Resend (5-30 min después de propagación DNS).
4. **5 from-addresses** (Lote H):
   - `auth@hablaplay.com` (magic links / signin)
   - `bienvenida@hablaplay.com` (registro)
   - `newsletter@hablaplay.com` (digest semanal)
   - `premium@hablaplay.com` (suscripciones)
   - `premios@hablaplay.com` (Liga Habla! mensual)
5. Webhook (opcional pero recomendado):
   - URL: `https://hablaplay.com/api/v1/admin/newsletter/webhook` *(si está cableado para opens/clicks tracking)*.
   - Secret: `RESEND_WEBHOOK_SECRET`.

✅ **Validar:** mandar un email a tu propia inbox desde el panel de Resend → debe llegar y ser entregado correctamente, no caer en spam.

---

### 2.5 Cloudflare DNS + Email Routing

**Owner:** Gustavo.
**Deadline:** 5 may 2026 (T-3 días).

1. DNS: confirmar que `hablaplay.com` y `www.hablaplay.com` apuntan al endpoint de Railway con proxy ON (nube naranja).
2. SSL: modo "Full (strict)" o "Full" — verificar.
3. Email Routing: verificar que `*@hablaplay.com` enrutan al Gmail de Gustavo.
4. Page Rules: NO interferir con `/api/*` (sin cache).

✅ **Validar:** `curl -I https://hablaplay.com` debe responder 200 con header `cf-ray:` presente.

---

### 2.6 Google Search Console

**Owner:** Gustavo.
**Deadline:** 7 may 2026 (T-1 día).

1. Login en https://search.google.com/search-console.
2. Property: `https://hablaplay.com` (URL prefix).
3. Verificar ownership (DNS TXT record).
4. **Submit sitemap**: `https://hablaplay.com/sitemap.xml`.
5. Esperar 24h y revisar "Sitemaps" → "Discovered URLs" debería mostrar conteo > 0.

✅ **Validar:** GSC reporta ≥ 50 URLs descubiertas (post-launch en mayo).

---

### 2.7 Uptime Robot

**Owner:** Gustavo.
**Deadline:** 7 may 2026 (T-1 día).

1. Login en https://uptimerobot.com.
2. Crear monitor:
   - Type: HTTPS keyword.
   - URL: `https://hablaplay.com/api/health`.
   - Keyword exists: `"status":"ok"`.
   - Interval: 5 min.
   - Alert contacts: email Gustavo.
3. Verificar que el monitor responde verde antes del 8 mayo.

---

## 3. Backup pre-lanzamiento de Postgres

**Owner:** Gustavo (disparar) + Claude Code (instrumentar si falta).
**Deadline:** 7 may 2026 — 23:59 PET (T-1 día, después del último deploy).

```bash
# 1. Forzar un backup manual desde el endpoint admin (Lote 7).
curl -X POST https://hablaplay.com/api/v1/admin/backup/trigger \
  -H "Authorization: Bearer $CRON_SECRET"

# 2. Verificar que apareció en R2.
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://hablaplay.com/api/v1/admin/backup/historial | jq '.[0]'
# Debería listar el backup más reciente con timestamp del 7 mayo.
```

✅ **Validar:** el archivo `pg_dump_2026-05-07_*.sql.gz` está en R2 y pesa > 100 KB.

---

## 4. Smoke tests pre-launch

**Owner:** Gustavo + 5-10 testers.
**Deadline:** 5-7 may 2026 (3 días de soft-launch).
**Runbook:** `tests/e2e/SMOKE-LOTE-J.md` (este repo).
**Reporte:** `docs/soft-launch-runbook.md` (este repo).

7 flujos × 5-10 testers = ~50-70 corridas. Mínimo aceptable: cada flujo corrió ≥ 3 veces y no tiene bloqueantes.

---

## 5. Checklist final 8 mayo (T-0)

### Mañana del 8 mayo, 06:00 PET — Gustavo

- [ ] `curl https://hablaplay.com/api/health` → `"status":"ok"`.
- [ ] `curl https://hablaplay.com/sitemap.xml` → XML con ≥ 50 entries.
- [ ] `curl https://hablaplay.com/robots.txt` → contiene `Disallow: /admin`.
- [ ] `curl -I https://hablaplay.com/manifest.webmanifest` → 200 + `application/manifest+json`.
- [ ] Login en `/admin/dashboard` → KPIs cargan, alarmas en verde.
- [ ] Login en `/admin/picks-premium` → cola con al menos 2 picks PENDIENTE listos para aprobar.
- [ ] OpenPay dashboard → modo PRODUCTION confirmado.
- [ ] Meta Business → 7 templates en estado APPROVED.
- [ ] Channel privado WhatsApp con 3-5 picks históricos visibles.
- [ ] Backup de Postgres del 7 mayo confirmado en R2.
- [ ] Uptime Robot verde.

### 09:00 PET — Lanzamiento

- [ ] Anuncio en redes (TikTok / Instagram / X) — task del fundador, no del Lote J.
- [ ] Activar pauta paga inicial.
- [ ] Publicar primer pick Premium del día (ya en cola PENDIENTE) → aprobar en `/admin/picks-premium`.

### Primeras 24h — monitoreo activo

- [ ] Cada hora durante las primeras 6h: revisar `/admin/dashboard` → semáforos.
- [ ] Cada 30 min: revisar `/admin/alarmas` → cero alarmas CRITICAL.
- [ ] Cada hora: revisar `/admin/logs` → cero errores no clasificados.
- [ ] Cada 15 min las primeras 2h: scroll a `/admin/mobile-vitals` → P75 LCP < 2.5s, INP < 200ms, CLS < 0.1.
- [ ] Cada cobro Premium → confirmar email factura llegó al usuario.
- [ ] Cada cancelación Premium → confirmar acceso continúa hasta `vencimientoEn`.

---

## 6. Rollback plan

Si algo crítico se rompe en las primeras 24h:

1. **Identificar el bloqueante** desde `/admin/logs` o feedback de usuarios.
2. **Severidad ALTA o CRITICAL** (e.g. checkout no funciona, picks no llegan):
   - Hot-fix en branch `hotfix/<slug>` → tsc + lint → merge a `main` → push (Railway redeploya).
   - Si el hot-fix toma > 30 min: deploy revert via Railway → "Rollback to previous deployment".
3. **Severidad MEDIA o LOW**: registrar como issue → fix < 24h.
4. **Si Premium falla por OpenPay**: degradar `/premium` a "Próximamente · Avísame" (ya implementado como fallback nativo cuando faltan env vars OpenPay).
5. **Si WhatsApp Business falla**: pause de envío de picks Premium + comunicar a suscriptores por email + Plan B con WhatsApp regular.

---

## 7. Post-launch día 1 — auditoría 23:59 PET

- [ ] FTDs registrados (afiliados): meta semana 1 = 50, día 1 = 5-7.
- [ ] Suscriptores Premium nuevos: meta semana 1 = 50, día 1 = 5-10.
- [ ] Cero alarmas CRITICAL pendientes.
- [ ] P75 Core Web Vitals dentro de target.
- [ ] Lighthouse Mobile ≥ 90 en home + partido + cuotas.
- [ ] Backup nocturno del 8 mayo en R2.
- [ ] Resumen ejecutivo en `docs/post-mortem-lanzamiento.md` (Lote J día +1).
