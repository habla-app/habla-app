// Schemas Zod para validar input en los route handlers de tickets.
// CLAUDE.md §14 — validación Zod en todo endpoint.

import { z } from "zod";

/**
 * Marcador exacto: 0..9 por equipo. 9 es tope duro — marcadores
 * ≥10-0 son ruido estadístico y no queremos un input field que
 * acepte valores absurdos.
 */
const MarcadorValor = z.number().int().min(0).max(9);

export const CrearTicketBodySchema = z.object({
  torneoId: z.string().min(1).max(40),
  predResultado: z.enum(["LOCAL", "EMPATE", "VISITA"]),
  predBtts: z.boolean(),
  predMas25: z.boolean(),
  predTarjetaRoja: z.boolean(),
  predMarcadorLocal: MarcadorValor,
  predMarcadorVisita: MarcadorValor,
});

export type CrearTicketBody = z.infer<typeof CrearTicketBodySchema>;

export const ListarMisTicketsQuerySchema = z.object({
  estado: z.enum(["ACTIVOS", "GANADOS", "HISTORIAL"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
