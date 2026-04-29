// /admin/usuarios — stub. La gestión de usuarios todavía no existe como
// vista dedicada (queda para un lote futuro). Redirijo al dashboard para
// que cualquier link guardado no devuelva 404.
import { redirect } from "next/navigation";

export default function AdminUsuariosPage() {
  redirect("/admin");
}
