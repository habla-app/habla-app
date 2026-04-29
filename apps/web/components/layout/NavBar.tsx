// NavBar — réplica de `.header` del mockup (docs/habla-mockup-completo.html
// líneas 1663-1682). Altura 68px, fondo dark-surface, logo a la izquierda
// con nav-links, avatar (o "Entrar") a la derecha.
//
// Lote 2 (Abr 2026): se removió el chip de Lukas — el sistema de saldo
// se demolió. El header queda más limpio.
//
// Bug #12 (Hotfix #5): el contador del link "🔴 En vivo" lo provee el
// layout (main) vía `contarLiveMatches()`. Lo propagamos al NavLinks que
// a su vez lo pasa al LiveCountBadge (client, con polling cada 30s).
import Link from "next/link";
import { auth } from "@/lib/auth";
import { NavLinks } from "@/components/layout/NavLinks";
import { UserMenu } from "@/components/layout/UserMenu";

interface Props {
  /** Count del SSR (del layout, via contarLiveMatches). 0 default. */
  initialLiveCount?: number;
}

function iniciales(username: string, email: string): string {
  const base =
    username && !username.startsWith("new_") ? username : email;
  return base.trim().slice(0, 2).toUpperCase();
}

export async function NavBar({ initialLiveCount = 0 }: Props = {}) {
  const session = await auth();
  const usuario = session?.user ?? null;

  return (
    <header className="sticky top-0 z-[100] h-[68px] border-b border-dark-border bg-dark-surface">
      <div className="mx-auto flex h-full max-w-[1400px] items-center justify-between px-4 md:px-6">
        {/* LEFT: logo + nav-links */}
        <div className="flex items-center gap-6 lg:gap-9">
          <Link
            href="/"
            aria-label="Habla! inicio"
            className="flex items-center gap-2.5 font-display text-[28px] font-black leading-none text-white"
          >
            <span
              aria-hidden
              className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-gold-radial text-[18px] font-black text-black shadow-gold"
            >
              ⊕
            </span>
            <span>Habla!</span>
          </Link>
          <NavLinks initialLiveCount={initialLiveCount} />
        </div>

        {/* RIGHT: avatar o "Entrar" */}
        <div className="flex items-center gap-3">
          {usuario ? (
            <UserMenu
              iniciales={iniciales(
                usuario.username ?? "",
                usuario.email ?? "",
              )}
              username={usuario.username ?? ""}
              usernameLocked={usuario.usernameLocked ?? false}
              email={usuario.email ?? ""}
              esAdmin={usuario.rol === "ADMIN"}
            />
          ) : (
            <Link
              href="/auth/signin"
              className="rounded-sm bg-brand-gold px-4 py-2 text-[13px] font-bold text-black shadow-gold-btn transition-all duration-150 hover:-translate-y-px hover:bg-brand-gold-light hover:shadow-gold"
            >
              Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
