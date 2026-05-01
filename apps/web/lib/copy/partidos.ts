// partidos.ts — copy del Producto B `/partidos/[slug]` y `/cuotas`.
//
// Glosario: "pronóstico Habla!" (gratuito) vs "pick Premium" (pago),
// "comparador de cuotas", "casa con licencia MINCETUR", "BTTS" → "Ambos
// anotan", "Over/Under 2.5" → "Más/menos 2.5 goles", "1X2" → "Resultado".

export const PARTIDOS_COPY = {
  hero: {
    label_proximo: "Próximo partido",
    label_vivo: "● EN VIVO",
    label_finalizado: "Finalizado",
    fecha_template: "{dia} {fecha} · {hora}",
  },
  pronostico_seccion: {
    h2: "Pronóstico Habla!",
    sub_anonimo: "El editor analiza el partido y predice los 5 mercados.",
    sub_user: "Análisis del editor para los 5 mercados.",
    label_confianza: "Confianza:",
    label_razonamiento: "Por qué este pronóstico",
  },
  prediccion_form: {
    h2: "Tu predicción",
    sub_unauth:
      "Crea cuenta gratis para predecir y competir por S/ 1,250 al mes.",
    sub_authed: "Predice los 5 mercados. Cierra al kickoff.",
    label_resultado: "Resultado",
    label_btts: "Ambos anotan",
    label_ou: "Más / menos 2.5 goles",
    label_roja: "Habrá tarjeta roja",
    label_marcador: "Marcador exacto",
    cta_predecir: "Enviar predicción",
    cta_unauth: "⚡ Crear cuenta y predecir",
    aviso_cierre: "Cierra al kickoff. No se puede cambiar después.",
    success: "✓ Predicción guardada",
    error: "No pudimos guardar tu predicción. Intenta de nuevo.",
    error_cerrado:
      "Las predicciones para este partido cerraron al kickoff.",
  },
  comparador_cuotas: {
    h2: "Compara cuotas",
    sub: "Las casas con licencia MINCETUR.",
    label_mejor_cuota: "★ Mejor cuota",
    cta_apostar: "Apostar en {casa} →",
    aviso: "_Apuesta responsable. Cuotas pueden cambiar._",
  },
  pick_premium_section: {
    bloqueado_h: "💎 Pick Premium del editor",
    bloqueado_sub_anonimo: "Crea cuenta y desbloquea con Premium.",
    bloqueado_sub_free: "Suscríbete para acceder al pick + razonamiento.",
    bloqueado_sub_ftd:
      "Tu acierto puede subir con picks Premium del editor.",
    bloqueado_cta_anonimo: "⚡ Crear cuenta",
    bloqueado_cta_free: "⚡ Probar 7 días",
    desbloqueado_h: "💎 Pick Premium · APROBADO",
    desbloqueado_label_mercado: "Mercado",
    desbloqueado_label_cuota: "Cuota sugerida",
    desbloqueado_label_stake: "Stake",
    desbloqueado_label_ev: "EV+",
    desbloqueado_label_casa: "Mejor cuota",
    desbloqueado_cta: "Apostar en {casa} →",
  },
} as const;
