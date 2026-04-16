// NavBar — Server Component que lee la sesion y pinta los estados:
// - Sin sesion:  Logo + boton "Entrar" dorado
// - Con sesion:  Logo + badge de balance en Lukas + avatar con iniciales
import Link from "next/link";
import { auth } from "@/lib/auth";
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
    <nav className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-brand-border bg-brand-blue-dark/97 px-4 backdrop-blur-xl">
      <Link
        href="/"
        className="flex items-center gap-1.5 font-display text-[26px] font-black text-white"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-gold text-sm font-black text-black">
          H
        </span>
        Habla!
      </Link>

      <div className="flex items-center gap-2">
        {usuario ? (
          <>
            <Link
              href="/wallet"
              className="flex items-center gap-1 rounded-full border border-brand-gold/30 bg-[var(--gold-dim)] px-2.5 py-1 text-[12px] font-bold text-brand-gold transition-colors hover:bg-brand-gold/25"
            >
              <span>&#129689;</span>
              <span>
                {formatearLukas(usuario.balanceLukas ?? 0)} Lukas
              </span>
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
            className="rounded-lg bg-brand-gold px-4 py-1.5 text-[13px] font-bold text-black transition-colors hover:bg-brand-gold-light"
          >
            Entrar
          </Link>
        )}
      </div>
    </nav>
  );
}
