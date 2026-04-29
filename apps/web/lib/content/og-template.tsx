// OG template compartido para rutas editoriales — Lote 8.
//
// Genera un PNG 1200x630 con el branding de Habla! + título + categoría.
// Lo consumen los `opengraph-image.tsx` de cada ruta dinámica
// (/blog/[slug], /casas/[slug], /guias/[slug], /partidos/[slug]).
// El root `app/opengraph-image.tsx` se mantiene como default (rutas
// que no override-een).
//
// Runtime edge porque Next requiere edge para `ImageResponse`. NO importar
// código Node-only desde acá (fs, ioredis, prisma) — corre en el edge.

import { ImageResponse } from "next/og";

interface Props {
  title: string;
  categoria: string;
  /** Subtitulo opcional. Default: nombre del autor. */
  subtitulo?: string;
}

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

export async function renderOgImage({
  title,
  categoria,
  subtitulo,
}: Props): Promise<ImageResponse> {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background:
            "linear-gradient(135deg, #001050 0%, #0038B8 60%, #0052CC 100%)",
          color: "white",
          fontFamily: "sans-serif",
          padding: "72px",
          position: "relative",
        }}
      >
        {/* Top: Logo + categoría */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#FFB800",
              color: "black",
              fontWeight: 900,
              fontSize: "48px",
              width: "120px",
              height: "60px",
              borderRadius: "12px",
              letterSpacing: "-0.02em",
              boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
            }}
          >
            HABLA!
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "10px 20px",
              borderRadius: "8px",
              background: "rgba(255, 184, 0, 0.18)",
              border: "1.5px solid rgba(255, 184, 0, 0.35)",
              color: "#FFD060",
              fontSize: "20px",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {categoria}
          </div>
        </div>

        {/* Middle: título */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            maxWidth: "1000px",
          }}
        >
          <div
            style={{
              fontSize: "62px",
              fontWeight: 900,
              lineHeight: 1.08,
              letterSpacing: "-0.015em",
              color: "white",
              display: "flex",
            }}
          >
            {title}
          </div>
          {subtitulo ? (
            <div
              style={{
                fontSize: "26px",
                fontWeight: 500,
                color: "rgba(255,255,255,0.78)",
                display: "flex",
              }}
            >
              {subtitulo}
            </div>
          ) : null}
        </div>

        {/* Bottom: dominio */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color: "rgba(255,255,255,0.7)",
            fontSize: "22px",
            fontWeight: 600,
          }}
        >
          <span style={{ color: "#FFB800", fontWeight: 800 }}>
            hablaplay.com
          </span>
          <span>Predice · Compite · Gana</span>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
