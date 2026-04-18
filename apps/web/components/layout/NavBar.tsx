// NavBar — Server Component. Lee la sesión y pinta el header en dark-surface
// según el mockup v5 (altura 68px). Logo circular dorado + wordmark a la
// izquierda, nav links al centro-izquierda (desktop), balance badge + avatar
// o botón "Entrar" a la derecha.
import Link from "next/link";
import { auth } from "@/lib/auth";
import { NavLinks } from "@/components/layout/NavLinks";
import { UserMenu } from "@/components/layout/UserMenu";

function formatearLukas(balance: number): string {
  if (balance >= 1000) {
    const miles = (balance / 1000).toFixed(1).replace(/\.0$/, "");
    return `${miles}K`;
  }
  return balance.toLocaleString("es-PE");
}

function iniciales(nombre: string | undefined | null, email: string): string {
  const base = (nombre && nombre.trim().length > 0 ? nombre : email).trim();
  const partes = base.split(/\s+/).filter(Boolean);
  if (partes.length >= 2) {
    return (partes[0][0] + partes[1][0]).toUpperCase();
  }
  return base.slice(0, 2).toUpperCase();
}

export async function NavBar() {
  const session = await auth();
  const usuario = session?.user ?? null;

  return (
    <header className="sticky top-0 z-50 h-[68px] border-b border-dark-border bg-dark-surface">
      <div className="mx-auto flex h-full max-w-[1400px] items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-5 md:gap-9">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-display text-[28px] font-black leading-none text-white"
            aria-label="Habla! inicio"
          >
            <span
              aria-hidden
              className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-gold-radial text-lg font-black text-black shadow-gold"
            >
              H
            </span>
            <span>Habla!</span>
          </Link>
          <NavLinks />
        </div>

        <div className="flex items-center gap-3">
          {usuario ? (
            <>
              <Link
                href="/wallet"
                className="flex items-center gap-1.5 rounded-sm border border-brand-gold/25 bg-brand-gold-dim px-3 py-1.5 text-[13px] font-bold text-brand-gold transition-colors hover:bg-brand-gold/20"
              >
                <span
                  aria-hidden
                  className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-brand-gold text-[10px] font-black leading-none text-black"
                >
                  🪙
                </span>
                <span>{formatearLukas(usuario.balanceLukas ?? 0)} Lukas</span>
              </Link>
              <UserMenu
                iniciales={iniciales(usuario.name, usuario.email ?? "")}
                nombre={usuario.name ?? usuario.email ?? "Usuario"}
                email={usuario.email ?? ""}
              />
            </>
          ) : (
            <Link
              href="/auth/login"
              className="rounded-sm bg-brand-gold px-4 py-2 text-[13px] font-bold text-black shadow-gold transition-colors hover:bg-brand-gold-light"
            >
              Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
