// Imagen OG raíz — se genera en runtime via ImageResponse (edge).
// 1200x630, azul brand como fondo y logo tipográfico. Reemplazable por un
// asset gráfico final cuando brand tenga los PNGs listos.
//
// TODO (Lote 2 — placeholders): reemplazar con asset final del equipo de
// marca. Next auto-discovers este archivo y lo sirve en
// /opengraph-image?<hash>.

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Habla! — Predice, compite, gana";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #001050 0%, #0038B8 55%, #0052CC 100%)",
          color: "white",
          fontFamily: "sans-serif",
          padding: "80px",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#FFB800",
            color: "black",
            fontWeight: 900,
            fontSize: "180px",
            letterSpacing: "-0.02em",
            width: "420px",
            height: "180px",
            borderRadius: "24px",
            marginBottom: "48px",
            boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
          }}
        >
          HABLA!
        </div>
        <div
          style={{
            fontSize: "64px",
            fontWeight: 800,
            textAlign: "center",
            lineHeight: 1.1,
            letterSpacing: "-0.01em",
            display: "flex",
          }}
        >
          Predice · Compite · Gana
        </div>
        <div
          style={{
            marginTop: "32px",
            fontSize: "34px",
            fontWeight: 500,
            opacity: 0.85,
            textAlign: "center",
            display: "flex",
          }}
        >
          Torneos de predicciones de fútbol en Perú
        </div>
        <div
          style={{
            position: "absolute",
            bottom: "40px",
            right: "48px",
            fontSize: "26px",
            fontWeight: 700,
            color: "#FFB800",
            display: "flex",
          }}
        >
          hablaplay.com
        </div>
      </div>
    ),
    size,
  );
}
