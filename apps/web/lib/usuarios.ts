// Modulo de usuarios — funciones server-side que usan Prisma directamente.
// En Sprint 1 el frontend se conecta a la BD sin backend Fastify intermedio.
// El backend Fastify se levanta en el Sprint 2.

import { prisma, type Usuario } from "@habla/db";

const BONUS_BIENVENIDA_LUKAS = 500;

/**
 * Busca usuario por email. Retorna null si no existe.
 */
export async function encontrarUsuarioPorEmail(
  email: string
): Promise<Usuario | null> {
  return prisma.usuario.findUnique({
    where: { email: email.toLowerCase() },
  });
}

/**
 * Crea un usuario nuevo con 500 Lukas de bienvenida (tipo BONUS, venceEn: null).
 * Si el usuario ya existe, retorna el existente sin crear duplicado.
 * La creacion del usuario y los 500 Lukas bonus es una transaccion atomica:
 * si falla cualquier paso, se revierte todo.
 */
export async function crearOEncontrarUsuario(data: {
  email: string;
  nombre: string;
}): Promise<Usuario> {
  const email = data.email.toLowerCase();

  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) return existente;

  // Crear usuario + transaccion de bonus de bienvenida en una sola transaccion atomica.
  return prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.create({
      data: {
        email,
        nombre: data.nombre,
        balanceLukas: BONUS_BIENVENIDA_LUKAS,
      },
    });

    await tx.transaccionLukas.create({
      data: {
        usuarioId: usuario.id,
        tipo: "BONUS",
        monto: BONUS_BIENVENIDA_LUKAS,
        descripcion: "Bonus de bienvenida",
        venceEn: null, // Los Lukas de bienvenida NO vencen
      },
    });

    return usuario;
  });
}

/**
 * Retorna el balance actual de Lukas del usuario.
 * Si el usuario no existe, retorna 0.
 */
export async function obtenerBalance(usuarioId: string): Promise<number> {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { balanceLukas: true },
  });
  return usuario?.balanceLukas ?? 0;
}
