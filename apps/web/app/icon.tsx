// Icono principal del sitio (192×192) — generado dinámicamente via
// ImageResponse. Next.js lo sirve en `/icon?<hash>` y lo inyecta como
// <link rel="icon">.
//
// Lote I v3.1 (1 may 2026): refresh para soporte maskable PWA — borde
// recto (sin borderRadius) y H! centrado dentro de safe zone (40%
// radius). El OS aplica su propia máscara (círculo Android, squircle
// iOS) al instalar como PWA.

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
        }}
      >
        H!
      </div>
    ),
    size,
  );
}
