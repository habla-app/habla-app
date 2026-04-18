"use client";

// Avatar + menú desplegable. Client Component porque maneja estado de apertura
// y cierre por click fuera. El botón vive en el dark-surface header; el panel
// flotante usa light surface con shadow-lg (pattern "light floating menu").
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
    function cerrarAlClickFuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    if (abierto) {
      document.addEventListener("mousedown", cerrarAlClickFuera);
      return () =>
        document.removeEventListener("mousedown", cerrarAlClickFuera);
    }
  }, [abierto]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Menú de usuario"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-diagonal text-[13px] font-black text-black shadow-gold transition-transform hover:scale-105"
      >
        {iniciales}
      </button>

      {abierto && (
        <div className="absolute right-0 top-11 z-50 w-60 overflow-hidden rounded-md border border-light bg-card shadow-lg">
          <div className="border-b border-light px-4 py-3">
            <p className="truncate text-sm font-semibold text-dark">{nombre}</p>
            <p className="truncate text-[11px] text-muted-d">{email}</p>
          </div>
          <Link
            href="/perfil"
            onClick={() => setAbierto(false)}
            className="block px-4 py-2.5 text-sm text-body transition-colors hover:bg-subtle"
          >
            Mi perfil
          </Link>
          <Link
            href="/wallet"
            onClick={() => setAbierto(false)}
            className="block px-4 py-2.5 text-sm text-body transition-colors hover:bg-subtle"
          >
            Mi wallet
          </Link>
          <button
            type="button"
            onClick={() => {
              setAbierto(false);
              signOut({ callbackUrl: "/" });
            }}
            className="block w-full border-t border-light px-4 py-2.5 text-left text-sm font-semibold text-brand-danger transition-colors hover:bg-subtle"
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
