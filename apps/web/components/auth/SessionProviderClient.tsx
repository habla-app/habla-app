"use client";
// SessionProviderClient — envuelve el árbol con el SessionProvider de
// NextAuth v5 para que los client components puedan usar `useSession()`
// (notablemente CompletarPerfilForm que llama a `update()` tras completar).
//
// El layout raíz lo monta alto en el árbol. El SessionProvider tolera no
// tener sesión — devuelve `data: null, status: "unauthenticated"`.

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

export function SessionProviderClient({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
