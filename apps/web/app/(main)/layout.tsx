// Layout del grupo (main) — envuelve landing, wallet, perfil, tienda, torneos,
// torneo/:id con NavBar arriba y BottomNav fijo en mobile. Fondo light bg-page.
//
// Las rutas /auth/* y /admin/* tienen sus propios layouts y NO heredan de éste.
//
// Llama `auth()` para hidratar el `useLukasStore` con el balance real del
// usuario en el primer mount via `LukasBalanceHydrator`. Sin esto el store
// quedaba en 0 hasta la primera mutación y el ComboModal mostraba "Balance
// después: -<entrada>" para usuarios sin tickets previos en ese torneo.
import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { NavBar } from "@/components/layout/NavBar";
import { BottomNav } from "@/components/layout/BottomNav";
import { LukasBalanceHydrator } from "@/components/auth/LukasBalanceHydrator";

export default async function MainLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const initialBalance = session?.user?.balanceLukas ?? null;

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <NavBar />
      <LukasBalanceHydrator initialBalance={initialBalance} />
      <main className="flex-1 pb-24 lg:pb-10">{children}</main>
      <BottomNav />
    </div>
  );
}
