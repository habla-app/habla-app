// Wallet — Server Component. Lee la sesión y muestra balance + placeholder
// para la integración Culqi que llega en el Sub-Sprint 2. El NavBar lo aporta
// (main)/layout.tsx.
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function WalletPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login?callbackUrl=/wallet");

  const balance = session.user.balanceLukas ?? 0;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-6 md:px-6 md:pt-8">
      <header className="mb-5">
        <h1 className="font-display text-4xl font-black uppercase tracking-wide text-dark">
          💰 Billetera
        </h1>
        <p className="mt-1 text-sm text-muted-d">
          Tus Lukas, cómo los ganaste y en qué los gastaste.
        </p>
      </header>

      {/* Balance hero sobre gradient azul */}
      <section className="overflow-hidden rounded-lg border border-dark-border bg-hero-blue p-6 text-center shadow-md">
        <div className="text-[11px] font-bold uppercase tracking-widest text-white/70">
          Tu balance
        </div>
        <div className="mt-2 font-display text-6xl font-black leading-none text-brand-gold">
          {balance.toLocaleString("es-PE")} <span aria-hidden>🪙</span>
        </div>
        <div className="mt-2 text-xs text-white/60">
          1 Luka = S/ 1 · No son retirables como efectivo
        </div>
      </section>

      {/* Placeholder Sprint 2 */}
      <section className="mt-4 rounded-md border border-light bg-card p-5 text-center shadow-sm">
        <div aria-hidden className="mb-2 text-2xl">
          🔥
        </div>
        <h2 className="mb-1 font-display text-lg font-extrabold uppercase tracking-wide text-dark">
          Próximamente: Compra de Lukas
        </h2>
        <p className="text-sm text-muted-d">
          En el Sub-Sprint 2 habilitamos la compra con Culqi y Yape.
        </p>
      </section>

      <section className="mt-4 rounded-md border border-light bg-card p-5 shadow-sm">
        <h3 className="mb-3 font-display text-sm font-extrabold uppercase tracking-wider text-dark">
          Historial
        </h3>
        <p className="text-sm text-muted-d">
          Aún no tienes transacciones. Tu bono de bienvenida ya está acreditado.
        </p>
      </section>
    </div>
  );
}
