"use client";

// UsuarioAccionesPanel — botones de acción admin (ban / soft-delete / cambiar rol). Lote G.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authedFetch } from "@/lib/api-client";

interface Props {
  usuarioId: string;
  rolActual: "JUGADOR" | "ADMIN";
  estado: "activo" | "soft_deleted" | "banned";
}

type AccionTipo = "ban" | "soft-delete" | "promover" | "demover" | null;

export function UsuarioAccionesPanel({ usuarioId, rolActual, estado }: Props) {
  const router = useRouter();
  const [accion, setAccion] = useState<AccionTipo>(null);
  const [motivo, setMotivo] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function abrirModal(a: AccionTipo) {
    setAccion(a);
    setMotivo("");
    setConfirmacion("");
    setError(null);
  }

  async function ejecutar() {
    setLoading(true);
    setError(null);
    try {
      let url = "";
      let body: Record<string, unknown> = { motivo };
      if (accion === "ban") {
        url = `/api/v1/admin/usuarios/${usuarioId}/ban`;
        body = { motivo, confirmacion };
      } else if (accion === "soft-delete") {
        url = `/api/v1/admin/usuarios/${usuarioId}/soft-delete`;
        body = { motivo, confirmacion };
      } else if (accion === "promover" || accion === "demover") {
        url = `/api/v1/admin/usuarios/${usuarioId}/cambiar-rol`;
        body = {
          motivo,
          nuevoRol: accion === "promover" ? "ADMIN" : "JUGADOR",
        };
      }
      const res = await authedFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setAccion(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falló");
    } finally {
      setLoading(false);
    }
  }

  if (estado === "soft_deleted") {
    return (
      <div className="rounded-md border border-status-red bg-status-red-bg p-3 text-admin-body text-status-red-text">
        Este usuario está eliminado. Las acciones admin no aplican.
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {rolActual === "JUGADOR" ? (
          <button
            type="button"
            onClick={() => abrirModal("promover")}
            className="rounded-sm border border-admin-table-border bg-admin-card-bg px-3 py-1.5 text-admin-meta font-bold text-dark hover:bg-subtle"
          >
            Promover a ADMIN
          </button>
        ) : (
          <button
            type="button"
            onClick={() => abrirModal("demover")}
            className="rounded-sm border border-admin-table-border bg-admin-card-bg px-3 py-1.5 text-admin-meta font-bold text-dark hover:bg-subtle"
          >
            Quitar ADMIN
          </button>
        )}
        <button
          type="button"
          onClick={() => abrirModal("ban")}
          className="rounded-sm border border-status-amber bg-status-amber-bg px-3 py-1.5 text-admin-meta font-bold text-status-amber-text hover:bg-status-amber/20"
        >
          Banear
        </button>
        <button
          type="button"
          onClick={() => abrirModal("soft-delete")}
          className="rounded-sm border border-status-red bg-status-red-bg px-3 py-1.5 text-admin-meta font-bold text-status-red-text hover:bg-status-red/20"
        >
          Eliminar (soft)
        </button>
      </div>

      {accion && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-modal flex items-center justify-center bg-black/40 px-4"
          onClick={() => setAccion(null)}
        >
          <div
            className="w-full max-w-md rounded-md bg-admin-card-bg p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-admin-card-title text-dark">
              {accion === "ban" && "Banear usuario"}
              {accion === "soft-delete" && "Eliminar usuario (soft)"}
              {accion === "promover" && "Promover a ADMIN"}
              {accion === "demover" && "Quitar rol ADMIN"}
            </h3>

            {(accion === "ban" || accion === "soft-delete") && (
              <p className="mb-3 text-admin-meta text-status-red-text">
                ⚠ Esta acción es irreversible. La cuenta queda anonimizada y
                el usuario no puede iniciar sesión.
              </p>
            )}

            <label className="mb-3 block">
              <span className="text-admin-label text-muted-d">
                Motivo (mín 5 chars)
              </span>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={3}
                minLength={5}
                className="mt-1 block w-full rounded-sm border border-admin-table-border bg-admin-card-bg px-3 py-1.5 text-admin-body text-dark"
              />
            </label>

            {(accion === "ban" || accion === "soft-delete") && (
              <label className="mb-4 block">
                <span className="text-admin-label text-muted-d">
                  Para confirmar, escribe{" "}
                  <code className="rounded-sm bg-subtle px-1 text-dark">
                    {accion === "ban" ? "BANEAR" : "ELIMINAR"}
                  </code>
                </span>
                <input
                  type="text"
                  value={confirmacion}
                  onChange={(e) => setConfirmacion(e.target.value)}
                  className="mt-1 block w-full rounded-sm border border-admin-table-border bg-admin-card-bg px-3 py-1.5 text-admin-body text-dark"
                />
              </label>
            )}

            {error && (
              <p className="mb-3 rounded-sm bg-status-red-bg px-3 py-2 text-admin-meta text-status-red-text">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAccion(null)}
                disabled={loading}
                className="rounded-sm border border-admin-table-border px-3 py-1.5 text-admin-meta text-muted-d hover:text-dark"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={ejecutar}
                disabled={
                  loading ||
                  motivo.trim().length < 5 ||
                  ((accion === "ban" || accion === "soft-delete") &&
                    confirmacion !== (accion === "ban" ? "BANEAR" : "ELIMINAR"))
                }
                className="rounded-sm bg-status-red px-3 py-1.5 text-admin-meta font-bold text-white disabled:opacity-50"
              >
                {loading ? "Ejecutando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
