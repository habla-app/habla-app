// Constantes globales del negocio.
//
// NOTA: el backend Fastify de apps/api está congelado como backlog
// post-MVP. La fuente de verdad runtime de las constantes económicas
// vive en apps/web/lib/config/economia.ts (ver Lote 4, Plan v6). Estos
// valores acá se mantienen sólo por consistencia para cuando este
// servicio se descongele.
export const RAKE_PERCENTAGE = 0.12; // 12% del pozo bruto
export const MAX_TICKETS_PER_USER = 10; // Maximo tickets por usuario por torneo (MVP)
export const CIERRE_MINUTOS_ANTES = 0; // Cierre al kickoff (Plan v6)
export const POLLING_INTERVAL_MS = 30_000; // Polling API-Football cada 30 segundos
export const RATE_LIMIT_MAX = 60; // 60 requests por minuto por IP
export const LUKAS_VENCIMIENTO_MESES = 36; // Lukas comprados vencen a los 36 meses (Plan v6)
export const EDAD_MINIMA = 18; // Edad minima para registrarse
