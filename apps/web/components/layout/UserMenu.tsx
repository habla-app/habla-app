"use client";

// UserMenu — avatar circular dorado (36x36 según `.avatar` del mockup) con
// dropdown light flotante. Client Component porque maneja estado de apertura
// y cierre por click fuera.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";

interface UserMenuProps {
  iniciales: string;
  nombre: string;
  email: string;
}

export function UserMenu({ iniciales, nombre, email }: UserMenuProps) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
            <p className="truncate text-sm font-semibold text-dark">{nombre}</p>
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
            onClick={() => {
              setAbierto(false);
              signOut({ callbackUrl: "/" });
            }}
            className="block w-full border-t border-light px-4 py-2.5 text-left text-sm font-semibold text-danger transition-colors hover:bg-subtle"
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
