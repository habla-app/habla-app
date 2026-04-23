"use client";
// TycCheckbox — checkbox obligatorio de aceptación de Términos + mayoría
// de edad. Usado en /auth/signup y /auth/completar-perfil.

import Link from "next/link";

interface Props {
  checked: boolean;
  onChange: (v: boolean) => void;
  /** Id único del checkbox para accesibilidad. */
  id?: string;
}

export function TycCheckbox({ checked, onChange, id = "tyc" }: Props) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-2.5 rounded-sm border border-light bg-subtle p-3 transition hover:border-strong"
    >
      <input
        id={id}
        type="checkbox"
        name="aceptaTyc"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 flex-shrink-0 cursor-pointer accent-brand-blue-main"
      />
      <span className="text-xs leading-[1.5] text-body">
        Soy mayor de 18 años y acepto los{" "}
        <Link
          href="/legal/terminos"
          target="_blank"
          className="font-semibold text-brand-blue-main underline-offset-2 hover:underline"
        >
          Términos
        </Link>{" "}
        y la{" "}
        <Link
          href="/legal/privacidad"
          target="_blank"
          className="font-semibold text-brand-blue-main underline-offset-2 hover:underline"
        >
          Política de Privacidad
        </Link>
        .
      </span>
    </label>
  );
}
