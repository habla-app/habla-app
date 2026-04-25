"use client";
// CompletarPerfilForm — form del /auth/completar-perfil. Usuario con sesión
// activa pero usernameLocked=false elige su @handle definitivo + acepta T&C.
// Llama POST /api/v1/auth/completar-perfil; tras OK refresca la session
// (NextAuth update) para propagar usernameLocked=true y redirige al
// callbackUrl.

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { authedFetch } from "@/lib/api-client";
import { track } from "@/lib/analytics";
import { Button } from "@/components/ui";
import { UsernameInput } from "./UsernameInput";
import { TycCheckbox } from "./TycCheckbox";

interface Props {
  callbackUrl?: string;
}

export function CompletarPerfilForm({ callbackUrl = "/" }: Props) {
  const { update } = useSession();
  const [username, setUsername] = useState("");
  const [usernameValido, setUsernameValido] = useState(false);
  const [aceptaTyc, setAceptaTyc] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Llegar a este formulario == OAuth Google nuevo (middleware garantiza que
// solo usernameLocked=false entra). Disparamos signup_completed una única
// vez en el mount — Google emails vienen ya verificados, así que también
// disparamos email_verified acá.
  useEffect(() => {
    track("signup_completed", { method: "google" });
    track("email_verified", {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      track("profile_completed", {});
      // Refrescar session para que usernameLocked=true llegue al cliente
      // (esto dispara el jwt callback con trigger='update' y NextAuth
      // re-emite la cookie del JWT con los datos frescos de BD).
      await update();
      // Hard reload en vez de router.push + router.refresh: el NavBar es
      // un Server Component que lee el JWT desde la cookie en el render
      // SSR. router.refresh() tiene una race contra ese render — a veces
      // el RSC ve el JWT viejo aunque la cookie ya esté actualizada.
      // window.location.href fuerza una request HTTP completa con la
      // cookie nueva, así el SSR siempre ve usernameLocked=true.
      window.location.href = callbackUrl;
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
