// home.ts — copy de la home `/`.
//
// Personalización por estado: anonimo (lead capture) vs authed (cross-link
// a Liga + partidos). Templates con `{nombre}`, `{posicion}`, `{tipsters}`.

export const HOME_COPY = {
  hero: {
    h1_anonimo: "Apuestas con datos. Sin trampas.",
    h1_authed: "Hola {nombre}, ¿qué predices hoy?",
    sub_anonimo:
      "Compara cuotas, predice partidos top, gana hasta S/ 1,250/mes.",
    sub_authed: "Tu posición actual: #{posicion} de la Liga Habla!",
    cta_anonimo: "⚡ Crear cuenta gratis",
    cta_authed: "Ver partidos top →",
  },
  live_banner: {
    label_live: "● EN VIVO",
    cta_ver: "Ver →",
    descripcion_template: "{local} {goll} - {golv} {visitante} · Min {min}'",
  },
  partidos_top_section: {
    h2: "Partidos top de la semana",
    cta_ver_todos: "Ver todos los partidos →",
  },
  comunidad_preview: {
    h2: "Liga Habla! · {mes}",
    sub: "{tipsters} tipsters compitiendo por S/ 1,250",
    cta: "Ver leaderboard →",
  },
  blog_section: {
    h2: "Análisis del editor",
    cta_todos: "Ver más posts →",
  },
} as const;
