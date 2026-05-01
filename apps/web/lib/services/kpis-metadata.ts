// Catálogo único de KPIs estratégicos del v3.1 — Lote G (May 2026).
//
// Fuente de verdad para:
//   - /admin/kpis (selector grid + drill-down detail)
//   - alarmas.service.ts (config thresholds por metricId)
//   - admin-kpis.service.ts (KPIs del dashboard del Lote F)
//
// Cada KPI tiene:
//   - id: estable (no cambiar — referenciado en BD por AlarmaConfiguracion)
//   - label: human-readable
//   - categoria: agrupación visual
//   - formato: cómo formatear el valor para display
//   - target: valor target del plan v3.1 (puede ser null si no hay)
//   - modo: 'mayor_es_mejor' | 'menor_es_mejor' (afecta status y dirección
//           de threshold)
//   - dimensionPrincipal: dimensión para breakdown en drill-down
//                        ('liga' | 'casa' | 'plan' | 'origen' | 'source' | null)
//   - causasComunes/accionesRecomendadas: copy curado para drill-down
//                                          cuando KPI sale rojo

export type CategoriaKPI =
  | "captacion"
  | "productos"
  | "conversion"
  | "retencion"
  | "economicos";

export type FormatoKPI =
  | "number"
  | "percent"
  | "currency_pen"
  | "multiplier"
  | "duration_ms";

export type ModoComparacion = "mayor_es_mejor" | "menor_es_mejor";

export type DimensionBreakdown =
  | "liga"
  | "casa"
  | "plan"
  | "origen"
  | "source"
  | "device"
  | "ruta"
  | null;

export interface KPIMeta {
  id: string;
  label: string;
  categoria: CategoriaKPI;
  formato: FormatoKPI;
  target: number | null;
  targetLabel?: string;
  modo: ModoComparacion;
  dimensionPrincipal: DimensionBreakdown;
  /** Texto descriptivo para tooltip / drill-down. */
  descripcion: string;
  /** Cuando KPI cae en rojo, lista de posibles causas. */
  causasComunes: string[];
  /** Acciones a tomar para mejorar. */
  accionesRecomendadas: string[];
  /** Si true, este KPI todavía no tiene tracking implementado y siempre
   *  devuelve null/neutral. Documenta deuda de cableado. */
  pendienteCableado?: boolean;
}

const KPIS_CATALOG: KPIMeta[] = [
  // -------------------------------------------------------------------
  // 1. Captación
  // -------------------------------------------------------------------
  {
    id: "visitantes_unicos",
    label: "Visitantes únicos",
    categoria: "captacion",
    formato: "number",
    target: 30000,
    targetLabel: "30k+ post-launch",
    modo: "mayor_es_mejor",
    dimensionPrincipal: "source",
    descripcion:
      "Visitantes únicos del periodo, contados por sessionId del evento $pageview.",
    causasComunes: [
      "Caída en posicionamiento SEO (Google Search Console).",
      "Drop de tráfico orgánico por penalización editorial.",
      "Redes sociales sin contenido nuevo.",
    ],
    accionesRecomendadas: [
      "Revisar Search Console por errores de indexación.",
      "Publicar 2-3 artículos nuevos en /blog para refrescar contenido.",
      "Compartir top picks en X/Threads para tráfico social.",
    ],
  },
  {
    id: "registros_nuevos",
    label: "Registros nuevos",
    categoria: "captacion",
    formato: "number",
    target: 1500,
    targetLabel: "1.5k+ / mes",
    modo: "mayor_es_mejor",
    dimensionPrincipal: "origen",
    descripcion:
      "Nuevos usuarios completaron signup en el periodo. Incluye Google OAuth + magic link.",
    causasComunes: [
      "Friction en el flow de signup (Google OAuth caído).",
      "Bajo tráfico al embudo (visitantes únicos cayendo).",
      "Magic link bouncing (Resend con problemas DNS).",
    ],
    accionesRecomendadas: [
      "Probar flujo de signup en incógnito.",
      "Revisar logs de auth en /admin/logs.",
      "Verificar tasa de bounces en Resend dashboard.",
    ],
  },
  {
    id: "conv_visita_registro",
    label: "Conv. visita → registro",
    categoria: "captacion",
    formato: "percent",
    target: 4,
    targetLabel: "4%+",
    modo: "mayor_es_mejor",
    dimensionPrincipal: "source",
    descripcion:
      "% de visitantes únicos que completaron signup en el mismo periodo. Pirámide de exposición, no funnel temporal estricto.",
    causasComunes: [
      "CTAs de signup poco visibles en home.",
      "Demasiados pasos en el flow (form pesado).",
      "Tráfico de baja intención (social vs search).",
    ],
    accionesRecomendadas: [
      "A/B test del hero de la home con CTAs más prominentes.",
      "Revisar tiempo de carga del form de signup.",
      "Segmentar conv por source y atacar el peor.",
    ],
  },
  {
    id: "tasa_rebote",
    label: "Tasa rebote",
    categoria: "captacion",
    formato: "percent",
    target: 60,
    targetLabel: "<60%",
    modo: "menor_es_mejor",
    dimensionPrincipal: "ruta",
    descripcion:
      "% de visitas con sessionDuration<10s. Pendiente de cableado (sessions no se persisten todavía).",
    causasComunes: [
      "LCP alto en home (>2.5s).",
      "Contenido que no responde la query del usuario.",
    ],
    accionesRecomendadas: [
      "Revisar /admin/mobile-vitals para LCP por ruta.",
      "Mejorar above-the-fold de las landing más visitadas.",
    ],
    pendienteCableado: true,
  },
  // -------------------------------------------------------------------
  // 2. Productos B y C
  // -------------------------------------------------------------------
  {
    id: "vistas_partido_dia",
    label: "Vistas partido / día",
    categoria: "productos",
    formato: "number",
    target: 1000,
    targetLabel: "1k+",
    modo: "mayor_es_mejor",
    dimensionPrincipal: "liga",
    descripcion:
      "Promedio de visitas a /partidos/[slug] por día en el periodo. Métrica clave del Producto B.",
    causasComunes: [
      "Pocos partidos importados (revisar cron C).",
      "Ligas no whitelisteadas en LIGAS_TOP.",
      "Caída de tráfico desde home/blog hacia partidos.",
    ],
    accionesRecomendadas: [
      "Verificar /api/v1/partidos devuelve partidos para hoy.",
      "Cross-link más prominente desde home a partidos top.",
      "Revisar logs de cron C (import-partidos).",
    ],
  },
  {
    id: "predicciones_partido",
    label: "Predicciones / partido",
    categoria: "productos",
    formato: "number",
    target: 100,
    targetLabel: "100+",
    modo: "mayor_es_mejor",
    dimensionPrincipal: "liga",
    descripcion:
      "Tickets enviados promedio por partido. Mide tracción del Producto C (Liga Habla! gratuita).",
    causasComunes: [
      "Pocos tipsters activos.",
      "UX de predicción confuso (form de 5 mercados).",
      "Premio mensual no comunicado en home.",
    ],
    accionesRecomendadas: [
      "Banner home destacando S/1,250 mensuales en premios.",
      "Email semanal con 'predicción del finde' a usuarios inactivos.",
      "Reducir fricción del form (autosave drafts).",
    ],
  },
  {
    id: "tipsters_activos",
    label: "Tipsters activos / mes",
    categoria: "productos",
    formato: "percent",
    target: 30,
    targetLabel: "30%+",
    modo: "mayor_es_mejor",
    dimensionPrincipal: "origen",
    descripcion:
      "% del total de usuarios registrados que enviaron al menos 1 ticket en el mes.",
    causasComunes: [
      "Users registrándose pero no engaging.",
      "Onboarding incompleto (no llegan a su primer ticket).",
      "Sin notificaciones de partido inminente.",
    ],
    accionesRecomendadas: [
      "Revisar tasa de envío del email 'partido próximo'.",
      "Onboarding sticky CTA en /perfil para registrar primer ticket.",
      "Push notification al móvil 1h antes del partido grande de la fecha.",
    ],
  },
  {
    id: "cross_link_b_c",
    label: "Cross-link B↔C",
    categoria: "productos",
    formato: "percent",
    target: 25,
    targetLabel: "25%+",
    modo: "mayor_es_mejor",
    dimensionPrincipal: null,
    descripcion:
      "% de usuarios que clickean el banner Producto C desde una vista de partido (Producto B). Pendiente de cableado del evento canónico.",
    causasComunes: [
      "Banner cross-link poco visible o sin contexto.",
    ],
    accionesRecomendadas: [
      "Mover banner cross-link arriba del fold en /partidos/[slug].",
      "Agregar microcopy con countdown del torneo activo.",
    ],
    pendienteCableado: true,
  },
  // -------------------------------------------------------------------
  // 3. Conversión
  // -------------------------------------------------------------------
  {
    id: "ctr_afiliados",
    label: "CTR site-wide afiliados",
    categoria: "conversion",
    formato: "percent",
    target: 5,
    targetLabel: "5%+",
    modo: "mayor_es_mejor",
    dimensionPrincipal: "casa",
    descripcion:
      "% de visitantes únicos que clickearon al menos 1 link afiliado en el periodo.",
    causasComunes: [
      "CTAs de afiliados poco prominentes en blog/guías.",
      "Comparador de cuotas no visible.",
      "Bono actual de las casas poco atractivo.",
    ],
    accionesRecomendadas: [
      "Auditar visibilidad del <CuotasComparator> en partidos top.",
      "Refrescar copy de bonos en /casas con valores actualizados.",
      "Probar CTAs sticky en mobile para casas top.",
    ],
  },
  {
    id: "click_a_registro_casa",
    label: "Click → registro casa",
    categoria: "conversion",
    formato: "percent",
    target: 25,
    targetLabel: "25%+",
    modo: "mayor_es_mejor",
    dimensionPrincipal: "casa",
    descripcion:
      "% de clicks afiliados que terminan en registro reportado por la casa. Reportes manuales en /admin/conversiones.",
    causasComunes: [
      "Tracking link roto (cookie no persiste).",
      "Casa con flow de signup pesado o caído.",
      "Reporte de la casa atrasado (verificar mensual).",
    ],
    accionesRecomendadas: [
      "Probar registro con cookie limpia desde /go/[slug].",
      "Solicitar reporte actualizado al partner manager de la casa.",
      "Revisar logs de redirect en /admin/logs (source=api:go).",
    ],
  },
  {
    id: "registro_a_ftd",
    label: "Registro → FTD",
    categoria: "conversion",
    formato: "percent",
    target: 25,
    targetLabel: "25%+",
    modo: "mayor_es_mejor",
    dimensionPrincipal: "casa",
    descripcion:
      "% de registros que depositaron por primera vez (FTD reportado por la casa). Depende del reporte mensual del afiliado.",
    causasComunes: [
      "Casa con UX de depósito complicado.",
      "Medio de pago de la casa con problemas (Yape/Plin).",
      "Bono actual no atractivo al usuario peruano.",
    ],
    accionesRecomendadas: [
      "Comparar con benchmark de casas top de la industria.",
      "Pedir feedback a usuarios que llegaron a registro pero no FTD.",
      "Renegociar bono con la casa partner.",
    ],
  },
  {
    id: "free_a_premium",
    label: "Free → Premium",
    categoria: "conversion",
    formato: "percent",
    target: 1,
    targetLabel: "1%+",
    modo: "mayor_es_mejor",
    dimensionPrincipal: "origen",
    descripcion:
      "% de usuarios totales con suscripción Premium activa. Métrica clave del 4to producto.",
    causasComunes: [
      "Pocos picks Premium destacables (track record bajo).",
      "Landing /premium con CTA poco claro.",
      "Garantía 7 días no comunicada lo suficiente.",
    ],
    accionesRecomendadas: [
      "Refrescar testimonios en /premium con casos recientes.",
      "Track record visible: % aciertos últimos 30 días.",
      "Email a tipsters activos con teaser de pick Premium.",
    ],
  },
  // -------------------------------------------------------------------
  // 4. Retención
  // -------------------------------------------------------------------
  {
    id: "mrr_premium",
    label: "MRR Premium",
    categoria: "retencion",
    formato: "currency_pen",
    target: null,
    modo: "mayor_es_mejor",
    dimensionPrincipal: "plan",
    descripcion:
      "Monthly Recurring Revenue. Suma mensualizada de suscripciones activas: mensual=precio, trimestral=precio/3, anual=precio/12.",
    causasComunes: [
      "Bajo número de suscripciones activas.",
      "Mix muy concentrado en plan mensual (menor LTV).",
    ],
    accionesRecomendadas: [
      "Promocionar plan trimestral/anual con descuento implícito.",
      "Email a suscriptores mensuales ofreciendo upgrade.",
    ],
  },
  {
    id: "churn_mensual",
    label: "Churn mensual",
    categoria: "retencion",
    formato: "percent",
    target: 20,
    targetLabel: "<20%",
    modo: "menor_es_mejor",
    dimensionPrincipal: "plan",
    descripcion:
      "% de suscripciones canceladas en el mes vs total activas + canceladas. Alto = problema de retención.",
    causasComunes: [
      "Calidad de picks bajó (track record reciente malo).",
      "Frecuencia de envío al Channel insuficiente.",
      "Bot 1:1 lento o no responde bien.",
    ],
    accionesRecomendadas: [
      "Revisar % aciertos últimos 30 días en /admin/picks-premium.",
      "Verificar que el cron de envío al Channel está corriendo.",
      "Sample de conversaciones del bot para QA.",
    ],
  },
  {
    id: "dau_mau",
    label: "DAU/MAU ratio",
    categoria: "retencion",
    formato: "percent",
    target: 15,
    targetLabel: "15%+",
    modo: "mayor_es_mejor",
    dimensionPrincipal: null,
    descripcion:
      "Daily Active Users / Monthly Active Users. Mide engagement diario. Pendiente de cableado.",
    causasComunes: [
      "Sin notificaciones diarias relevantes.",
      "Contenido editorial estático.",
    ],
    accionesRecomendadas: [
      "Push notification al móvil con partido del día.",
      "Email digest diario opt-in (después del semanal).",
    ],
    pendienteCableado: true,
  },
  {
    id: "engagement_channel",
    label: "Engagement Channel",
    categoria: "retencion",
    formato: "percent",
    target: 80,
    targetLabel: "80%+",
    modo: "mayor_es_mejor",
    dimensionPrincipal: null,
    descripcion:
      "% lecturas/envíos del WhatsApp Channel. Calculado en /admin/channel-whatsapp con base en `MiembroChannel.estado` y mensajes leídos.",
    causasComunes: [
      "Picks demasiado frecuentes (saturación).",
      "Calidad de los picks decreciendo.",
    ],
    accionesRecomendadas: [
      "Revisar cadencia de envío (1-3 picks/día razonable).",
      "Auditoría de aciertos en /admin/picks-premium.",
    ],
  },
  // -------------------------------------------------------------------
  // 5. Económicos
  // -------------------------------------------------------------------
  {
    id: "revenue_periodo",
    label: "Revenue Premium",
    categoria: "economicos",
    formato: "currency_pen",
    target: null,
    modo: "mayor_es_mejor",
    dimensionPrincipal: "plan",
    descripcion:
      "Total cobrado en pagos PAGADO en el periodo. Solo Premium — la afiliación se carga manual en /admin/finanzas.",
    causasComunes: [
      "Pagos rechazados (revisar /admin/suscripciones).",
      "Cobros recurrentes fallidos por tarjeta vencida.",
    ],
    accionesRecomendadas: [
      "Revisar suscripciones con FALLIDA/VENCIDA recientes.",
      "Email a usuarios con pago fallido para actualizar tarjeta.",
    ],
  },
  {
    id: "margen_operativo",
    label: "Margen operativo",
    categoria: "economicos",
    formato: "percent",
    target: 60,
    targetLabel: "60%+",
    modo: "mayor_es_mejor",
    dimensionPrincipal: null,
    descripcion:
      "(Revenue - costos operativos) / Revenue. Costos cargan manuales en /admin/finanzas.",
    causasComunes: [
      "Anthropic API gasto creciendo más rápido que revenue.",
      "Salarios o premios consumiendo proporción alta.",
    ],
    accionesRecomendadas: [
      "Auditar gasto de Anthropic Console (cap mensual).",
      "Verificar que costos están cargados al día.",
    ],
  },
  {
    id: "cac",
    label: "CAC",
    categoria: "economicos",
    formato: "currency_pen",
    target: 50,
    targetLabel: "<S/50",
    modo: "menor_es_mejor",
    dimensionPrincipal: "source",
    descripcion:
      "Costo de adquisición de cliente: marketing spend / nuevos suscriptores Premium. Pendiente de tracking de gasto.",
    causasComunes: [
      "Campañas paid sin tracking adecuado.",
    ],
    accionesRecomendadas: [
      "Cargar gasto de marketing en /admin/finanzas como costo categoría 'marketing_paid'.",
    ],
    pendienteCableado: true,
  },
  {
    id: "ltv_cac",
    label: "LTV/CAC",
    categoria: "economicos",
    formato: "multiplier",
    target: 3,
    targetLabel: "3x+",
    modo: "mayor_es_mejor",
    dimensionPrincipal: null,
    descripcion:
      "Lifetime Value / CAC. Necesita cohortes históricas de retención + CAC instrumentado.",
    causasComunes: [
      "LTV bajo por churn alto.",
      "CAC alto por canales pagos caros.",
    ],
    accionesRecomendadas: [
      "Atacar churn primero (mejor pick).",
      "Optimizar canales orgánicos vs pagos.",
    ],
    pendienteCableado: true,
  },
];

const CATEGORIAS: ReadonlyArray<{
  id: CategoriaKPI;
  titulo: string;
  emoji: string;
}> = [
  { id: "captacion", titulo: "Captación", emoji: "📥" },
  { id: "productos", titulo: "Productos B y C", emoji: "⚽" },
  { id: "conversion", titulo: "Conversión", emoji: "💰" },
  { id: "retencion", titulo: "Retención", emoji: "🔁" },
  { id: "economicos", titulo: "Económicos", emoji: "📈" },
];

export function obtenerCatalogoKPIs(): KPIMeta[] {
  return KPIS_CATALOG;
}

export function obtenerKPIPorId(id: string): KPIMeta | null {
  return KPIS_CATALOG.find((k) => k.id === id) ?? null;
}

export function obtenerKPIsPorCategoria(): Array<{
  id: CategoriaKPI;
  titulo: string;
  emoji: string;
  kpis: KPIMeta[];
}> {
  return CATEGORIAS.map((cat) => ({
    ...cat,
    kpis: KPIS_CATALOG.filter((k) => k.categoria === cat.id),
  }));
}
