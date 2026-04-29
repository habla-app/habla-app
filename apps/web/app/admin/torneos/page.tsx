// /admin/torneos — stub. La gestión de torneos vive hoy en /admin
// (AdminTorneosPanel). Mantengo el archivo redirigiendo para no devolver
// 404 si alguien tiene el link guardado, hasta que se construya la vista
// dedicada.
import { redirect } from "next/navigation";

export default function AdminTorneosPage() {
  redirect("/admin");
}
