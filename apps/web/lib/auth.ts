// Configuración NextAuth v5 (5.0.0-beta.30).
//
// Providers (registro formal Abr 2026):
//  - Google OAuth (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET). Primera vez
//    crea usuario con username temporal + usernameLocked=false — middleware
//    fuerza a /auth/completar-perfil.
//  - Resend magic link (RESEND_API_KEY). Usado por email sign-in; el email
//    sign-up pasa primero por POST /api/v1/auth/signup que crea el usuario
//    con username definitivo antes de disparar el magic link.
//
// Session strategy: JWT. Exponemos en session.user: id, rol, username,
// usernameLocked.

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { HablaPrismaAdapter } from "@/lib/auth-adapter";
import { prisma } from "@habla/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Railway corre la app detrás de un proxy; sin esto NextAuth rechaza
  // el host reenviado (habla-app-production.up.railway.app).
  trustHost: true,
  adapter: HablaPrismaAdapter(),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // `allowDangerousEmailAccountLinking`: si un usuario creó cuenta con
      // magic link y luego intenta entrar con Google usando el mismo email,
      // NextAuth linkea las cuentas en vez de rechazar. El caso contrario
      // (OAuth primero, magic link después) también queda soportado.
      allowDangerousEmailAccountLinking: true,
    }),
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: "Habla! <equipo@hablaplay.com>",
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn() {
      // El adapter ya creó (o encontró) al usuario. Aceptamos siempre —
      // si el usuario no tiene username definitivo, el middleware lo
      // manda a /auth/completar-perfil.
      return true;
    },
    async jwt({ token, user, trigger }) {
      // En el primer login, cargar datos desde BD al token JWT. En updates
      // explícitos (session.update() tras completar-perfil), refrescar
      // username y usernameLocked.
      if (user?.email) {
        const u = await prisma.usuario.findUnique({
          where: { email: user.email.toLowerCase() },
          select: {
            id: true,
            rol: true,
            username: true,
            usernameLocked: true,
          },
        });
        if (u) {
          token.usuarioId = u.id;
          token.rol = u.rol;
          token.username = u.username;
          token.usernameLocked = u.usernameLocked;
        }
      }

      if (trigger === "update" && token.usuarioId) {
        const u = await prisma.usuario.findUnique({
          where: { id: token.usuarioId as string },
          select: { username: true, usernameLocked: true, rol: true },
        });
        if (u) {
          token.username = u.username;
          token.usernameLocked = u.usernameLocked;
          token.rol = u.rol;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token.usuarioId && session.user) {
        session.user.id = token.usuarioId as string;
        session.user.rol = (token.rol as "JUGADOR" | "ADMIN") ?? "JUGADOR";
        session.user.username = (token.username as string) ?? "";
        session.user.usernameLocked =
          (token.usernameLocked as boolean) ?? false;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    verifyRequest: "/auth/verificar",
    error: "/auth/error",
    newUser: "/auth/completar-perfil",
  },
});
