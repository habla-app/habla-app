"use client";

// Botón "Cerrar sesión" — variante danger del Button primitive. Client
// component porque signOut() viene de next-auth/react.
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui";

export function CerrarSesionBoton() {
  return (
    <Button
      variant="danger"
      className="w-full"
      onClick={() => signOut({ callbackUrl: "/" })}
    >
      🚪 Cerrar sesión
    </Button>
  );
}
