// Extensiones de tipos de NextAuth v5 para incluir campos custom de Habla!
// Se agregan: id, balanceLukas, rol en la sesion.

import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      balanceLukas: number;
      rol: "JUGADOR" | "ADMIN";
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    usuarioId?: string;
    rol?: "JUGADOR" | "ADMIN";
  }
}
