# Mobile Vitals `/admin/mobile-vitals`

Vista de monitoreo de Lighthouse + Core Web Vitals (CWV) reales de usuarios. Crítica para Habla! que apunta a **Lighthouse Mobile >90, LCP <2.5s, INP <200ms, CLS <0.1** definidos en el plan v3.1.

## Lote responsable

**Lote G** — Admin desktop análisis.

## Estado actual del repo

NUEVA — sin sistema de monitoreo de vitals.

## Cambios necesarios

### Decisión arquitectónica

Hay 2 fuentes de datos distintos:

1. **Lighthouse score sintético** — corrido en CI o con cron contra rutas críticas. Genera score 0-100 con 4 categorías (Performance, Accessibility, Best Practices, SEO).
2. **Core Web Vitals reales (CrUX/RUM)** — métricas medidas en el browser de usuarios reales:
   - **LCP** (Largest Contentful Paint): velocidad de carga del elemento principal.
   - **INP** (Interaction to Next Paint): responsiveness al interactuar.
   - **CLS** (Cumulative Layout Shift): estabilidad visual.

Habla! recolecta CWV via `web-vitals` library (cliente) → API endpoint → BD para análisis.

### Archivos a crear

- `apps/web/lib/utils/web-vitals.ts`:
  - Cliente que captura CWV en el browser y envía a `/api/v1/vitals`.
  - Implementación con `web-vitals` (npm package).
  - Inicializar en `apps/web/app/layout.tsx` con `<WebVitalsCollector>`.

- `apps/web/app/api/v1/vitals/route.ts`:
  - POST endpoint que recibe `{ name, value, id, route, deviceType, connectionType }` y los guarda en BD.

- Modelo Prisma `MetricaVital`:
  ```prisma
  model MetricaVital {
    id            String    @id @default(cuid())
    nombre        String                          // 'LCP' | 'INP' | 'CLS'
    valor         Float                           // ms o score
    ruta          String                           // /partidos/[slug]
    deviceType    String?                          // 'mobile' | 'desktop' | 'tablet'
    connectionType String?                         // '4g' | '3g' | 'wifi'
    userAgent     String?   @db.Text
    fecha         DateTime  @default(now())

    @@index([nombre, ruta, fecha])
    @@map("metricas_vitales")
  }
  ```

- `apps/web/app/admin/mobile-vitals/page.tsx`:
  - Server component con stats agregadas + gráficas + tabla de rutas con peor performance.

- `apps/web/components/admin/vitals/VitalsResumenCards.tsx`:
  - 4 cards con percentiles del último mes:
    - LCP P75 (target <2.5s)
    - INP P75 (target <200ms)
    - CLS P75 (target <0.1)
    - Lighthouse Mobile promedio (target >90)
  - Cada card con semáforo verde/ámbar/rojo según target.

- `apps/web/components/admin/vitals/VitalsCharts.tsx`:
  - 3 line charts (LCP, INP, CLS) últimos 30 días con percentil 75.
  - Target line horizontal.

- `apps/web/components/admin/vitals/RutasPeorPerformance.tsx`:
  - Tabla con rutas ordenadas por peor LCP P75:
    - Ruta · Visitas · LCP P75 · INP P75 · CLS P75 · Acción
  - Acción: "Ver detalle" → modal con breakdown por device/connection.

- `apps/web/components/admin/vitals/LighthouseHistorico.tsx`:
  - Tabla con últimas N corridas de Lighthouse (manual o CI):
    - Fecha · Ruta · Device · Performance · Accessibility · Best Practices · SEO
  - Botón "Correr Lighthouse ahora" → trigger manual via Lighthouse CI o PageSpeed Insights API.

### Servicios

- `apps/web/lib/services/vitals.service.ts`:
  - `obtenerVitalsAgregadas(rango)` — P75 de LCP/INP/CLS.
  - `obtenerVitalsPorRuta(rango)` — breakdown por route.
  - `correrLighthouseManual(url)` — usa PageSpeed Insights API.

### Cron de Lighthouse semanal

`apps/web/lib/cron/lighthouse-weekly.ts`:

Corrida cada lunes 6 AM contra las 5 rutas críticas:
- `/`
- `/partidos/[slug-de-partido-popular]`
- `/comunidad`
- `/premium`
- `/blog/[post-popular]`

Guarda resultados en BD para tracking histórico.

### Archivos a modificar

- `apps/web/app/layout.tsx`:
  - Agregar `<WebVitalsCollector>` cliente al inicio del body.

## Datos requeridos

```typescript
// apps/web/app/admin/mobile-vitals/page.tsx
export const dynamic = 'force-dynamic';

export default async function VitalsAdminPage() {
  const [resumen, charts, rutasPeor, lighthouseHist] = await Promise.all([
    obtenerVitalsAgregadas('30d'),
    obtenerVitalsCharts('30d'),
    obtenerRutasPeorPerformance({ take: 20 }),
    obtenerLighthouseHistorico({ take: 50 }),
  ]);

  return <VitalsView ... />;
}
```

## Estados de UI

### Estructura

```
┌────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar (Análisis · Mobile Vitals)            │
├─────────┴──────────────────────────────────────────────┤
│ <AdminPageHeader>                                       │
│  Title: Mobile Vitals                                   │
│  Desc: Performance real de usuarios · Últimos 30 días   │
│  Actions: [Correr Lighthouse]                           │
├─────────────────────────────────────────────────────────┤
│ <VitalsResumenCards> 4 cards con P75                    │
├─────────────────────────────────────────────────────────┤
│ <VitalsCharts> 3 charts (LCP / INP / CLS)               │
├─────────────────────────────────────────────────────────┤
│ <RutasPeorPerformance>                                  │
│  Ruta              │ Visitas│ LCP P75│ INP P75│ CLS P75│
│  ─────────────────────────────────────────────────────  │
│  /partidos/...     │ 8,420  │ 2.8s ⚠ │ 180ms ✓│ 0.04 ✓│
│  /comunidad        │ 5,120  │ 1.9s ✓ │ 220ms ⚠│ 0.06 ✓│
├─────────────────────────────────────────────────────────┤
│ <LighthouseHistorico>                                   │
│  Última corrida: hace 3 días · Próxima: lunes 6 AM      │
└─────────────────────────────────────────────────────────┘
```

### Estados de UI

#### Stats con datos (después de 7+ días recolectando)
- Render normal con números reales.

#### Stats sin datos (semana 1 post-launch)
- Mensaje: "Recolectando datos. Stats disponibles después de 1 semana."

#### Lighthouse no configurado
- Banner: "Configura el cron semanal en `vercel.json` para ver histórico."

### Loading

- Server component → render directo.
- Cache de queries pesadas con TTL 5 min.

## Componentes que reutiliza

- `<AdminSidebar>`, `<AdminTopbar>`, `<AdminPageHeader>` (Lote F).
- `<AdminCard>`, `<AdminTable>` (Lote F).
- Recharts (Lote 6).

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- Desktop-only para esta vista admin.
- **Endpoint `/api/v1/vitals` debe ser ultra-eficiente** (recibe muchas requests). Sin auth — público. Rate limit 100 req/min/IP.
- **Sample 10%** de las visitas para no saturar BD si tráfico crece. (Cliente usa `Math.random() < 0.1` antes de enviar.)
- Cron Lighthouse usa **PageSpeed Insights API** (gratis con API key Google) o Lighthouse CI.
- Eventos analíticos:
  - `admin_vitals_visto` (NUEVO Lote G).
  - `admin_lighthouse_manual_disparado` (NUEVO Lote G).

## Mockup de referencia

Sin mockup individual.

## Pasos manuales para Gustavo post-deploy

### Configurar PageSpeed Insights API key

1. Ir a https://console.cloud.google.com/.
2. Crear proyecto.
3. Habilitar PageSpeed Insights API.
4. Generar API key → variable `PAGESPEED_API_KEY` en Railway.

### Configurar cron semanal

Agregar a `vercel.json` o Railway:
```json
{
  "crons": [{
    "path": "/api/v1/crons/lighthouse-weekly",
    "schedule": "0 6 * * 1"
  }]
}
```

**Validación post-deploy:**
1. Abrir `/admin/mobile-vitals` después de 1 semana.
2. Verificar P75 cards con números reales.
3. Verificar charts con tendencia.
4. Identificar rutas problemáticas.
5. Click "Correr Lighthouse ahora" → verificar Railway logs.

---

*Versión 1 · Abril 2026 · Mobile Vitals para Lote G*
