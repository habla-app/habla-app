// /admin — redirect al dashboard. Lote F (May 2026).
//
// Antes (Lote 5.1) `/admin` mostraba el panel de torneos como vista raíz.
// En v3.1 el dashboard de KPIs es la primera mirada cada mañana, así que
// `/admin` redirige a `/admin/dashboard`. La gestión de torneos vive en
// `/admin/torneos`.
import { redirect } from "next/navigation";

export default function AdminRoot() {
  redirect("/admin/dashboard");
}
