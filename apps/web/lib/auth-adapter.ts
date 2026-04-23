// Custom NextAuth adapter — mapea el modelo `Usuario` (campo `nombre`) al
// contrato adapter de NextAuth (`name`). Soporta magic link (Resend) y
// OAuth (Google).
//
// Registro formal (Abr 2026): ahora `username` es NOT NULL. Cuando NextAuth
// pide createUser (OAuth primera vez, o magic-link sin flujo previo),
// asignamos un handle temporal `new_<hex>` con `usernameLocked=false`. El
// middleware fuerza al usuario a `/auth/completar-perfil` antes de dejarlo
// entrar al grupo `(main)`. En el flujo de email signup (POST
// /api/v1/auth/signup) el usuario ya llega creado con username real +
// `usernameLocked=true`, así que aquí solo cae el OAuth.

import crypto from "node:crypto";
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

/**
 * Genera un username temporal único con formato `new_<hex6>`. Reintenta
 * hasta 5 veces en caso de colisión (altamente improbable).
 */
async function generarUsernameTemporal(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const candidato = `new_${crypto.randomBytes(3).toString("hex")}`;
    const existe = await prisma.usuario.findUnique({
      where: { username: candidato },
      select: { id: true },
    });
    if (!existe) return candidato;
  }
  // Fallback con más entropía
  return `new_${crypto.randomBytes(6).toString("hex")}`;
}

export function HablaPrismaAdapter(): Adapter {
  return {
    async createUser(data) {
      // Flujo OAuth (o magic-link sin signup previo): el usuario no tiene
      // @handle aún — asignamos temporal + bonus de bienvenida en una
      // transacción atómica. El middleware lo ruteará a `/auth/completar-perfil`.
      const email = data.email.toLowerCase();
      const nombre = data.name ?? email.split("@")[0];

      const existente = await prisma.usuario.findUnique({ where: { email } });
      if (existente) return toAdapterUser(existente);

      const usernameTemporal = await generarUsernameTemporal();

      const usuario = await prisma.$transaction(async (tx) => {
        const creado = await tx.usuario.create({
          data: {
            email,
            nombre,
            username: usernameTemporal,
            usernameLocked: false,
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
