// Icono principal del sitio — generado dinámicamente via ImageResponse.
// Next.js lo sirve en `/icon?<hash>` y lo inyecta como <link rel="icon">.
//
// Placeholder brand — reemplazar con asset gráfico final (ver TODO en
// CLAUDE.md §SEO).

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default async function Icon() {
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
          fontSize: 110,
          fontWeight: 900,
          letterSpacing: "-0.03em",
          fontFamily: "sans-serif",
          borderRadius: 36,
        }}
      >
        H!
      </div>
    ),
    size,
  );
}
