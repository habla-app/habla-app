// DatosPersonalesPanel — editar nombre, @handle, ubicación. Sub-Sprint 7.
// Email y fecha de nacimiento son inmutables (copy: "🔒").
"use client";

import { useState } from "react";
import { authedFetch } from "@/lib/api-client";
import type { PerfilCompleto } from "@/lib/services/usuarios.service";

interface DatosPersonalesPanelProps {
  perfil: PerfilCompleto;
  onActualizar: () => void;
}

export function DatosPersonalesPanel({
  perfil,
  onActualizar,
}: DatosPersonalesPanelProps) {
  const [nombre, setNombre] = useState(perfil.nombre);
  const [username, setUsername] = useState(perfil.username ?? "");
  const [ubicacion, setUbicacion] = useState(perfil.ubicacion ?? "");
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(
    null,
  );
  const [cargando, setCargando] = useState(false);

  async function guardar() {
    setCargando(true);
    setMsg(null);
    try {
      const resp = await authedFetch("/api/v1/usuarios/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre,
          username: username || undefined,
          ubicacion,
        }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        setMsg({
          tipo: "error",
          texto: json?.error?.message ?? "No se pudo guardar.",
        });
        return;
      }
      setMsg({ tipo: "ok", texto: "Datos guardados." });
      onActualizar();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("perfil:refresh"));
      }
    } finally {
      setCargando(false);
    }
  }

  return (
    <section className="rounded-md border border-light bg-card p-5 shadow-sm">
      <h2 className="font-display text-[16px] font-extrabold uppercase tracking-[0.06em] text-dark">
        Datos personales
      </h2>
      <div className="mt-4 space-y-3">
        <Field label="Nombre">
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full rounded-md border border-light px-3 py-2 text-[14px]"
          />
        </Field>
        <Field label="Usuario (@handle)">
          <input
            type="text"
            placeholder="tu_handle"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            className="w-full rounded-md border border-light px-3 py-2 text-[14px]"
          />
        </Field>
        <Field label="Correo" lock>
          <input
            type="email"
            value={perfil.email}
            disabled
            className="w-full cursor-not-allowed rounded-md border border-light bg-subtle px-3 py-2 text-[14px] text-muted-d"
          />
        </Field>
        <Field label="Teléfono">
          <input
            type="tel"
            value={perfil.telefono ?? ""}
            disabled
            className="w-full cursor-not-allowed rounded-md border border-light bg-subtle px-3 py-2 text-[14px] text-muted-d"
          />
          <p className="mt-1 text-[11px] text-muted-d">
            Para cambiar tu teléfono, verificá uno nuevo arriba.
          </p>
        </Field>
        <Field label="Fecha de nacimiento" lock>
          <input
            type="text"
            value={
              perfil.fechaNac
                ? new Date(perfil.fechaNac).toLocaleDateString("es-PE", {
                    timeZone: "America/Lima",
                  })
                : "No verificada"
            }
            disabled
            className="w-full cursor-not-allowed rounded-md border border-light bg-subtle px-3 py-2 text-[14px] text-muted-d"
          />
        </Field>
        <Field label="Ubicación">
          <input
            type="text"
            placeholder="Lima, Perú"
            value={ubicacion}
            onChange={(e) => setUbicacion(e.target.value)}
            className="w-full rounded-md border border-light px-3 py-2 text-[14px]"
          />
        </Field>
      </div>
      {msg && (
        <div
          className={`mt-3 rounded-md px-3 py-2 text-[13px] ${
            msg.tipo === "ok"
              ? "bg-alert-success-bg text-alert-success-text"
              : "bg-pred-wrong-bg text-pred-wrong"
          }`}
        >
          {msg.texto}
        </div>
      )}
      <button
        type="button"
        onClick={guardar}
        disabled={cargando}
        className="mt-4 rounded-md bg-brand-blue-main px-5 py-2.5 font-bold text-white disabled:opacity-50"
      >
        {cargando ? "Guardando..." : "Guardar cambios"}
      </button>
    </section>
  );
}

function Field({
  label,
  lock,
  children,
}: {
  label: string;
  lock?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-muted-d">
        {label}
        {lock && <span aria-hidden>🔒</span>}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
