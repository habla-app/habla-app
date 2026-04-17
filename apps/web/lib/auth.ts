// Configuracion NextAuth v5 (5.0.0-beta.30)
// Provider unico: magic link por email via Resend.
// Google OAuth se agrega post-lanzamiento.
//
// Usa PrismaAdapter para persistir tokens de verificacion del magic link
// (tablas Account, Session, VerificationToken en el schema).

import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { HablaPrismaAdapter } from "@/lib/auth-adapter";
import { crearOEncontrarUsuario, obtenerBalance } from "@/lib/usuarios";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Railway corre la app detras de un proxy; NextAuth v5 por defecto no
  // confia en el host. Con trustHost aceptamos el host reenviado por el
  // proxy de Railway (habla-app-production.up.railway.app).
  trustHost: true,
  adapter: HablaPrismaAdapter(),
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: "Habla! <noreply@hablaplay.com>",
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user }) {
      // En el primer login (magic link confirmado), crear el usuario en BD
      // con 500 Lukas de bienvenida. Si ya existe, retornar el existente.
      if (!user.email) return false;

      await crearOEncontrarUsuario({
        email: user.email,
        nombre: user.name ?? user.email.split("@")[0],
      });

      return true;
    },
    async jwt({ token, user, trigger }) {
      // En el primer login, cargar datos del usuario desde la BD al token.
      if (user?.email) {
        const usuario = await crearOEncontrarUsuario({
          email: user.email,
          nombre: user.name ?? user.email.split("@")[0],
        });
        token.usuarioId = usuario.id;
        token.rol = usuario.rol;
      }

      // En updates explicitos de sesion, refrescar rol desde BD.
      if (trigger === "update" && token.usuarioId) {
        // Placeholder para refresh futuro — por ahora no hacemos nada extra.
      }

      return token;
    },
    async session({ session, token }) {
      // Inyectar usuarioId, balanceLukas y rol en la sesion que ve el frontend.
      if (token.usuarioId && session.user) {
        session.user.id = token.usuarioId as string;
        session.user.rol = (token.rol as "JUGADOR" | "ADMIN") ?? "JUGADOR";
        session.user.balanceLukas = await obtenerBalance(
          token.usuarioId as string
        );
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/login",
    verifyRequest: "/auth/verificar",
    error: "/auth/error",
  },
});
