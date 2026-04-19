// NavBar — réplica de `.header` del mockup (docs/habla-mockup-completo.html
// líneas 122-186, 1663-1682). Altura 68px, fondo dark-surface, logo a la
// izquierda con nav-links, lukas-badge + avatar (o "Entrar") a la derecha.
//
// Server Component que lee la sesión. Para el estado activo de los links
// delega a NavLinks (client) porque necesita usePathname. Para el chip
// de Lukas delega a BalanceBadge (client) porque necesita re-renderizar
// cuando el balance cambia en el store tras una inscripción (Bug #7).
import Link from "next/link";
import { auth } from "@/lib/auth";
import { NavLinks } from "@/components/layout/NavLinks";
import { UserMenu } from "@/components/layout/UserMenu";
import { BalanceBadge } from "@/components/layout/BalanceBadge";

// Placeholder hasta el Sub-Sprint 5, donde el poller de partidos alimenta
// un endpoint GET /live/matches. Reemplazar aquí por fetch real.
const LIVE_COUNT_PLACEHOLDER = 2;

function iniciales(
  nombre: string | undefined | null,
  email: string,
): string {
  const base = (nombre && nombre.trim().length > 0 ? nombre : email).trim();
  const partes = base.split(/\s+/).filter(Boolean);
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

export async function NavBar() {
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
          <NavLinks liveCount={LIVE_COUNT_PLACEHOLDER} />
        </div>

        {/* RIGHT: balance + avatar o "Entrar" */}
        <div className="flex items-center gap-3">
          {usuario ? (
            <>
              <BalanceBadge initialBalance={usuario.balanceLukas ?? 0} />
              <UserMenu
                iniciales={iniciales(usuario.name, usuario.email ?? "")}
                nombre={usuario.name ?? usuario.email ?? "Usuario"}
                email={usuario.email ?? ""}
              />
            </>
          ) : (
            <Link
              href="/auth/login"
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
