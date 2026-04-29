// PublicHeader — Lote 8.
//
// Header del grupo `(public)` (blog, casas, guías, pronósticos, partidos,
// cuotas). Deriva del NavBar logueado pero sin elementos de cuenta:
//   - Mismo navy bg + logo dorado (anclaje de marca).
//   - Links centrales: Blog, Casas, Guías, Pronósticos, Cuotas, Comunidad.
//   - Lado derecho:
//       • si hay sesión → avatar pequeño linkeando a /perfil
//       • si NO hay sesión → CTA dorado "Iniciar sesión"
//
// Por qué el avatar y no full UserMenu: el público es escaparate SEO y
// queremos UI limpia. Si el user logueado quiere abrir el menú completo,
// click en el avatar lo lleva a /perfil donde está disponible la NavBar
// completa. Decision tomada para mantener el header alineado al brief
// ("derivar del NavBar logueado pero sin elementos de cuenta").

import Link from "next/link";
import { auth } from "@/lib/auth";
import { PublicNavLinks } from "@/components/layout/PublicNavLinks";

function iniciales(username: string, email: string): string {
  const base = username && !username.startsWith("new_") ? username : email;
  return base.trim().slice(0, 2).toUpperCase();
}

export async function PublicHeader() {
  const session = await auth();
  const usuario = session?.user ?? null;

  return (
    <header className="sticky top-0 z-[100] h-[68px] border-b border-dark-border bg-dark-surface">
      <div className="mx-auto flex h-full max-w-[1400px] items-center justify-between px-4 md:px-6">
        {/* LEFT: logo + nav */}
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
          <PublicNavLinks />
        </div>

        {/* RIGHT: avatar (logueado) o CTA Iniciar sesión */}
        <div className="flex items-center gap-3">
          {usuario ? (
            <Link
              href="/perfil"
              aria-label="Mi cuenta"
              className="inline-flex h-[36px] w-[36px] items-center justify-center rounded-full bg-gold-diagonal font-display text-[12px] font-black text-black shadow-gold-btn transition-all hover:-translate-y-px hover:shadow-gold"
            >
              {iniciales(usuario.username ?? "", usuario.email ?? "")}
            </Link>
          ) : (
            <Link
              href="/auth/signin"
              className="rounded-sm bg-brand-gold px-4 py-2 text-[13px] font-bold text-black shadow-gold-btn transition-all duration-150 hover:-translate-y-px hover:bg-brand-gold-light hover:shadow-gold"
            >
              Iniciar sesión
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
