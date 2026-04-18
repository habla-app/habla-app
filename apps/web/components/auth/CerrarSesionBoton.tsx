"use client";

import { signOut } from "next-auth/react";

export function CerrarSesionBoton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      className="w-full rounded-sm border border-urgent-critical/30 bg-urgent-critical/10 px-4 py-3 text-sm font-semibold text-brand-danger transition-colors hover:bg-urgent-critical/20"
    >
      🚪 Cerrar sesión
    </button>
  );
}
