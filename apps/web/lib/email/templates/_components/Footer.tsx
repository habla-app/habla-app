// Footer — bloque legal y de preferencias (Lote H).
//
// Obligatorio en TODOS los emails (regla del Lote H):
//   - Disclaimer "no somos casa de apuestas"
//   - Apuesta responsable + Línea Tugar 0800-19009
//   - Link a /perfil/preferencias-notif (cambiar preferencias)
//   - Link a /perfil/datos-personales (eliminar cuenta)

import { Link, Section, Text } from "@react-email/components";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://hablaplay.com";

const wrap = {
  paddingTop: "32px",
  marginTop: "24px",
  borderTop: "1px solid #E5E7EB",
};

const text = {
  fontSize: "12px",
  color: "#6B7280",
  lineHeight: "1.6",
  margin: "0 0 8px 0",
};

const linkStyle = {
  color: "#6B7280",
  textDecoration: "underline",
};

export function Footer() {
  return (
    <Section style={wrap}>
      <Text style={text}>
        Habla! · Plataforma editorial de apuestas en Perú · No somos casa
        de apuestas.
      </Text>
      <Text style={text}>
        Apuesta responsable. Si necesitas ayuda: Línea Tugar (gratuita)
        0800-19009.
      </Text>
      <Text style={text}>
        <Link
          href={`${APP_URL}/perfil/preferencias-notif`}
          style={linkStyle}
        >
          Preferencias de email
        </Link>
        {" · "}
        <Link href={`${APP_URL}/perfil/datos-personales`} style={linkStyle}>
          Eliminar cuenta
        </Link>
        {" · "}
        <Link href={APP_URL} style={linkStyle}>
          hablaplay.com
        </Link>
      </Text>
    </Section>
  );
}
