// PerfilRefreshOnUpdate — escucha evento custom "perfil:refresh" y recarga
// la página. Los sub-paneles lo disparan tras mutaciones exitosas (verificar
// teléfono, subir DNI) para que los server-components re-consulten.
//
// Alternativa descartada: propagar un callback useState desde el server page
// al client — Next.js 14 no permite pasar funciones de server → client.
"use client";

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
