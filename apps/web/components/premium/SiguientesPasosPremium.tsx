// SiguientesPasosPremium — accesos rápidos post-pago (Lote D).
// Spec: docs/ux-spec/04-pista-usuario-premium/post-pago.spec.md.
//
// Grid 2x2 con accesos a bot FAQ, gestión, inicio, soporte.

import Link from "next/link";

interface Props {
  botPhoneNumber: string | null;
}

interface Acceso {
  href: string;
  icono: string;
  titulo: string;
  detalle: string;
  external?: boolean;
}

export function SiguientesPasosPremium({ botPhoneNumber }: Props) {
  const accesos: Array<Acceso> = [
    {
      href: botPhoneNumber
        ? `https://wa.me/${botPhoneNumber.replace(/\D/g, "")}`
        : "/ayuda/faq",
      icono: "🤖",
      titulo: "Bot FAQ",
      detalle: "Resuelve dudas 24/7",
      external: !!botPhoneNumber,
    },
    {
      href: "/premium/mi-suscripcion",
      icono: "⚙",
      titulo: "Mi suscripción",
      detalle: "Gestión y pagos",
    },
    {
      href: "/",
      icono: "📊",
      titulo: "Volver al inicio",
      detalle: "Producto B y C",
    },
    {
      href: "/ayuda/faq",
      icono: "💬",
      titulo: "Soporte",
      detalle: "Contáctanos",
    },
  ];

  return (
    <section
      aria-label="Accesos rápidos"
      className="bg-card px-4 pb-4 pt-3"
    >
      <h3 className="mb-3 font-display text-display-xs font-bold uppercase tracking-[0.06em] text-muted-d">
        ⚙ Más opciones
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {accesos.map((a) => (
          <AccessCard key={a.titulo} acceso={a} />
        ))}
      </div>
    </section>
  );
}

function AccessCard({ acceso }: { acceso: Acceso }) {
  const className =
    "touch-target flex items-center gap-2.5 rounded-md border border-light bg-card p-3 transition-colors hover:bg-hover";

  const content = (
    <>
      <span
        aria-hidden
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-subtle text-base"
      >
        {acceso.icono}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-display-xs font-bold text-dark">
          {acceso.titulo}
        </p>
        <p className="text-[10px] leading-tight text-muted-d">
          {acceso.detalle}
        </p>
      </div>
    </>
  );

  if (acceso.external) {
    return (
      <a
        href={acceso.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {content}
      </a>
    );
  }
  return (
    <Link href={acceso.href} className={className}>
      {content}
    </Link>
  );
}
