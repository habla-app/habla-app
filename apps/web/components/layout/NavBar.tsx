// NavBar — Lote S v3.2 · header global de toda la app (visitor + free + socios).
//
// Portación literal del `<header class="app-header">` del mockup
// (docs/habla-mockup-v3.2.html líneas 2131-2204). Las clases CSS son las
// del mockup (definidas en apps/web/app/mockup-styles.css por el Lote R) —
// cero Tailwind utility, cero componentes de UI custom.
//
// Reemplaza tanto al viejo NavBar (header desktop autenticado) como a
// PublicHeader/PublicHeaderV31 (header público desktop+mobile). El mockup
// tiene UN SOLO header que se renderiza en mobile y desktop con CSS
// responsive (los nav-links se ocultan en <767px, ver mockup-styles.css).
//
// Server Component — lee la session una sola vez. El AuthGate se resuelve
// vía AuthStateProvider (server-side propagado desde el layout).

import Link from "next/link";
import { auth } from "@/lib/auth";
import { NavLinks } from "@/components/layout/NavLinks";
import { UserMenu } from "@/components/layout/UserMenu";

function iniciales(username: string, email: string): string {
  const base =
    username && !username.startsWith("new_") ? username : email;
  return base.trim().slice(0, 2).toUpperCase();
}

export async function NavBar() {
  const session = await auth();
  const usuario = session?.user ?? null;

  return (
    <header className="app-header">
      <div className="app-header-left">
        <Link className="logo" href="/">
          <span className="logo-mark">⊕</span>
          <span>Habla!</span>
        </Link>
        <NavLinks />
      </div>
      <div className="app-header-right">
        {usuario ? (
          <UserMenu
            iniciales={iniciales(
              usuario.username ?? "",
              usuario.email ?? "",
            )}
            username={usuario.username ?? ""}
            usernameLocked={usuario.usernameLocked ?? false}
            email={usuario.email ?? ""}
          />
        ) : (
          <Link href="/auth/signin" className="btn-entrar">
            Empezar gratis
          </Link>
        )}
      </div>
    </header>
  );
}
