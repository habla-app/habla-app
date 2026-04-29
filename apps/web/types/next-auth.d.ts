// Extensiones de tipos de NextAuth v5 para los campos custom de Habla!
// Se agregan: id, rol, username, usernameLocked en session.user.

import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      rol: "JUGADOR" | "ADMIN";
      /** @handle público único (3-20 chars, lowercase, [a-z0-9_]). NOT NULL
       *  en BD desde Abr 2026. Si `usernameLocked=false`, es temporal
       *  `new_<hex>` y el middleware fuerza a /auth/completar-perfil. */
      username: string;
      /** true tras completar-perfil: el @handle queda inmutable. false
       *  mientras el usuario viene de OAuth sin haber elegido handle. */
      usernameLocked: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    usuarioId?: string;
    rol?: "JUGADOR" | "ADMIN";
    username?: string;
    usernameLocked?: boolean;
  }
}
