// Barrel export del módulo email v3.1 (Lote H).
//
// Reemplaza progresivamente a `lib/emails/templates.ts` (HTML strings,
// Lote 0-E) y `lib/services/email.service.ts` (helpers tipados sobre
// templates HTML). Los templates legacy siguen funcionando sin cambios:
// los nuevos triggers (Premium Bienvenida v2, Newsletter doble opt-in con
// React Email) usan los templates `.tsx` desde acá.

export * from "./templates";
export * from "./types";
export { sendEmail } from "./send";
export type { SendEmailOpts } from "./send";
export {
  fmtFechaLarga,
  fmtFechaCorta,
  fmtSolesCentimos,
  fmtSolesNumero,
  ordinalEs,
} from "./format";
