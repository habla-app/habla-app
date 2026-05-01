// Email 2 — Bienvenida tras registro completado (Lote H).
//
// Trigger: tras completar `/auth/completar-perfil` (elegir @username) que
// marca el usuario como `registroCompletado = true`. Sólo se envía la
// primera vez.

import { Heading, Hr, Text } from "@react-email/components";
import { Button, Layout } from "./_components";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://hablaplay.com";

export interface BienvenidaRegistroProps {
  nombre: string;
  username: string;
}

const heading = {
  fontSize: "26px",
  margin: "0 0 12px 0",
  color: "#001050",
  fontWeight: 800 as const,
};

const para = {
  fontSize: "15px",
  color: "rgba(0,16,80,0.85)",
  lineHeight: "1.55",
  margin: "0 0 12px 0",
};

const listItem = {
  fontSize: "14px",
  color: "rgba(0,16,80,0.85)",
  lineHeight: "1.7",
  margin: "0 0 4px 0",
};

const hr = {
  border: "none",
  borderTop: "1px solid #E5E7EB",
  margin: "24px 0",
};

export function BienvenidaRegistro({
  nombre,
  username,
}: BienvenidaRegistroProps) {
  return (
    <Layout preview={`@${username}, bienvenido a Habla!`}>
      <Heading style={heading}>¡Bienvenido, {nombre}! 👋</Heading>
      <Text style={para}>
        Tu cuenta <strong>@{username}</strong> está lista. Ya puedes
        empezar a competir en la Liga Habla! por <strong>S/ 1,250</strong>{" "}
        en premios cada mes.
      </Text>

      <Text style={{ ...para, fontWeight: 700, marginTop: "24px" }}>
        Cómo funciona:
      </Text>
      <Text style={listItem}>1. Elige un partido top de la semana.</Text>
      <Text style={listItem}>
        2. Predice los 5 mercados (resultado, ambos anotan, +2.5 goles,
        roja, marcador exacto).
      </Text>
      <Text style={listItem}>
        3. Suma puntos y compite por el podio de tu mes.
      </Text>

      <Button href={`${APP_URL}/comunidad`}>Ver Liga Habla!</Button>

      <Hr style={hr} />

      <Text style={{ ...para, fontSize: "13px", color: "#6B7280" }}>
        ¿Quieres picks de valor en tu WhatsApp? Mira{" "}
        <a
          href={`${APP_URL}/premium`}
          style={{ color: "#001050", fontWeight: 700 }}
        >
          Habla! Premium
        </a>
        .
      </Text>
    </Layout>
  );
}

BienvenidaRegistro.subject = "👋 Bienvenido a Habla!";
