# Tipografía — Habla! v3.1

Escalas tipográficas oficiales para pista usuario (mobile-first) y pista admin (desktop). Cada escala tiene su clase utilitaria.

## Familias (✅ existe — sin cambios)

```ts
// apps/web/app/layout.tsx
const barlow = Barlow_Condensed({ subsets: ['latin'], weight: ['400','600','700','800','900'], variable: '--font-barlow' });
const dmSans = DM_Sans({ subsets: ['latin'], weight: ['400','500','600','700'], variable: '--font-dm-sans' });
```

```ts
// tailwind.config.ts
fontFamily: {
  display: ["var(--font-barlow)", "sans-serif"],  // Títulos, números, scores
  body: ["var(--font-dm-sans)", "sans-serif"],     // Body, copy, formularios
}
```

**Regla:** Barlow Condensed solo para `h1`-`h4`, números grandes (cuotas, marcadores, stats) y CTAs principales. Todo lo demás (body, labels, inputs, tablas) en DM Sans.

## Escala mobile (pista usuario)

Diseñada a 375px. Las clases se aplican directamente.

| Clase | Tamaño | Line-height | Peso | Uso |
|---|---|---|---|---|
| `text-display-xl` | 36px | 1.0 | 900 | Hero principal "Todas las fijas en una" |
| `text-display-lg` | 28px | 1.05 | 800 | Títulos de página (Premium, Liga Habla!) |
| `text-display-md` | 22px | 1.1 | 800 | Hero de partido (nombre del equipo) |
| `text-display-sm` | 18px | 1.15 | 700 | Títulos de sección, nombres de equipos en cards |
| `text-display-xs` | 14px | 1.2 | 700 | Subtítulos, labels destacados |
| `text-body-lg` | 16px | 1.5 | 400 | Body principal (lectura larga, párrafos) |
| `text-body-md` | 14px | 1.5 | 400 | Body estándar |
| `text-body-sm` | 13px | 1.5 | 400 | Body secundario, captions |
| `text-body-xs` | 11px | 1.4 | 400 | Microcopy, timestamps |
| `text-label-md` | 12px | 1.3 | 700 | Labels (CASA, CUOTA, etc.) — uppercase |
| `text-label-sm` | 10px | 1.3 | 700 | Mini labels en chips/badges — uppercase |
| `text-num-xl` | 32px | 1.0 | 800 | Cuota grande, marcador |
| `text-num-lg` | 24px | 1.0 | 800 | Cuota mediana, stat hero |
| `text-num-md` | 18px | 1.0 | 800 | Cuota inline, puntos en leaderboard |
| `text-num-sm` | 14px | 1.0 | 700 | Cuota mini en widgets |

**Implementación en globals.css:**

```css
@layer utilities {
  /* Display (titulos) — Barlow Condensed */
  .text-display-xl {
    font-family: var(--font-barlow), sans-serif;
    font-size: 36px; line-height: 1; font-weight: 900;
    letter-spacing: -0.01em;
  }
  .text-display-lg {
    font-family: var(--font-barlow), sans-serif;
    font-size: 28px; line-height: 1.05; font-weight: 800;
  }
  .text-display-md {
    font-family: var(--font-barlow), sans-serif;
    font-size: 22px; line-height: 1.1; font-weight: 800;
  }
  .text-display-sm {
    font-family: var(--font-barlow), sans-serif;
    font-size: 18px; line-height: 1.15; font-weight: 700;
  }
  .text-display-xs {
    font-family: var(--font-barlow), sans-serif;
    font-size: 14px; line-height: 1.2; font-weight: 700;
  }

  /* Body — DM Sans */
  .text-body-lg { font-size: 16px; line-height: 1.5; font-weight: 400; }
  .text-body-md { font-size: 14px; line-height: 1.5; font-weight: 400; }
  .text-body-sm { font-size: 13px; line-height: 1.5; font-weight: 400; }
  .text-body-xs { font-size: 11px; line-height: 1.4; font-weight: 400; }

  /* Labels — DM Sans uppercase */
  .text-label-md {
    font-size: 12px; line-height: 1.3; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.08em;
  }
  .text-label-sm {
    font-size: 10px; line-height: 1.3; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.1em;
  }

  /* Numbers — Barlow Condensed (números, cuotas, marcadores) */
  .text-num-xl {
    font-family: var(--font-barlow), sans-serif;
    font-size: 32px; line-height: 1; font-weight: 800;
  }
  .text-num-lg {
    font-family: var(--font-barlow), sans-serif;
    font-size: 24px; line-height: 1; font-weight: 800;
  }
  .text-num-md {
    font-family: var(--font-barlow), sans-serif;
    font-size: 18px; line-height: 1; font-weight: 800;
  }
  .text-num-sm {
    font-family: var(--font-barlow), sans-serif;
    font-size: 14px; line-height: 1; font-weight: 700;
  }
}
```

## Escala admin (pista desktop)

Diseñada a 1280px+. Más densa, números grandes para dashboards de KPIs.

| Clase | Tamaño | Line-height | Peso | Uso |
|---|---|---|---|---|
| `text-admin-page-title` | 24px | 1.2 | 700 | Título de página admin |
| `text-admin-section` | 16px | 1.3 | 700 | Sección dentro de página |
| `text-admin-card-title` | 14px | 1.3 | 700 | Título de card |
| `text-admin-body` | 13px | 1.5 | 400 | Body en formularios y tablas |
| `text-admin-label` | 11px | 1.3 | 600 | Labels uppercase |
| `text-admin-table-cell` | 13px | 1.4 | 400 | Celdas de tabla |
| `text-admin-table-header` | 11px | 1.2 | 700 | Headers de tabla |
| `text-admin-meta` | 11px | 1.4 | 400 | Timestamps, IDs, metadata |
| `text-kpi-value-xl` | 36px | 1 | 800 | Valor de KPI principal en card grande |
| `text-kpi-value-lg` | 28px | 1 | 800 | Valor de KPI en card mediano |
| `text-kpi-value-md` | 20px | 1 | 700 | Valor de KPI en card pequeño |
| `text-kpi-trend` | 11px | 1.2 | 600 | Trend ↗+12% bajo el valor |

**Implementación:**

```css
@layer utilities {
  .text-admin-page-title {
    font-family: var(--font-barlow), sans-serif;
    font-size: 24px; line-height: 1.2; font-weight: 700;
  }
  .text-admin-section {
    font-family: var(--font-barlow), sans-serif;
    font-size: 16px; line-height: 1.3; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.04em;
  }
  .text-admin-card-title {
    font-family: var(--font-barlow), sans-serif;
    font-size: 14px; line-height: 1.3; font-weight: 700;
  }
  .text-admin-body { font-size: 13px; line-height: 1.5; font-weight: 400; }
  .text-admin-label {
    font-size: 11px; line-height: 1.3; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.08em;
  }
  .text-admin-table-cell { font-size: 13px; line-height: 1.4; font-weight: 400; }
  .text-admin-table-header {
    font-size: 11px; line-height: 1.2; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.06em;
  }
  .text-admin-meta { font-size: 11px; line-height: 1.4; font-weight: 400; }

  /* KPI numbers */
  .text-kpi-value-xl {
    font-family: var(--font-barlow), sans-serif;
    font-size: 36px; line-height: 1; font-weight: 800;
  }
  .text-kpi-value-lg {
    font-family: var(--font-barlow), sans-serif;
    font-size: 28px; line-height: 1; font-weight: 800;
  }
  .text-kpi-value-md {
    font-family: var(--font-barlow), sans-serif;
    font-size: 20px; line-height: 1; font-weight: 700;
  }
  .text-kpi-trend { font-size: 11px; line-height: 1.2; font-weight: 600; }
}
```

## Reglas de uso

1. **Cero `text-[Npx]` o `text-[Nrem]` en JSX.** Si una variante no existe en la escala, ampliar la escala global con un commit aparte antes de usarla.

2. **Mobile y admin no se mezclan.** Una vista de pista usuario nunca usa clases `text-admin-*`, y viceversa. La detección es por ruta (`app/(public|main)/*` → mobile, `app/admin/*` → admin).

3. **Números siempre con Barlow Condensed.** Cuando un componente muestra un número (cuota 2.05, marcador 2-1, puntos 847, %acierto 47%, tiempo 8'), usar `text-num-*` o `text-kpi-value-*`. Esto mantiene consistencia visual.

4. **Body en DM Sans, sin excepciones.** Párrafos de análisis editorial, formularios, tablas, instrucciones, microcopy. Todo en DM Sans.

5. **Labels uppercase en mobile y admin.** El uppercase con letter-spacing es la convención del sistema para labels técnicas (CASA, CUOTA, EV+, STAKE, NIVEL, POS.).

6. **Line-height en números siempre 1.** Para que las cuotas y marcadores se alineen verticalmente en grids sin desfases.

## Mapeo a componentes existentes

Cuando Claude Code ejecute el Lote A, debe revisar estos componentes para alinear con la escala:

| Componente | Estado actual | Acción |
|---|---|---|
| `apps/web/components/home/HomeHero.tsx` | usa text- ad-hoc | Reemplazar por `text-display-xl` y `text-body-lg` |
| `apps/web/components/matches/MatchCard.tsx` | mix de tamaños | Aplicar `text-display-sm` (equipos), `text-num-md` (cuotas), `text-body-xs` (countdown) |
| `apps/web/components/perfil/StatsGrid.tsx` | numerales grandes | Aplicar `text-num-lg` (valor) y `text-label-sm` (label) |
| `apps/web/components/admin/*` | mezclado | Migrar a clases `text-admin-*` |

Esto se hace en el Lote A donde sea trivial. Los casos complejos (componentes que se reescriben completos en Lotes B-G) se actualizan en su propio lote.

## Verificación

Tras aplicar este archivo, Claude Code corre:

```bash
pnpm tsc --noEmit
pnpm lint
```

Si todo pasa, push a main. Railway deploya. Gustavo abre `hablaplay.com` para verificar visualmente que las tipografías cargan correctamente.

---

*Versión 1 · Abril 2026 · Tipografía base para Lote A*
