"use client";
// CuentaEditableField — Lote U v3.2.
//
// Edición inline de un campo del perfil dentro del bloque "⚙️ Mi cuenta"
// (mockup líneas ~4275-4296). El mockup pinta cada fila como:
//
//   <div class="cuenta-row">
//     <div class="cuenta-row-label">Nombre</div>
//     <div class="cuenta-row-value">Carlos Mendoza
//       <button class="cuenta-edit-btn">Editar</button>
//     </div>
//   </div>
//
// En modo lectura preservamos exactamente esa estructura. En modo edición
// reemplazamos el texto por <input> + 2 botones (Guardar / Cancelar) — la
// edición es inline, sin modal. Cancelar restaura el valor original.
//
// `field` se mapea a la columna correspondiente de `Usuario`:
//   - "nombre" → PATCH { nombre: ... }     (mín 2 chars, validado server)
//   - "ubicacion" → PATCH { ubicacion: ... }
//
// Tras guardar exitoso hacemos router.refresh() para que el RSC del page
// re-fetchee el perfil. Los errores se muestran inline debajo del input.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Props {
  field: "nombre" | "ubicacion";
  initialValue: string;
  /** Texto a mostrar cuando initialValue está vacío. Default "—". */
  placeholder?: string;
  /** Texto extra a la derecha del valor (ej. badge). */
  trailing?: React.ReactNode;
}

export function CuentaEditableField({
  field,
  initialValue,
  placeholder = "—",
  trailing,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [draft, setDraft] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function startEdit() {
    setDraft(value);
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setDraft(value);
    setError(null);
    setEditing(false);
  }

  async function guardar() {
    setError(null);
    const trimmed = draft.trim();
    if (field === "nombre" && trimmed.length < 2) {
      setError("Mínimo 2 caracteres.");
      return;
    }
    if (field === "ubicacion" && trimmed.length > 80) {
      setError("Máximo 80 caracteres.");
      return;
    }

    const body =
      field === "nombre"
        ? { nombre: trimmed }
        : { ubicacion: trimmed };

    let resp: Response;
    try {
      resp = await fetch("/api/v1/usuarios/me", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      setError("Error de red. Probá de nuevo.");
      return;
    }
    if (!resp.ok) {
      const data = await resp.json().catch(() => null);
      const msg =
        (data?.error?.message as string | undefined) ??
        "No se pudo guardar.";
      setError(msg);
      return;
    }

    setValue(trimmed);
    setEditing(false);
    startTransition(() => router.refresh());
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void guardar();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  }

  if (!editing) {
    return (
      <div className="cuenta-row-value">
        {value || placeholder}
        {trailing ?? null}
        <button type="button" className="cuenta-edit-btn" onClick={startEdit}>
          Editar
        </button>
      </div>
    );
  }

  return (
    <div
      className="cuenta-row-value"
      style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}
    >
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          autoFocus
          disabled={pending}
          maxLength={field === "nombre" ? 100 : 80}
          style={{
            flex: 1,
            minWidth: 160,
            padding: "6px 10px",
            fontSize: 13,
            fontFamily: "inherit",
            fontWeight: 600,
            color: "var(--text-dark)",
            border: "1px solid var(--border-light)",
            borderRadius: 6,
            background: "var(--bg-card)",
          }}
          placeholder={field === "nombre" ? "Tu nombre" : "Ciudad, región"}
          aria-label={field === "nombre" ? "Nombre" : "Ubicación"}
        />
        <button
          type="button"
          className="cuenta-edit-btn"
          onClick={() => void guardar()}
          disabled={pending}
          style={{ color: "var(--green)" }}
        >
          {pending ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          className="cuenta-edit-btn"
          onClick={cancel}
          disabled={pending}
          style={{ color: "var(--text-muted-d)" }}
        >
          Cancelar
        </button>
      </div>
      {error ? (
        <div style={{ fontSize: 11, color: "var(--pred-wrong)", fontWeight: 600 }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}
