// Layout del grupo (main) — envuelve landing, wallet, perfil, tienda, torneos,
// torneo/:id con NavBar arriba y BottomNav fijo en mobile. Se remueve el
// max-w-md heredado de Sprint 1: el nuevo mockup es desktop-first con sidebar
// y cards en grid de 1280px; cada página maneja su propio ancho interior.
//
// Las rutas /auth/* y /admin/* tienen sus propios layouts y NO heredan de éste.
import type { ReactNode } from "react";
import { NavBar } from "@/components/layout/NavBar";
import { BottomNav } from "@/components/layout/BottomNav";

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-page">
      <NavBar />
      <main className="flex-1 pb-24 md:pb-8">{children}</main>
      <BottomNav />
    </div>
  );
}
