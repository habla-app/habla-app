// EmailConfirmacionInfo — info card sobre el email de bienvenida (Lote D).
// Spec: docs/ux-spec/04-pista-usuario-premium/post-pago.spec.md.

interface Props {
  email: string;
}

export function EmailConfirmacionInfo({ email }: Props) {
  return (
    <div className="mx-4 my-2 flex items-center gap-3 rounded-md bg-subtle p-3.5 text-body-xs text-body">
      <span
        aria-hidden
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-brand-blue-main text-white"
      >
        📧
      </span>
      <p>
        Te enviamos un email a <strong className="text-dark">{email}</strong>{" "}
        con tu factura y el link al Channel por si lo necesitas después.
      </p>
    </div>
  );
}
