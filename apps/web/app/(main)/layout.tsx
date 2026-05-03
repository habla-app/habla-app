// Layout del grupo (main) — Lote S v3.2 (rewrite del Lote B).
//
// Comparte shell único con el grupo (public): NavBar (.app-header del
// mockup) + Footer + BottomNav. Cero MobileHeader (el `app-header` del
// mockup se renderiza en mobile y desktop con CSS responsive).
//
// AuthStateProvider envuelve los descendientes con el estado de auth
// resuelto server-side, para que componentes globales (UserMenu,
// BottomNav) lean via <AuthGate>.

import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { obtenerEstadoAuthServer } from "@/lib/services/auth-state.service";
import { NavBar } from "@/components/layout/NavBar";
import { BottomNav } from "@/components/layout/BottomNav";
import { Footer } from "@/components/layout/Footer";
import { AuthStateProvider } from "@/components/auth/AuthStateProvider";

export default async function MainLayout({
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
