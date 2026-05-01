// empty-states.ts — copy de vistas vacías.
//
// Tono: positivo, con next step accionable. Cero "Aún no hay nada acá" sin
// ofrecer salida. Templates con `{tiempo}`, `{n}` cuando aplica.

export const EMPTY_COPY = {
  partidos_sin_proximos: {
    h: "Sin partidos esta semana",
    sub: "Pronto subimos los próximos. Mira los pasados:",
    cta: "Ver últimos partidos",
  },
  mis_predicciones_sin: {
    h: "Aún sin predicciones",
    sub:
      "Empieza con un partido top y compite por S/ 1,250 al mes.",
    cta: "Ver partidos top",
  },
  comunidad_sin_actividad: {
    h: "Tipster nuevo",
    sub: "Aún sin predicciones. ¡Empieza ahora!",
  },
  blog_sin_posts: {
    h: "Pronto más análisis",
    sub: "El editor publica 2-3 posts por semana.",
  },
  premium_sin_picks_aprobados: {
    h: "Picks llegan en horas",
    sub: "Nuestro editor publica 2-4 picks/día con razonamiento.",
  },
  admin_sin_picks_pendientes: {
    h: "✓ Todo al día",
    sub: "Sin picks pendientes. Próxima generación: en {tiempo}.",
  },
  admin_filtros_sin_resultados: {
    h: "Sin resultados",
    sub: "Prueba ajustando los filtros.",
  },
  casas_sin_seleccion: {
    h: "Sin casas conectadas",
    sub:
      "Cuando hagas tu primer depósito en una casa, aparecerá acá.",
  },
} as const;
