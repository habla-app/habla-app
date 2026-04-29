// Layout del panel de administración (Lote 5.1).
//
// Responsabilidades:
//   - Auth check único: si no hay sesión → /auth/signin; si no es ADMIN → /.
//     El middleware ya bloquea el acceso, pero defensa en profundidad acá
//     evita que una page hija renderice con `session` parcial.
//   - Shell visual consistente: topbar sticky con nav + main centrado.
//
// Hereda el `bg-page` claro del body (globals.css). Antes este layout
// forzaba `bg-gray-900 text-white` que entraba en conflicto con las
// cards `bg-card` blancas de las páginas hijas — el contraste de letras
// se rompía en cualquier área no cubierta por una card.
//
// Las páginas hijas NO deben volver a chequear auth ni a renderizar un
// "← Volver al home" (eso vive en AdminTopNav).

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminTopNav } from "@/components/admin/AdminTopNav";

export const metadata = {
  title: "Admin · Habla!",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin?callbackUrl=/admin");
  if (session.user.rol !== "ADMIN") redirect("/");

  return (
    <div className="min-h-screen">
      <AdminTopNav />
      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-5 md:px-6 md:pt-7">
        {children}
      </main>
    </div>
  );
}
