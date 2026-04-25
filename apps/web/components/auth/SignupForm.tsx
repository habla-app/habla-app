"use client";
// SignupForm — formulario email del /auth/signup. Secuencia:
//  1. Usuario llena email + username + T&C.
//  2. POST /api/v1/auth/signup crea user + bonus de bienvenida (atómico).
//  3. Si OK, llama signIn("resend", { email, redirectTo: callbackUrl })
//     que despacha el magic link y navega a /auth/verificar.
//  4. Al confirmar el link, NextAuth setea la session → middleware
//     valida usernameLocked (=true tras signup email) → callbackUrl.

import { useState } from "react";
import { signIn } from "next-auth/react";
import { authedFetch } from "@/lib/api-client";
import { track } from "@/lib/analytics";
import { Button } from "@/components/ui";
import { UsernameInput } from "./UsernameInput";
import { TycCheckbox } from "./TycCheckbox";

interface Props {
  emailInicial?: string;
  callbackUrl?: string;
}

export function SignupForm({ emailInicial = "", callbackUrl = "/" }: Props) {
  const [email, setEmail] = useState(emailInicial);
  const [username, setUsername] = useState("");
  const [usernameValido, setUsernameValido] = useState(false);
  const [aceptaTyc, setAceptaTyc] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    email.length > 3 && username.length >= 3 && usernameValido && aceptaTyc && !cargando;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setCargando(true);
    setError(null);
    try {
      const resp = await authedFetch("/api/v1/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          // Preservamos el case del @handle: "Gustavo" se guarda tal cual.
          username: username.trim(),
          aceptaTyc,
        }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        setError(
          json?.error?.message ?? "No pudimos crear tu cuenta. Reintentá.",
        );
        setCargando(false);
        return;
      }
      // Analytics: el usuario completó el signup (BD + bonus creado). Para
      // email flow, el perfil ya queda completo acá (ya eligió @handle y
      // aceptó T&C). `email_verified` se dispara cuando vuelva del magic link.
      track("signup_completed", { method: "email" });
      track("profile_completed", {});
      // Marcador para detectar vuelta del magic link y disparar
      // `email_verified` en el PostHogProvider (primer session authenticated).
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(
            "habla:pending_email_verification",
            email.trim().toLowerCase(),
          );
        } catch {
          /* storage bloqueado, no crítico */
        }
      }
      // Disparar magic link. signIn con redirect=true navega a /auth/verificar
      // si NextAuth está configurado con verifyRequest (lo está).
      await signIn("resend", {
        email: email.trim().toLowerCase(),
        redirectTo: callbackUrl,
      });
    } catch {
      setError("Error de red. Intentá de nuevo.");
      setCargando(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div>
        <label
          htmlFor="signup-email"
          className="mb-1.5 block text-xs font-bold uppercase tracking-[0.06em] text-muted-d"
        >
          Correo electrónico
        </label>
        <input
          id="signup-email"
          type="email"
          name="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@correo.com"
          className="w-full rounded-sm border-[1.5px] border-light bg-card px-3.5 py-[13px] text-sm text-dark outline-none placeholder:text-soft transition-all focus:border-brand-blue-main focus:ring-4 focus:ring-brand-blue-main/10"
        />
      </div>

      <UsernameInput
        id="signup-username"
        value={username}
        onChange={setUsername}
        onValidityChange={setUsernameValido}
      />

      <TycCheckbox id="signup-tyc" checked={aceptaTyc} onChange={setAceptaTyc} />

      {error ? (
        <div className="rounded-sm bg-pred-wrong-bg px-3 py-2 text-[13px] text-pred-wrong">
          {error}
        </div>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        size="xl"
        disabled={!canSubmit}
      >
        {cargando ? "Creando cuenta…" : "Crear cuenta"}
      </Button>

      <p className="text-center text-[11px] leading-relaxed text-muted-d">
        Te enviaremos un enlace mágico para confirmar. Sin contraseñas.
      </p>
    </form>
  );
}
