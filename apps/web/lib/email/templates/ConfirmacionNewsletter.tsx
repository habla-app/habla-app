// Email 3 — Confirmación doble opt-in del newsletter (Lote H).
//
// Trigger: tras submit en `<NewsletterCTA>` o `/suscribir`. Lleva el link
// de confirmación con token. El link vence en 48h (ver
// `lib/services/newsletter.service.ts`).

import { Heading, Text } from "@react-email/components";
import { Button, Layout } from "./_components";

export interface ConfirmacionNewsletterProps {
  confirmUrl: string;
  email: string;
}

const heading = {
  fontSize: "24px",
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

const small = {
  fontSize: "12px",
  color: "#6B7280",
  marginTop: "24px",
  wordBreak: "break-all" as const,
};

export function ConfirmacionNewsletter({
  confirmUrl,
  email,
}: ConfirmacionNewsletterProps) {
  return (
    <Layout preview="Confirma tu suscripción al newsletter de Habla!">
      <Heading style={heading}>Confirma tu suscripción</Heading>
      <Text style={para}>
        Hola, recibimos tu solicitud para suscribirte al newsletter de
        Habla! con el email <strong>{email}</strong>.
      </Text>
      <Text style={para}>
        Para activar tu suscripción, click en el botón. Recibirás un
        resumen los lunes con: top tipsters, partidos top de la semana,
        nuevos análisis del editor.
      </Text>
      <Button href={confirmUrl}>Confirmar suscripción</Button>
      <Text style={para}>
        Este enlace vence en 48 horas. Si no fuiste tú, ignora este email
        — sin confirmación, no recibirás más correos.
      </Text>
      <Text style={small}>
        Si el botón no funciona, copia este link: {confirmUrl}
      </Text>
    </Layout>
  );
}

ConfirmacionNewsletter.subject = "📬 Confirma tu suscripción a Habla!";
