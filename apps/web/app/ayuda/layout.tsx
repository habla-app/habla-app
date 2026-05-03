// Layout /ayuda/* — Lote S v3.2 (rewrite del Lote B).
//
// Comparte shell único con (public) y (main): NavBar + Footer + BottomNav,
// con AuthStateProvider para los componentes que usan <AuthGate>.

import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { obtenerEstadoAuthServer } from "@/lib/services/auth-state.service";
import { NavBar } from "@/components/layout/NavBar";
import { Footer } from "@/components/layout/Footer";
import { BottomNav } from "@/components/layout/BottomNav";
import { AuthStateProvider } from "@/components/auth/AuthStateProvider";

export default async function AyudaLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  const estadoAuth = await obtenerEstadoAuthServer(session?.user?.id ?? null);

  return (
    <AuthStateProvider initialState={estadoAuth}>
      <NavBar />
      <main>{children}</main>
      <Footer />
      <BottomNav />
    </AuthStateProvider>
  );
}
