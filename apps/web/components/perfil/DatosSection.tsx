"use client";
// DatosSection — mockup `.profile-section` "Datos personales" (línea
// 3999). Filas: nombre, usuario (@handle, read-only), correo (locked),
// teléfono (hint), fecha nac (locked), ubicación.
//
// Registro formal (Abr 2026): el @handle es INMUTABLE post-registro
// (tooltip "Tu @handle es permanente"). Email y fecha nac ya eran locked.
// PATCH /api/v1/usuarios/me ya no acepta username.
//
// Ajustes Abr 2026: nombre se muestra como "Por completar" cuando está
// vacío o coincide con el username (signups viejos o pre-OAuth). Se
// actualizó también el tooltip del @handle al nuevo copy case-sensitive.

import { useState } from "react";
import { authedFetch } from "@/lib/api-client";
import type { PerfilCompleto } from "@/lib/services/usuarios.service";
import { SectionShell } from "./SectionShell";

interface Props {
  perfil: PerfilCompleto;
}

type CampoEditable = "nombre" | "ubicacion";

const FECHA_NAC_FMT = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Lima",
});

export function DatosSection({ perfil }: Props) {
  // Abr 2026: si el nombre está vacío o arrastra el handle (signups
  // viejos que lo copiaban), lo consideramos "por completar" y el row
  // arranca en modo vacío con el placeholder correspondiente.
  const nombreCompletado =
    !!perfil.nombre &&
    perfil.nombre.trim() !== "" &&
    perfil.nombre.trim().toLowerCase() !== perfil.username.toLowerCase();

  const [editing, setEditing] = useState<CampoEditable | null>(null);
  const [valores, setValores] = useState({
    nombre: nombreCompletado ? perfil.nombre : "",
    ubicacion: perfil.ubicacion ?? "",
  });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(campo: CampoEditable) {
    setCargando(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {};
      body[campo] = valores[campo] || null;
      const resp = await authedFetch("/api/v1/usuarios/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await resp.json();
      if (!resp.ok) {
        setError(json?.error?.message ?? "No se pudo guardar.");
        return;
      }
      setEditing(null);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("perfil:refresh"));
      }
    } finally {
      setCargando(false);
    }
  }

  return (
    <SectionShell
      title="Datos personales"
      subtitle="Esta información se usa solo para tu cuenta y verificación"
      icon="👤"
      iconTone="data"
    >
      <DataRow
        label="Nombre completo"
        value={nombreCompletado ? perfil.nombre : "Por completar"}
        emptyValue={!nombreCompletado}
        editing={editing === "nombre"}
        onEdit={() => setEditing("nombre")}
        onCancel={() => setEditing(null)}
        onSave={() => guardar("nombre")}
        input={
          <input
            type="text"
            placeholder="Tu nombre completo"
            value={valores.nombre}
            onChange={(e) =>
              setValores((v) => ({ ...v, nombre: e.target.value }))
            }
            className="w-full rounded-sm border border-light px-3 py-1.5 text-sm"
            autoFocus
          />
        }
      />
      <DataRow
        label="Usuario (@handle)"
        value={`@${perfil.username}`}
        locked
        hint="Tu @handle es permanente"
      />
      <DataRow label="Correo" value={perfil.email} locked />
      <DataRow
        label="Teléfono"
        value={perfil.telefono ?? "No agregado"}
        emptyValue={!perfil.telefono}
        hint="Para cambiar, verificá uno nuevo arriba"
      />
      <DataRow
        label="Fecha nacimiento"
        value={
          perfil.fechaNac
            ? FECHA_NAC_FMT.format(new Date(perfil.fechaNac))
            : "No verificada"
        }
        locked
      />
      <DataRow
        label="Ubicación"
        value={perfil.ubicacion ?? "—"}
        emptyValue={!perfil.ubicacion}
        editing={editing === "ubicacion"}
        onEdit={() => setEditing("ubicacion")}
        onCancel={() => setEditing(null)}
        onSave={() => guardar("ubicacion")}
        input={
          <input
            type="text"
            placeholder="Lima, Perú"
            value={valores.ubicacion}
            onChange={(e) =>
              setValores((v) => ({ ...v, ubicacion: e.target.value }))
            }
            className="w-full rounded-sm border border-light px-3 py-1.5 text-sm"
            autoFocus
          />
        }
      />
      {error ? (
        <div className="mx-5 mb-4 rounded-sm bg-pred-wrong-bg px-3 py-2 text-xs text-pred-wrong">
          {error}
        </div>
      ) : null}
      {cargando ? (
        <div className="px-5 pb-4 text-xs text-muted-d">Guardando…</div>
      ) : null}
    </SectionShell>
  );
}

function DataRow({
  label,
  value,
  emptyValue = false,
  locked = false,
  editing = false,
  onEdit,
  onCancel,
  onSave,
  input,
  hint,
}: {
  label: string;
  value: string;
  emptyValue?: boolean;
  locked?: boolean;
  editing?: boolean;
  onEdit?: () => void;
  onCancel?: () => void;
  onSave?: () => void;
  input?: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-light px-5 py-3.5 last:border-b-0">
      <div className="min-w-[140px] flex-shrink-0 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-d">
        {label}
      </div>
      {editing && input ? (
        <div className="flex min-w-[200px] flex-1 items-center gap-2">
          {input}
          <button
            type="button"
            onClick={onSave}
            className="rounded-sm bg-brand-green px-3 py-1.5 text-xs font-bold text-black"
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-sm bg-subtle px-3 py-1.5 text-xs font-bold text-muted-d"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <>
          <div
            className={`min-w-[120px] flex-1 text-sm ${emptyValue ? "italic text-muted-d" : "font-medium text-dark"}`}
          >
            {value}
            {hint ? (
              <span className="ml-2 text-xs text-muted-d">({hint})</span>
            ) : null}
          </div>
          {locked ? (
            <span
              title={hint}
              className="flex-shrink-0 cursor-default rounded-sm bg-transparent px-2.5 py-1.5 text-[11px] text-muted-d"
            >
              🔒 Bloqueado
            </span>
          ) : onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              className={`flex-shrink-0 rounded-sm px-3 py-1.5 text-xs font-bold transition ${
                emptyValue
                  ? "border border-brand-gold/30 bg-brand-gold-dim text-brand-gold-dark hover:bg-brand-gold hover:text-black"
                  : "bg-transparent text-brand-blue-main hover:bg-brand-blue-main hover:text-white"
              }`}
            >
              {emptyValue ? "+ Agregar" : "Editar"}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
