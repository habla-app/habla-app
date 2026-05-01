// Email 1 — Magic link de NextAuth (Lote H).
//
// Trigger: `apps/web/lib/auth.ts` provider Resend dispara el envío al pedir
// login pasivo con email. El link vence en 30 minutos por configuración de
// NextAuth.

import { Heading, Text } from "@react-email/components";
import { Button, Layout } from "./_components";

export interface MagicLinkAuthProps {
  magicLink: string;
  nombre?: string;
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
  margin: "0 0 16px 0",
};

const small = {
  fontSize: "12px",
  color: "#6B7280",
  marginTop: "24px",
};

export function MagicLinkAuth({ magicLink, nombre }: MagicLinkAuthProps) {
  return (
    <Layout preview="Tu enlace de acceso a Habla! (válido 30 minutos)">
      <Heading style={heading}>
        Hola{nombre ? ` ${nombre}` : ""} 👋
      </Heading>
      <Text style={para}>
        Click en el botón para entrar a Habla!. Este enlace funciona solo
        una vez y vence en 30 minutos.
      </Text>
      <Button href={magicLink}>Entrar a Habla!</Button>
      <Text style={small}>
        ¿No fuiste tú? Ignora este email. Nadie puede entrar sin el enlace.
      </Text>
    </Layout>
  );
}

MagicLinkAuth.subject = "🔐 Tu enlace de acceso a Habla!";
