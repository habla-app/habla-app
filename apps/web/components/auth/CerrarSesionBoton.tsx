"use client";

import { signOut } from "next-auth/react";

export function CerrarSesionBoton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      className="w-full rounded-lg border border-brand-live/40 bg-brand-live/10 px-4 py-3 text-sm font-semibold text-brand-live transition-colors hover:bg-brand-live/20"
    >
      Cerrar sesi&oacute;n
    </button>
  );
}
