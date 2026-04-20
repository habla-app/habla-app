// ConfirmarEliminarContent — consume el token del email y marca soft delete.
"use client";

import { useState } from "react";

interface Props {
  token: string;
}

export function ConfirmarEliminarContent({ token }: Props) {
  const [estado, setEstado] = useState<"idle" | "procesando" | "ok" | "error">(
    "idle",
  );
  const [mensaje, setMensaje] = useState<string>("");

  async function confirmar() {
    if (!token) {
      setEstado("error");
      setMensaje("Token inválido o ausente.");
      return;
    }
    setEstado("procesando");
    try {
      const resp = await fetch("/api/v1/usuarios/me/eliminar/confirmar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        setEstado("error");
        setMensaje(json?.error?.message ?? "No se pudo confirmar.");
        return;
      }
      setEstado("ok");
      setMensaje("Tu cuenta fue eliminada. Podés cerrar esta página.");
    } catch {
      setEstado("error");
      setMensaje("Error de red.");
    }
  }

  return (
    <div className="rounded-lg border border-light bg-card p-8 shadow-md">
      <h1 className="font-display text-[28px] font-black text-dark">
        Eliminar mi cuenta
      </h1>
      {estado === "idle" && (
        <>
          <p className="mt-3 text-[14px] text-body">
            Estás a un click de eliminar tu cuenta. Al confirmar, tu identidad
            (nombre, email, teléfono) se anonimiza. Los tickets y transacciones
            se preservan por requerimientos de auditoría pero no quedan
            asociados a tu identidad.
          </p>
          <p className="mt-2 text-[13px] text-muted-d">
            Esta acción NO se puede revertir.
          </p>
          <button
            type="button"
            onClick={confirmar}
            className="mt-5 rounded-md bg-urgent-critical px-5 py-3 font-bold text-white"
          >
            Sí, eliminar mi cuenta
          </button>
          <a
            href="/"
            className="ml-3 text-[13px] font-bold text-brand-blue-main hover:underline"
          >
            Cancelar
          </a>
        </>
      )}
      {estado === "procesando" && (
        <p className="mt-4 text-[14px] text-body">Procesando...</p>
      )}
      {estado === "ok" && (
        <div className="mt-4 rounded-md bg-alert-success-bg px-4 py-3 text-[14px] text-alert-success-text">
          ✓ {mensaje}
        </div>
      )}
      {estado === "error" && (
        <div className="mt-4 rounded-md bg-pred-wrong-bg px-4 py-3 text-[14px] text-pred-wrong">
          ❌ {mensaje}
        </div>
      )}
    </div>
  );
}
