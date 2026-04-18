// Layout del grupo (main) — envuelve landing, wallet, perfil, tienda, torneos,
// torneo/:id con NavBar arriba y BottomNav fijo en mobile. Fondo light bg-page.
//
// Las rutas /auth/* y /admin/* tienen sus propios layouts y NO heredan de éste.
import type { ReactNode } from "react";
import { NavBar } from "@/components/layout/NavBar";
import { BottomNav } from "@/components/layout/BottomNav";

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-page">
      <NavBar />
      <main className="flex-1 pb-24 lg:pb-10">{children}</main>
      <BottomNav />
    </div>
  );
}
