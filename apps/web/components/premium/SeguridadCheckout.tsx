// SeguridadCheckout — badges de seguridad en checkout (Lote D).
// Spec: docs/ux-spec/04-pista-usuario-premium/checkout.spec.md.
//
// Sección bajo el form con 3 garantías de seguridad + logos de proveedores.

export function SeguridadCheckout() {
  return (
    <section
      aria-label="Seguridad del pago"
      className="bg-subtle px-4 py-3.5"
    >
      <ul className="space-y-1.5 text-body-xs text-muted-d">
        <li className="flex items-center gap-2">
          <span
            aria-hidden
            className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full bg-status-green text-[10px] text-white"
          >
            🔒
          </span>
          Pago procesado por OpenPay BBVA
        </li>
        <li className="flex items-center gap-2">
          <span
            aria-hidden
            className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full bg-status-green text-[10px] text-white"
          >
            🛡
          </span>
          Tarjeta encriptada con TLS
        </li>
        <li className="flex items-center gap-2">
          <span
            aria-hidden
            className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full bg-status-green text-[10px] text-white"
          >
            ✓
          </span>
          No guardamos datos de tarjeta
        </li>
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {["BBVA", "OpenPay", "PCI DSS"].map((logo) => (
          <span
            key={logo}
            className="rounded-sm border border-light bg-card px-2 py-0.5 font-mono text-[10px] font-bold text-dark"
          >
            {logo}
          </span>
        ))}
      </div>
    </section>
  );
}
