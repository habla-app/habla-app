// Barrel export del catálogo de microcopy v3.1 (Lote H).
//
// Cada archivo agrupa strings por superficie del producto. Estructura
// i18n-ready: aunque arrancamos solo en español neutro Perú, los textos
// viven en archivos `.ts` con shape de objeto tipado para permitir un
// fork futuro a `es-PE`/`es-MX`/`pt-BR` sin reescritura masiva.
//
// Tono: ver `docs/ux-spec/07-microcopy-emails-whatsapp/tono-de-voz.spec.md`.
// Glosario: ver `docs/ux-spec/07-microcopy-emails-whatsapp/glosario.spec.md`.

export { tpl } from "./template";

export { AUTH_COPY } from "./auth";
export { HOME_COPY } from "./home";
export { PARTIDOS_COPY } from "./partidos";
export { COMUNIDAD_COPY } from "./comunidad";
export { PREMIUM_COPY } from "./premium";
export { PERFIL_COPY } from "./perfil";
export { ADMIN_COPY } from "./admin";
export { ERRORES_COPY } from "./errores";
export { EMPTY_COPY } from "./empty-states";
export { TOAST_COPY, BANNER_COPY } from "./notificaciones";
