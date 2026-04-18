// /admin — panel interno. Middleware ya bloquea usuarios no-ADMIN pero
// validamos también en el server component por defensa en profundidad.
// UI funcional (no replica mockup; es herramienta interna).
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminTorneosPanel } from "@/components/admin/AdminTorneosPanel";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login?callbackUrl=/admin");
  if (session.user.rol !== "ADMIN") redirect("/");

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-6 md:px-6 md:pt-8 lg:pt-10">
      <header className="mb-5">
        <h1 className="font-display text-[32px] font-black uppercase tracking-[0.02em] text-dark md:text-[40px]">
          ⚙️ Panel admin
        </h1>
        <p className="mt-1 text-sm text-muted-d">
          Importa partidos de api-football y crea torneos sobre ellos.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-[12px] font-semibold text-brand-blue-main">
          <Link href="/" className="hover:underline">
            ← Volver al home
          </Link>
        </div>
      </header>

      <AdminTorneosPanel />
    </div>
  );
}
