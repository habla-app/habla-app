"use client";
// SignOutLink — Lote N v3.2 · botón cliente que dispara signOut() y
// hace hard reload para resetear el contexto AuthState.

import { signOut } from "next-auth/react";

export function SignOutLink() {
  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    void signOut({ redirect: false }).then(() => {
      window.location.href = "/";
    });
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn btn-ghost btn-sm"
      style={{ justifyContent: "flex-start" }}
    >
      ↪ Cerrar sesión
    </button>
  );
}
