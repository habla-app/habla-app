// Custom NextAuth adapter que se mapea al modelo `Usuario` con campo `nombre`.
// El PrismaAdapter oficial asume model `User` con campo `name`; aqui adaptamos
// sin renombrar la tabla ni los campos existentes del dominio.
//
// Solo implementa lo necesario para Resend (magic link) + session JWT.
import type { Adapter, AdapterUser } from "next-auth/adapters";
import { prisma, type Usuario } from "@habla/db";

const BONUS_BIENVENIDA_LUKAS = 500;

function toAdapterUser(u: Usuario): AdapterUser {
  return {
    id: u.id,
    email: u.email,
    emailVerified: u.emailVerified,
    name: u.nombre,
    image: u.image,
  };
}

export function HablaPrismaAdapter(): Adapter {
  return {
    async createUser(data) {
      // Crear usuario + 500 Lukas de bienvenida en transaccion atomica.
      const email = data.email.toLowerCase();
      const nombre = data.name ?? email.split("@")[0];

      const existente = await prisma.usuario.findUnique({ where: { email } });
      if (existente) return toAdapterUser(existente);

      const usuario = await prisma.$transaction(async (tx) => {
        const creado = await tx.usuario.create({
          data: {
            email,
            nombre,
            balanceLukas: BONUS_BIENVENIDA_LUKAS,
            emailVerified: data.emailVerified,
            image: data.image,
          },
        });

        await tx.transaccionLukas.create({
          data: {
            usuarioId: creado.id,
            tipo: "BONUS",
            monto: BONUS_BIENVENIDA_LUKAS,
            descripcion: "Bonus de bienvenida",
            venceEn: null,
          },
        });

        return creado;
      });

      return toAdapterUser(usuario);
    },

    async getUser(id) {
      const u = await prisma.usuario.findUnique({ where: { id } });
      return u ? toAdapterUser(u) : null;
    },

    async getUserByEmail(email) {
      const u = await prisma.usuario.findUnique({
        where: { email: email.toLowerCase() },
      });
      return u ? toAdapterUser(u) : null;
    },

    async getUserByAccount({ provider, providerAccountId }) {
      const account = await prisma.account.findUnique({
        where: {
          provider_providerAccountId: { provider, providerAccountId },
        },
        include: { user: true },
      });
      return account ? toAdapterUser(account.user) : null;
    },

    async updateUser({ id, ...data }) {
      if (!id) throw new Error("updateUser: id is required");
      const u = await prisma.usuario.update({
        where: { id },
        data: {
          email: data.email?.toLowerCase(),
          nombre: data.name ?? undefined,
          emailVerified: data.emailVerified,
          image: data.image,
        },
      });
      return toAdapterUser(u);
    },

    async linkAccount(data) {
      await prisma.account.create({
        data: {
          userId: data.userId,
          type: data.type,
          provider: data.provider,
          providerAccountId: data.providerAccountId,
          refresh_token: data.refresh_token,
          access_token: data.access_token,
          expires_at: data.expires_at,
          token_type: data.token_type,
          scope: data.scope,
          id_token: data.id_token,
          session_state:
            typeof data.session_state === "string"
              ? data.session_state
              : undefined,
        },
      });
    },

    async createVerificationToken(data) {
      await prisma.verificationToken.create({ data });
      return data;
    },

    async useVerificationToken({ identifier, token }) {
      try {
        return await prisma.verificationToken.delete({
          where: { identifier_token: { identifier, token } },
        });
      } catch {
        return null;
      }
    },
  };
}
