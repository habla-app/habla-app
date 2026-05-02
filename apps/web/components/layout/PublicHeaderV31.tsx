// PublicHeaderV31 — header público v3.1 (Lote B).
// Spec: docs/ux-spec/02-pista-usuario-publica/00-layout-y-nav.spec.md.
//
// Reemplaza al `<PublicHeader>` (Lote 8) con versión mobile-first.
//
// - Mobile (<lg): MobileHeader sticky 56px con logo + acciones derecha
//   (campana → /comunidad, login si no auth, avatar si auth). El nav
//   principal vive en BottomNav, no en este header.
// - Desktop (lg+): top-bar 68px con logo, nav links horizontal, y CTA
//   dorado de "Iniciar sesión" o avatar pequeño.
//
// Server component — lee la session una sola vez. El componente client
// `<MobileHeaderActions>` hace el toggle de "campana" / avatar / signin
// según pathname y session, sin doble fetch.
import Link from "next/link";
import { auth } from "@/lib/auth";
import { MobileHeader } from "@/components/ui/mobile";
import { PublicNavLinks } from "@/components/layout/PublicNavLinks";

function iniciales(username: string, email: string): string {
  const base = username && !username.startsWith("new_") ? username : email;
  return base.trim().slice(0, 2).toUpperCase();
}

export async function PublicHeaderV31() {
  const session = await auth();
  const usuario = session?.user ?? null;

  return (
    <>
      {/* MOBILE — sticky 56px header con logo + acciones */}
      <div className="lg:hidden">
        <MobileHeader
          variant="public"
          showLogo
          rightActions={
            usuario ? (
              <Link
                href="/perfil"
                aria-label="Mi cuenta"
                className="touch-target inline-flex h-10 w-10 items-center justify-center rounded-full bg-gold-diagonal font-display text-[12px] font-black text-black"
              >
                {iniciales(usuario.username ?? "", usuario.email ?? "")}
              </Link>
            ) : (
              <Link
                href="/auth/signin"
                className="touch-target inline-flex h-10 items-center rounded-sm bg-brand-gold px-3 text-[12px] font-bold text-black"
              >
                Entrar
              </Link>
            )
          }
        />
      </div>

      {/* DESKTOP — top-bar 68px con nav completo */}
      <header className="sticky top-0 z-header hidden h-[68px] border-b border-dark-border bg-dark-surface lg:block">
        <div className="mx-auto flex h-full max-w-[1400px] items-center justify-between px-4 md:px-6">
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
    </>
  );
}
