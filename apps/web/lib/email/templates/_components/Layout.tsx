// Wrapper base de todos los emails React Email (Lote H).
//
// Renderiza:
//   <Html lang="es"> <Head /> <Preview text /> <Body bg #F5F7FC>
//     <Container max-width 600px bg #fff radius 12px p 32px>
//       <Header /> {children} <Footer />
//     </Container>
//   </Body> </Html>
//
// `preview` es el texto que aparece en el inbox tras el subject. Mantenerlo
// distinto del subject para aportar info adicional (ej: subject "Bienvenido"
// + preview "Plan Mensual activo hasta el 30/05/2026").

import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
} from "@react-email/components";
import type { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";

interface LayoutProps {
  preview: string;
  children: ReactNode;
}

const main = {
  backgroundColor: "#F5F7FC",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  margin: 0,
  padding: 0,
  color: "#001050",
};

const container = {
  maxWidth: "600px",
  margin: "20px auto",
  backgroundColor: "#FFFFFF",
  borderRadius: "12px",
  padding: "32px",
  boxShadow: "0 4px 24px rgba(0,16,80,0.06)",
  border: "1px solid rgba(0,16,80,0.06)",
};

const content = {
  padding: "0",
};

export function Layout({ preview, children }: LayoutProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Header />
          <Section style={content}>{children}</Section>
          <Footer />
        </Container>
      </Body>
    </Html>
  );
}
