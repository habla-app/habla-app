// Header — bloque superior con logo de Habla! (Lote H).
//
// Imagen `<https://hablaplay.com/logo-email.png>` cuadrada 120×120 PNG.
// Fallback `alt="Habla!"` para clients que bloquean imágenes (Outlook
// default). Padding-bottom 24px + border-bottom como divider.

import { Img, Section } from "@react-email/components";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://hablaplay.com";

const wrap = {
  paddingBottom: "24px",
  borderBottom: "1px solid #E5E7EB",
  textAlign: "center" as const,
};

const logoStyle = {
  display: "block",
  margin: "0 auto",
};

export function Header() {
  return (
    <Section style={wrap}>
      <Img
        src={`${APP_URL}/logo-email.png`}
        width="120"
        height="120"
        alt="Habla!"
        style={logoStyle}
      />
    </Section>
  );
}
