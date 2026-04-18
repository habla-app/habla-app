// Schemas Zod para validar input en los route handlers de torneos.
// CLAUDE.md §14: validación Zod en todo endpoint.

import { z } from "zod";

export const ListarTorneosQuerySchema = z.object({
  estado: z
    .enum(["ABIERTO", "CERRADO", "EN_JUEGO", "FINALIZADO", "CANCELADO"])
    .optional(),
  liga: z.string().min(1).max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const CrearTorneoBodySchema = z.object({
  partidoId: z.string().min(1),
  tipo: z.enum(["EXPRESS", "ESTANDAR", "PREMIUM", "GRAN_TORNEO"]),
  entradaLukas: z.number().int().positive().max(10_000),
  nombre: z.string().min(1).max(120).optional(),
});

export const ImportarPartidosBodySchema = z.object({
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato esperado: YYYY-MM-DD"),
});
