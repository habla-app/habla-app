// comunidad.ts — copy del Producto C `/comunidad/*`.
//
// Glosario: "tipster" (usuario que predice), "predicción", "ticket"
// (5 mercados de un partido), "torneo" (1 partido top), "leaderboard",
// "podio", "premio mensual", "cierre del mes".

export const COMUNIDAD_COPY = {
  index: {
    h1: "Liga Habla!",
    sub_template: "{mes} · {tipsters} tipsters · S/ {premio} en premios",
    section_premios_h: "Premios mensuales",
    section_top10_h: "🏅 Top 10 del mes",
    section_top100_h: "🏆 Top 100",
    cta_ver_mas: "Ver más",
    section_meses_h: "Meses cerrados",
  },
  premios: {
    primer: "1° lugar: S/ 500",
    segundo_tercero: "2° y 3° lugar: S/ 200 c/u",
    cuarto_decimo: "4°-10° lugar: S/ 50 c/u",
    total: "Total mensual: S/ 1,250",
  },
  mis_stats: {
    title_authed: "Tu posición",
    label_puntos: "Puntos este mes",
    label_posicion: "Posición actual",
    label_delta: "vs semana anterior",
    cta: "Ver mis predicciones →",
    empty_h: "Aún no participas este mes",
    empty_cta: "Hacer primera predicción →",
  },
  torneo_partido: {
    h_template: "{equipoA} vs {equipoB}",
    label_estado_abierto: "Predicciones abiertas",
    label_estado_cerrado: "Predicciones cerradas",
    label_cierre_template: "Cierra en {tiempo}",
    cta_predecir: "Hacer mi predicción",
    leaderboard_h: "Ranking del torneo",
    leaderboard_actualiza: "Se actualiza al final del partido",
  },
  perfil_publico: {
    cta_seguir: "+ Seguir",
    cta_siguiendo: "✓ Siguiendo",
    cta_editar: "Editar perfil",
    cta_reportar: "Reportar",
    label_nivel: "Nivel",
    label_predicciones: "Predicciones",
    label_aciertos: "Aciertos",
    label_acierto_pct: "% Acierto",
    label_mejor_mes: "Mejor mes",
    label_pos_historica: "Mejor posición",
    h_ultimas: "📊 Últimas predicciones",
    h_mejor_en: "🏆 Mejor en",
    privado: "Este perfil es privado",
  },
} as const;
