// Perfil — placeholder hasta el Sub-Sprint 7 (perfil completo con niveles,
// verificación, notificaciones). En Fase 2 replica el pattern `profile-hero`
// del mockup con avatar + datos + balance. El NavBar viene del layout (main).
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
    <div className="mx-auto w-full max-w-2xl px-4 pt-6 md:px-6 md:pt-8">
      <header className="mb-5">
        <h1 className="font-display text-[40px] font-black uppercase leading-none tracking-[0.01em] text-dark">
          👤 Mi perfil
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-d">
          Gestiona tu cuenta, verificación, notificaciones y preferencias.
        </p>
      </header>

      {/* Profile hero — avatar grande + datos */}
      <section className="overflow-hidden rounded-lg border border-dark-border bg-hero-blue p-7 text-white shadow-md">
        <div className="flex items-center gap-5">
          <div
            aria-hidden
            className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-gold-diagonal font-display text-[36px] font-extrabold text-black shadow-gold"
          >
            {iniciales(name, email)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-[30px] font-black uppercase leading-none text-white">
              {name || email}
            </div>
            <div className="mt-1 truncate text-[13px] text-white/70">
              {email}
            </div>
            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-brand-gold-dim px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.06em] text-brand-gold">
              {rol === "ADMIN" ? "Administrador" : "Jugador"}
            </div>
          </div>
        </div>
      </section>

      {/* Balance actual */}
      <section className="mt-4 rounded-md border border-light bg-card p-6 shadow-sm">
        <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-d">
          Balance actual
        </div>
        <div className="mt-1 font-display text-[40px] font-black leading-none text-brand-gold-dark">
          {(balanceLukas ?? 0).toLocaleString("es-PE")} Lukas
        </div>
        <div className="mt-2 text-[11px] text-muted-d">
          El detalle de movimientos vive en{" "}
          <span className="font-semibold text-brand-blue-main">Billetera</span>.
        </div>
      </section>

      {/* Placeholder Sub-Sprint 7 */}
      <section className="mt-4 rounded-md border border-light bg-card p-6 shadow-sm">
        <h2 className="font-display text-sm font-extrabold uppercase tracking-[0.06em] text-dark">
          Próximamente: gestión completa
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-body">
          En el Sub-Sprint 7 habilitamos verificación de teléfono/DNI,
          preferencias de notificaciones, límites de juego responsable y
          gestión de cuenta.
        </p>
      </section>

      <div className="mt-6">
        <CerrarSesionBoton />
      </div>
    </div>
  );
}
