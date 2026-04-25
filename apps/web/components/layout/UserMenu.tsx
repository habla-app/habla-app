"use client";

// UserMenu — avatar circular dorado (36x36 según `.avatar` del mockup) con
// dropdown light flotante. Client Component porque maneja estado de apertura
// y cierre por click fuera.
//
// Registro formal (Abr 2026): header del dropdown muestra `@username` en
// vez de `nombre`. Si `usernameLocked=false` (OAuth sin completar),
// muestra CTA "Elegí tu @handle →" linkeando a /auth/completar-perfil.
//
// Mini-lote 7.6: el handler de "Cerrar sesión" hace `signOut({ redirect:
// false })` y luego hard reload manual. El default de NextAuth (redirect
// automático) silenciaba 429 del rate limit y dejaba la cookie sin
// borrar — síntoma "el botón no responde". El hard reload garantiza que
// el SSR vea la cookie nueva y los Server Components renderen el header
// como visitante.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";

interface UserMenuProps {
  iniciales: string;
  username: string;
  usernameLocked: boolean;
  email: string;
}

export function UserMenu({
  iniciales,
  username,
  usernameLocked,
  email,
}: UserMenuProps) {
  const [abierto, setAbierto] = useState(false);
  const [cerrandoSesion, setCerrandoSesion] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function cerrarSesion() {
    if (cerrandoSesion) return;
    setCerrandoSesion(true);
    try {
      await signOut({ redirect: false, callbackUrl: "/" });
    } catch {
      // signOut nunca rechaza con redirect:false, pero por si NextAuth
      // tira un edge: igual hacemos el hard reload abajo. El cookie ya
      // se borró en el server o no se borró y el reload muestra el
      // estado real de la sesión.
    }
    window.location.href = "/";
  }

  useEffect(() => {
    if (!abierto) return;
    function cerrarAlClickFuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(false);
    }
    document.addEventListener("mousedown", cerrarAlClickFuera);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", cerrarAlClickFuera);
      document.removeEventListener("keydown", onEsc);
    };
  }, [abierto]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Menú de usuario"
        aria-expanded={abierto}
        aria-haspopup="menu"
        onClick={() => setAbierto((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-diagonal text-[14px] font-extrabold text-black shadow-gold transition-transform hover:scale-105"
      >
        {iniciales}
      </button>

      {abierto && (
        <div
          role="menu"
          className="absolute right-0 top-11 z-50 w-60 overflow-hidden rounded-md border border-light bg-card shadow-lg"
        >
          <div className="border-b border-light px-4 py-3">
            {usernameLocked && username ? (
              <p className="truncate text-sm font-semibold text-dark">
                @{username}
              </p>
            ) : (
              <Link
                href="/auth/completar-perfil"
                onClick={() => setAbierto(false)}
                className="block truncate text-sm font-semibold text-brand-blue-main hover:underline"
              >
                Elegí tu @handle →
              </Link>
            )}
            <p className="truncate text-[11px] text-muted-d">{email}</p>
          </div>
          <Link
            href="/perfil"
            onClick={() => setAbierto(false)}
            role="menuitem"
            className="block px-4 py-2.5 text-sm text-body transition-colors hover:bg-subtle"
          >
            Mi perfil
          </Link>
          <Link
            href="/wallet"
            onClick={() => setAbierto(false)}
            role="menuitem"
            className="block px-4 py-2.5 text-sm text-body transition-colors hover:bg-subtle"
          >
            Mi billetera
          </Link>
          <button
            type="button"
            role="menuitem"
            disabled={cerrandoSesion}
            onClick={() => {
              setAbierto(false);
              void cerrarSesion();
            }}
            className="block w-full border-t border-light px-4 py-2.5 text-left text-sm font-semibold text-danger transition-colors hover:bg-subtle disabled:cursor-wait disabled:opacity-60"
          >
            {cerrandoSesion ? "Cerrando sesión…" : "Cerrar sesión"}
          </button>
        </div>
      )}
    </div>
  );
}
