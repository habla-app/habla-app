"use client";
// UsernameInput — input controlado con validación en tiempo real contra
// GET /api/v1/auth/username-disponible. Debounce 300ms. Feedback ✓/✗ con
// mensaje. Forza lowercase + limita a caracteres válidos en onChange.
//
// Usado en /auth/signup (signup email) y /auth/completar-perfil (post-OAuth).

import { useEffect, useRef, useState } from "react";
import { authedFetch } from "@/lib/api-client";

type Estado = "idle" | "checking" | "ok" | "error";

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** Cuando el check dice OK pasa true, si no false. El padre puede
   *  bloquear el submit si no está ok. */
  onValidityChange?: (ok: boolean) => void;
  /** Placeholder en el input. */
  placeholder?: string;
  /** Id/label del input para accesibilidad. */
  id?: string;
}

const USERNAME_REGEX_PARCIAL = /^[a-z0-9_]*$/;
const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

export function UsernameInput({
  value,
  onChange,
  onValidityChange,
  placeholder = "tu_handle",
  id = "username",
}: Props) {
  const [estado, setEstado] = useState<Estado>("idle");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pedidoRef = useRef(0); // race guard

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value) {
      setEstado("idle");
      setMensaje(null);
      onValidityChange?.(false);
      return;
    }

    // Pre-check formato antes de pegarle al endpoint.
    if (!USERNAME_REGEX.test(value)) {
      setEstado("error");
      setMensaje(
        value.length < 3
          ? "Mínimo 3 caracteres."
          : value.length > 20
            ? "Máximo 20 caracteres."
            : "Solo letras minúsculas, números y guión bajo.",
      );
      onValidityChange?.(false);
      return;
    }

    setEstado("checking");
    setMensaje("Verificando disponibilidad…");
    const pid = ++pedidoRef.current;
    debounceRef.current = setTimeout(async () => {
      try {
        const resp = await authedFetch(
          `/api/v1/auth/username-disponible?u=${encodeURIComponent(value)}`,
        );
        const json = (await resp.json()) as {
          disponible: boolean;
          razon?: "FORMATO_INVALIDO" | "RESERVADO" | "TOMADO";
        };
        if (pid !== pedidoRef.current) return; // llegó tarde, otro pedido ganó
        if (json.disponible) {
          setEstado("ok");
          setMensaje("¡Disponible!");
          onValidityChange?.(true);
        } else {
          setEstado("error");
          setMensaje(
            json.razon === "RESERVADO"
              ? "Ese nombre está reservado."
              : json.razon === "TOMADO"
                ? "Ya está tomado."
                : "Formato inválido.",
          );
          onValidityChange?.(false);
        }
      } catch {
        if (pid !== pedidoRef.current) return;
        setEstado("error");
        setMensaje("No pudimos verificar. Reintentá.");
        onValidityChange?.(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, onValidityChange]);

  const borderCls =
    estado === "ok"
      ? "border-alert-success-text focus:ring-alert-success-text/20"
      : estado === "error"
        ? "border-pred-wrong focus:ring-pred-wrong/20"
        : "border-light focus:ring-brand-blue-main/10";
  const msgCls =
    estado === "ok"
      ? "text-alert-success-text"
      : estado === "error"
        ? "text-pred-wrong"
        : "text-muted-d";
  const icono =
    estado === "ok" ? "✓" : estado === "error" ? "✗" : estado === "checking" ? "…" : "";

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-bold uppercase tracking-[0.06em] text-muted-d"
      >
        Usuario (@handle)
      </label>
      <div className="relative">
        <span
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-d"
        >
          @
        </span>
        <input
          id={id}
          type="text"
          name="username"
          required
          autoComplete="username"
          inputMode="text"
          maxLength={20}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            const raw = e.target.value.toLowerCase();
            // Deja entrar caracteres válidos o vacío — filtra silenciosamente
            // el resto para que el usuario vea su intención reflejada.
            if (USERNAME_REGEX_PARCIAL.test(raw)) onChange(raw);
          }}
          className={`w-full rounded-sm border-[1.5px] bg-card pl-8 pr-10 py-[13px] text-sm text-dark outline-none transition-all focus:ring-4 ${borderCls}`}
        />
        {icono ? (
          <span
            aria-hidden
            className={`absolute right-3.5 top-1/2 -translate-y-1/2 text-base font-bold ${msgCls}`}
          >
            {icono}
          </span>
        ) : null}
      </div>
      <p className={`mt-1.5 text-[11px] ${msgCls}`}>
        {mensaje ??
          "3-20 caracteres. Solo letras minúsculas, números y _. No se puede cambiar después."}
      </p>
    </div>
  );
}
