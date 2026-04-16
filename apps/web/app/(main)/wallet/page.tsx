// Wallet — Server Component. Lee la sesion y muestra balance + placeholder
// para la integracion Culqi que llega en el Sprint 2.
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function WalletPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login?callbackUrl=/wallet");

  const balance = session.user.balanceLukas ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-black uppercase text-white">
        Mi Wallet
      </h1>

      <div className="rounded-2xl border border-brand-gold/30 bg-gradient-to-br from-brand-blue-mid to-brand-blue-main p-6 text-center">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
          Tu balance
        </div>
        <div className="mt-2 font-display text-5xl font-black text-brand-gold">
          {balance.toLocaleString("es-PE")} &#129689;
        </div>
        <div className="mt-1 text-xs text-white/60">
          1 Luka = S/ 1 &middot; No son retirables como efectivo
        </div>
      </div>

      <div className="rounded-xl border border-brand-border bg-brand-card p-5 text-center">
        <div className="mb-2 text-2xl">&#128293;</div>
        <h2 className="mb-1 font-display text-lg font-extrabold text-white">
          Pr&oacute;ximamente: Compra de Lukas
        </h2>
        <p className="text-sm text-brand-muted">
          En el Sprint 2 habilitamos la compra con Culqi y Yape.
        </p>
      </div>

      <div className="rounded-xl border border-brand-border bg-brand-card p-5">
        <h3 className="mb-3 font-display text-sm font-extrabold uppercase tracking-wider text-white">
          Historial
        </h3>
        <p className="text-sm text-brand-muted">
          A&uacute;n no tienes transacciones. Tu bono de bienvenida ya est&aacute;
          acreditado.
        </p>
      </div>
    </div>
  );
}
