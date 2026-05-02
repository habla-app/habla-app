// Icono grande (512×512) — generado dinámicamente via ImageResponse.
// Next.js lo sirve en `/icon2?<hash>`. Tamaño máximo recomendado por
// Web App Manifest spec; el browser lo usa para splash screens y para
// el ícono principal en algunos OS (Android > 8). Lote I v3.1.

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default async function IconXl() {
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
          fontSize: 290,
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
