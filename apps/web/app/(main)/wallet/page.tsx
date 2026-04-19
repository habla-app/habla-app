// Wallet — hero dark azul con balance + historial básico. La compra con
// Culqi + packs con bonus llega en Sub-Sprint 2; hasta entonces el
// balance viene del bono de bienvenida + premios ganados.
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function WalletPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login?callbackUrl=/wallet");

  const balance = session.user.balanceLukas ?? 0;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-6 md:px-6 md:pt-8">
      <header className="mb-5">
        <h1 className="font-display text-[40px] font-black uppercase leading-none tracking-[0.01em] text-dark">
          💰 Billetera
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-d">
          Tus Lukas, cómo los ganaste y en qué los gastaste.
        </p>
      </header>

      {/* Balance hero — pattern del .profile-head (gradient hero-blue) */}
      <section className="overflow-hidden rounded-lg border border-dark-border bg-hero-blue p-7 text-center shadow-md">
        <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/70">
          Tu balance
        </div>
        <div className="mt-2 font-display text-[64px] font-black leading-none text-brand-gold">
          {balance.toLocaleString("es-PE")} <span aria-hidden>🪙</span>
        </div>
        <div className="mt-2 text-xs text-white/60">
          1 Luka = S/ 1 · No son retirables como efectivo
        </div>
      </section>

      <section className="mt-4 rounded-md border border-light bg-card p-6 text-center shadow-sm">
        <div aria-hidden className="mb-2 text-3xl">
          🔥
        </div>
        <h2 className="mb-1 font-display text-[22px] font-extrabold uppercase tracking-wide text-dark">
          Compra de Lukas
        </h2>
        <p className="text-sm text-body">
          Estamos terminando la integración con Culqi para habilitar la compra
          de Lukas con tarjeta y los packs con bonus. En breve.
        </p>
      </section>

      <section className="mt-4 rounded-md border border-light bg-card p-6 shadow-sm">
        <h3 className="mb-3 font-display text-sm font-extrabold uppercase tracking-[0.06em] text-dark">
          Historial
        </h3>
        <p className="text-sm text-muted-d">
          Aún no tienes transacciones. Tu bono de bienvenida ya está acreditado.
        </p>
      </section>
    </div>
  );
}
