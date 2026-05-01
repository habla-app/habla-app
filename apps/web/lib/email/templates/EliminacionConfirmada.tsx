// Email 11 — Confirmación de eliminación de cuenta (Lote H).
//
// Trigger: tras confirmar el flujo `/perfil/eliminar/confirmar`. Tono
// neutro, transparente. Cero emojis (no es un buen momento para
// celebrar).

import { Heading, Section, Text } from "@react-email/components";
import { Layout } from "./_components";
import { fmtFechaLarga } from "../format";

export interface EliminacionConfirmadaProps {
  email: string;
  fechaEliminacion: Date;
  modo?: "hard" | "soft";
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

const aviso = {
  backgroundColor: "#FFEDD5",
  borderLeft: "4px solid #FF7A00",
  padding: "14px 16px",
  borderRadius: "8px",
  margin: "16px 0",
};

const avisoText = {
  fontSize: "13px",
  color: "rgba(0,16,80,0.85)",
  lineHeight: "1.5",
  margin: 0,
};

const small = {
  fontSize: "13px",
  color: "#6B7280",
  textAlign: "center" as const,
  marginTop: "32px",
};

export function EliminacionConfirmada({
  email,
  fechaEliminacion,
  modo = "soft",
}: EliminacionConfirmadaProps) {
  const detalleModo =
    modo === "hard"
      ? "Tu cuenta y todos los datos asociados se borraron por completo."
      : "Tu cuenta se anonimizó: borramos tus datos personales (nombre, email, teléfono, foto). Conservamos los registros de predicciones por motivos de auditoría e integridad de los torneos en los que participaste, sin asociación a tu identidad.";

  return (
    <Layout preview="Tu cuenta de Habla! fue eliminada">
      <Heading style={heading}>Cuenta eliminada</Heading>
      <Text style={para}>
        Confirmamos la eliminación de tu cuenta de Habla! asociada al
        email <strong>{email}</strong>.
      </Text>
      <Text style={para}>{detalleModo}</Text>
      <Text style={para}>
        <strong>Fecha de eliminación:</strong>{" "}
        {fmtFechaLarga(fechaEliminacion)}
      </Text>

      <Section style={aviso}>
        <Text style={avisoText}>
          Si esto fue un error, escríbenos a{" "}
          <a
            href="mailto:soporte@hablaplay.com"
            style={{ color: "#001050", fontWeight: 700 }}
          >
            soporte@hablaplay.com
          </a>{" "}
          dentro de los próximos 30 días. Si fueras Premium, ya cancelamos
          tu suscripción y no se te cobrará más.
        </Text>
      </Section>

      <Text style={small}>
        Gracias por haber sido parte de Habla!.
      </Text>
    </Layout>
  );
}

EliminacionConfirmada.subject = "Tu cuenta de Habla! fue eliminada";
