// Icono apple-touch — Next.js lo sirve en `/apple-icon?<hash>` y lo
// inyecta como <link rel="apple-touch-icon">.
//
// Placeholder brand — reemplazar con asset gráfico final (ver TODO en
// CLAUDE.md §SEO).

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#001050",
          color: "#FFB800",
          fontSize: 100,
          fontWeight: 900,
          letterSpacing: "-0.03em",
          fontFamily: "sans-serif",
        }}
      >
        H!
      </div>
    ),
    size,
  );
}
