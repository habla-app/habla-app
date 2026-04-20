// /admin/canjes — gestión de canjes pendientes + transiciones. Sub-Sprint 6.

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminCanjesPanel } from "@/components/admin/AdminCanjesPanel";

export const dynamic = "force-dynamic";

export default async function AdminCanjesPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login?callbackUrl=/admin/canjes");
  if (session.user.rol !== "ADMIN") redirect("/");

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-6 md:px-6 md:pt-8 lg:pt-10">
      <header className="mb-5">
        <h1 className="font-display text-[32px] font-black uppercase tracking-[0.02em] text-dark md:text-[40px]">
          🎁 Canjes
        </h1>
        <p className="mt-1 text-sm text-muted-d">
          Procesá los canjes de los usuarios. Cada transición dispara email automático.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-[12px] font-semibold text-brand-blue-main">
          <Link href="/admin" className="hover:underline">
            ← Volver al admin
          </Link>
        </div>
      </header>

      <AdminCanjesPanel />
    </div>
  );
}
