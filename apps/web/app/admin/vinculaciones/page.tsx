// /admin/vinculaciones — Lote P (May 2026): port literal del mockup
// `docs/habla-mockup-v3.2.html` § admin-page-vinculaciones (líneas
// 6361-6587). HTML idéntico al mockup, clases del mockup que viven en
// `apps/web/app/mockup-styles.css` desde el Lote R.
//
// Server component. Las 3 sub-tabs (WhatsApp / Casas / Webhooks) se
// resuelven server-side por query param `?tab=` y renderiza el bloque
// correspondiente. Los botones se implementan con <Link> a la misma URL
// con distinto query param.

import Link from "next/link";
import { obtenerVinculaciones } from "@/lib/services/vinculaciones.service";
import { track } from "@/lib/services/analytics.service";
import { auth } from "@/lib/auth";
import { TabWhatsApp } from "@/components/admin/vinculaciones/TabWhatsApp";
import { TabCasas } from "@/components/admin/vinculaciones/TabCasas";
import { TabWebhooks } from "@/components/admin/vinculaciones/TabWebhooks";

export const dynamic = "force-dynamic";

type Tab = "whatsapp" | "casas" | "webhooks";

const TABS_VALIDOS: ReadonlyArray<Tab> = ["whatsapp", "casas", "webhooks"];

interface PageProps {
  searchParams?: { tab?: string };
}

export default async function AdminVinculacionesPage({ searchParams }: PageProps) {
  const tab: Tab = TABS_VALIDOS.includes(searchParams?.tab as Tab)
    ? (searchParams!.tab as Tab)
    : "whatsapp";

  const session = await auth();
  void track({
    evento: "admin_vinculaciones_visto",
    userId: session?.user?.id,
    props: { tab },
  });

  const data = await obtenerVinculaciones();

  return (
    <>
      <div className="admin-topbar">
        <div className="admin-breadcrumbs">
          <span>Inicio</span>
          <span>Monetización</span>
          <span>Vinculaciones</span>
        </div>
        <div className="admin-topbar-row">
          <div>
            <h1 className="admin-page-title">Vinculaciones de servicios</h1>
            <p className="admin-page-subtitle">Estado de Socios en WhatsApp Channel · usuarios con FTD por casa · health checks</p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm">⟳ Forzar sincronización</button>
        </div>
      </div>

      {/* Health checks de servicios */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 18 }}>
        {data.health.map((h) => (
          <div key={h.label} className="admin-kpi-card">
            <div className="admin-kpi-card-head">
              <span className="admin-kpi-card-label">{h.label}</span>
              <span className={`admin-kpi-card-status admin-kpi-status-${h.estado}`}></span>
            </div>
            <div className="admin-kpi-card-value">{h.value}</div>
            <div className="admin-kpi-card-target">{h.meta}</div>
          </div>
        ))}
      </div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "2px solid rgba(0,16,80,.06)", marginBottom: 18 }}>
        <TabLink href="/admin/vinculaciones?tab=whatsapp" active={tab === "whatsapp"}>
          💬 Socios en WhatsApp
        </TabLink>
        <TabLink href="/admin/vinculaciones?tab=casas" active={tab === "casas"}>
          🏠 Usuarios por casa
        </TabLink>
        <TabLink href="/admin/vinculaciones?tab=webhooks" active={tab === "webhooks"}>
          🔌 Webhooks &amp; integraciones
        </TabLink>
      </div>

      {tab === "whatsapp" && <TabWhatsApp data={data.whatsapp} />}
      {tab === "casas" && <TabCasas casas={data.casas} />}
      {tab === "webhooks" && <TabWebhooks webhooks={data.webhooks} />}
    </>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`tab-btn${active ? " active" : ""}`}
      style={{ textDecoration: "none" }}
    >
      {children}
    </Link>
  );
}
