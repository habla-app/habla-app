// Wallet — hero azul con balance gigante, 3 stats (comprado/ganado/canjeado),
// 4 packs de compra (UI lista, Culqi en Sub-Sprint 2), filtro de chips e
// historial de movimientos. El backend real de compra llega con SS2; hasta
// entonces `BuyPacksPlaceholder` muestra la UI sin cablear fetch a Culqi.
//
// `force-dynamic` porque el balance y el historial se re-leen cada request.
// El balance del hero se hidrata via `useLukasStore` (mounted-guard) para
// reflejar cambios sin refresh tras inscripción/canje.
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { obtenerWalletView } from "@/lib/services/wallet-view.service";
import { WalletView } from "@/components/wallet/WalletView";
import { pagosHabilitados } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin?callbackUrl=/wallet");

  const balance = session.user.balanceLukas ?? 0;
  const vista = await obtenerWalletView(session.user.id, balance);
  const pagosOn = pagosHabilitados();

  return (
    <WalletView
      initialBalance={vista.balance}
      desglose={vista.desglose}
      totales={vista.totales}
      proxVencimiento={vista.proxVencimiento}
      transacciones={vista.transacciones}
      totalMovimientos={vista.totalMovimientos}
      pagosHabilitados={pagosOn}
    />
  );
}
