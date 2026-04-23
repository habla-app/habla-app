"use client";
// PerfilRefreshOnUpdate — listener del evento custom "perfil:refresh".
// Los paneles lo disparan tras mutaciones exitosas (verificar teléfono,
// subir DNI, editar datos) y este componente llama `router.refresh()`
// para que los server components vuelvan a consultar la BD.
//
// Alternativa descartada: propagar callbacks de server → client (Next 14
// no lo permite). Este patrón de evento global es el workaround estándar.

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function PerfilRefreshOnUpdate() {
  const router = useRouter();
  useEffect(() => {
    function onRefresh() {
      router.refresh();
    }
    window.addEventListener("perfil:refresh", onRefresh);
    return () => window.removeEventListener("perfil:refresh", onRefresh);
  }, [router]);
  return null;
}
