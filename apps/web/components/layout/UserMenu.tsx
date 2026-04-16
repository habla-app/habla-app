"use client";

// Menu desplegable del avatar — Client Component porque maneja estado de apertura.
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
      return () => document.removeEventListener("mousedown", cerrarAlClickFuera);
    }
  }, [abierto]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Menu de usuario"
        onClick={() => setAbierto((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gold text-[11px] font-black text-black transition-transform hover:scale-105"
      >
        {iniciales}
      </button>

      {abierto && (
        <div className="absolute right-0 top-10 z-50 w-56 overflow-hidden rounded-xl border border-brand-border bg-brand-card shadow-lg">
          <div className="border-b border-brand-border px-4 py-3">
            <p className="truncate text-sm font-semibold text-white">{nombre}</p>
            <p className="truncate text-[11px] text-brand-muted">{email}</p>
          </div>
          <Link
            href="/perfil"
            onClick={() => setAbierto(false)}
            className="block px-4 py-2.5 text-sm text-brand-text transition-colors hover:bg-brand-card2"
          >
            Mi perfil
          </Link>
          <Link
            href="/wallet"
            onClick={() => setAbierto(false)}
            className="block px-4 py-2.5 text-sm text-brand-text transition-colors hover:bg-brand-card2"
          >
            Mi wallet
          </Link>
          <button
            type="button"
            onClick={() => {
              setAbierto(false);
              signOut({ callbackUrl: "/" });
            }}
            className="block w-full border-t border-brand-border px-4 py-2.5 text-left text-sm text-brand-live transition-colors hover:bg-brand-card2"
          >
            Cerrar sesi&oacute;n
          </button>
        </div>
      )}
    </div>
  );
}
