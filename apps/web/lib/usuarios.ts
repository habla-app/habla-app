// Módulo de usuarios — helpers server-side sobre Prisma.
//
// Registro formal (Abr 2026): la creación de usuarios ya no pasa por este
// módulo. El flujo email crea vía POST /api/v1/auth/signup (que usa
// prisma directo con username + T&C). El flujo OAuth Google crea vía el
// adapter de NextAuth (`auth-adapter.ts`) que asigna un username
// temporal. La función antigua `crearOEncontrarUsuario` quedó removida
// porque creaba usuarios sin `username` — lo que revienta ahora que el
// campo es NOT NULL.

import { prisma, type Usuario } from "@habla/db";

/**
 * Busca usuario por email. Retorna null si no existe.
 */
export async function encontrarUsuarioPorEmail(
  email: string,
): Promise<Usuario | null> {
  return prisma.usuario.findUnique({
    where: { email: email.toLowerCase() },
  });
}

/**
 * Retorna el balance actual de Lukas del usuario. 0 si no existe.
 */
export async function obtenerBalance(usuarioId: string): Promise<number> {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { balanceLukas: true },
  });
  return usuario?.balanceLukas ?? 0;
}
