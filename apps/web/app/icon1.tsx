// Icono mediano (384×384) — generado dinámicamente via ImageResponse.
// Next.js lo sirve en `/icon1?<hash>` y lo agrega al manifest como
// segundo tamaño maskable. Lote I v3.1.

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 384, height: 384 };
export const contentType = "image/png";

export default async function IconLarge() {
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
          fontSize: 220,
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
