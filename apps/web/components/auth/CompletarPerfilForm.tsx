"use client";
// CompletarPerfilForm — form del /auth/completar-perfil. Usuario con sesión
// activa pero usernameLocked=false elige su @handle definitivo + acepta T&C.
// Llama POST /api/v1/auth/completar-perfil; tras OK refresca la session
// (NextAuth update) para propagar usernameLocked=true y redirige al
// callbackUrl.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { authedFetch } from "@/lib/api-client";
import { Button } from "@/components/ui";
import { UsernameInput } from "./UsernameInput";
import { TycCheckbox } from "./TycCheckbox";

interface Props {
  callbackUrl?: string;
}

export function CompletarPerfilForm({ callbackUrl = "/" }: Props) {
  const router = useRouter();
  const { update } = useSession();
  const [username, setUsername] = useState("");
  const [usernameValido, setUsernameValido] = useState(false);
  const [aceptaTyc, setAceptaTyc] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    username.length >= 3 && usernameValido && aceptaTyc && !cargando;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setCargando(true);
    setError(null);
    try {
      const resp = await authedFetch("/api/v1/auth/completar-perfil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Preservamos el case del @handle (Abr 2026).
          username: username.trim(),
          aceptaTyc,
        }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        setError(
          json?.error?.message ?? "No pudimos completar tu perfil. Reintentá.",
        );
        setCargando(false);
        return;
      }
      // Refrescar session para que usernameLocked=true llegue al cliente
      // (esto dispara el jwt callback con trigger='update').
      await update();
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Error de red. Intentá de nuevo.");
      setCargando(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <UsernameInput
        id="completar-username"
        value={username}
        onChange={setUsername}
        onValidityChange={setUsernameValido}
      />

      <TycCheckbox
        id="completar-tyc"
        checked={aceptaTyc}
        onChange={setAceptaTyc}
      />

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
        {cargando ? "Guardando…" : "Confirmar @handle y entrar"}
      </Button>
    </form>
  );
}
