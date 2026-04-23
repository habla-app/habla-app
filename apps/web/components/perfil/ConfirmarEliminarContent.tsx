"use client";
// ConfirmarEliminarContent — página /perfil/eliminar/confirmar?token=XXXX.
// POST automático al token en mount, muestra success/error según respuesta
// + CTA para volver al home o rehacer solicitud.

import { useEffect, useState } from "react";
import Link from "next/link";
import { authedFetch } from "@/lib/api-client";

type Estado = "cargando" | "ok" | "ya-confirmado" | "expirado" | "invalido" | "error";

interface Props {
  token: string | null;
}

export function ConfirmarEliminarContent({ token }: Props) {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [mensaje, setMensaje] = useState<string>("");

  useEffect(() => {
    if (!token) {
      setEstado("invalido");
      setMensaje("Link inválido.");
      return;
    }
    (async () => {
      try {
        const resp = await authedFetch(
          "/api/v1/usuarios/me/eliminar/confirmar",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          },
        );
        const json = await resp.json();
        if (resp.ok) {
          setEstado("ok");
          return;
        }
        const code = json?.error?.code as string | undefined;
        if (code === "YA_CONFIRMADO") setEstado("ya-confirmado");
        else if (code === "TOKEN_EXPIRADO") setEstado("expirado");
        else if (code === "TOKEN_INVALIDO") setEstado("invalido");
        else setEstado("error");
        setMensaje(json?.error?.message ?? "");
      } catch {
        setEstado("error");
        setMensaje("Error de red. Intentá de nuevo.");
      }
    })();
  }, [token]);

  return (
    <div className="mx-auto w-full max-w-[480px] px-4 py-10">
      <div className="rounded-lg border border-light bg-card p-10 text-center shadow-lg">
        {estado === "cargando" ? (
          <>
            <div aria-hidden className="text-[56px] leading-none">
              ⏳
            </div>
            <h1 className="mt-4 font-display text-[28px] font-black uppercase tracking-wide text-dark">
              Procesando…
            </h1>
          </>
        ) : estado === "ok" ? (
          <>
            <div aria-hidden className="text-[56px] leading-none">
              ✅
            </div>
            <h1 className="mt-4 font-display text-[28px] font-black uppercase tracking-wide text-dark">
              Cuenta eliminada
            </h1>
            <p className="mt-3 text-sm text-body">
              Tu cuenta fue anonimizada. Gracias por haber jugado con nosotros.
            </p>
          </>
        ) : estado === "ya-confirmado" ? (
          <>
            <div aria-hidden className="text-[56px] leading-none">
              ℹ️
            </div>
            <h1 className="mt-4 font-display text-[28px] font-black uppercase tracking-wide text-dark">
              Ya confirmado
            </h1>
            <p className="mt-3 text-sm text-body">
              {mensaje || "Esta solicitud ya fue confirmada."}
            </p>
          </>
        ) : estado === "expirado" ? (
          <>
            <div aria-hidden className="text-[56px] leading-none">
              ⏱️
            </div>
            <h1 className="mt-4 font-display text-[28px] font-black uppercase tracking-wide text-dark">
              Link expirado
            </h1>
            <p className="mt-3 text-sm text-body">
              El link era válido por 48 horas. Solicitá uno nuevo desde tu
              perfil si aún querés eliminar tu cuenta.
            </p>
          </>
        ) : (
          <>
            <div aria-hidden className="text-[56px] leading-none">
              ⚠️
            </div>
            <h1 className="mt-4 font-display text-[28px] font-black uppercase tracking-wide text-dark">
              {estado === "invalido" ? "Link inválido" : "Algo salió mal"}
            </h1>
            <p className="mt-3 text-sm text-body">
              {mensaje || "No pudimos procesar tu solicitud."}
            </p>
          </>
        )}

        <Link
          href="/"
          className="mt-6 inline-block rounded-sm bg-brand-blue-main px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-blue-light"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
