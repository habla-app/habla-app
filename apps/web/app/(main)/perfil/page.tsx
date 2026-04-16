// Perfil — Server Component. Avatar + datos del usuario + boton cerrar sesion.
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CerrarSesionBoton } from "@/components/auth/CerrarSesionBoton";

function iniciales(nombre: string | null | undefined, email: string): string {
  const base = nombre && nombre.trim().length > 0 ? nombre : email;
  const partes = base.trim().split(/\s+/).filter(Boolean);
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

export default async function PerfilPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login?callbackUrl=/perfil");

  const { name, email, balanceLukas, rol } = session.user;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-black uppercase text-white">
        Mi Perfil
      </h1>

      <div className="flex items-center gap-4 rounded-2xl border border-brand-border bg-brand-card p-5">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-gold font-display text-xl font-black text-black">
          {iniciales(name, email)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-lg font-extrabold text-white">
            {name || email}
          </div>
          <div className="truncate text-xs text-brand-muted">{email}</div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-brand-gold">
            {rol === "ADMIN" ? "Administrador" : "Jugador"}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-brand-border bg-brand-card p-5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-muted">
          Balance actual
        </div>
        <div className="mt-1 font-display text-3xl font-black text-brand-gold">
          {(balanceLukas ?? 0).toLocaleString("es-PE")} Lukas
        </div>
      </div>

      <CerrarSesionBoton />
    </div>
  );
}
