"use client";
// GoogleButton — botón "Continuar con Google" usado en /auth/signin y
// /auth/signup. Llama al provider NextAuth via `next-auth/react` para que
// redirija al consent screen y luego al callback. El redirect final lo
// resuelve el middleware: si el usuario es OAuth nuevo, va a
// /auth/completar-perfil; si ya tiene username locked, al callbackUrl.

import { signIn } from "next-auth/react";
import { useState } from "react";

interface Props {
  callbackUrl?: string;
  /** Texto del botón. "Continuar con Google" en signup, "Entrar con Google" en signin. */
  label?: string;
}

export function GoogleButton({
  callbackUrl = "/",
  label = "Continuar con Google",
}: Props) {
  const [cargando, setCargando] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        setCargando(true);
        void signIn("google", { callbackUrl });
      }}
      disabled={cargando}
      className="flex w-full items-center justify-center gap-3 rounded-sm border-[1.5px] border-light bg-card px-4 py-3 text-sm font-bold text-dark transition-all hover:-translate-y-px hover:border-brand-blue-main hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
    >
      <GoogleLogo />
      <span>{cargando ? "Abriendo Google…" : label}</span>
    </button>
  );
}

function GoogleLogo() {
  // SVG oficial de Google — los colores son los brand-approved,
  // documentados en Google Identity guidelines.
  // Excepción al "cero hex" (regla §13): atributos SVG fill inline son
  // necesarios para mantener la marca.
  return (
    <svg
      aria-hidden
      width="18"
      height="18"
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
