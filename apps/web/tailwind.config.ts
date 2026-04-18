import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        /* ------------------------------------------------------------------
           brand.* — paleta core (azules y dorado) + estados
           NOTA: algunas claves (surface/card/card2/border/muted/text/live)
           son legacy de Sprint 0/1 y se migrarán a dark.* en Fase 2.
        ------------------------------------------------------------------ */
        brand: {
          "blue-dark": "#001050",
          "blue-mid": "#0038B8",
          "blue-main": "#0052CC",
          "blue-light": "#1A6EFF",
          "blue-pale": "#0A2080",
          gold: "#FFB800",
          "gold-dim": "rgba(255, 184, 0, 0.15)",
          "gold-light": "#FFD060",
          green: "#00D68F",
          live: "#FF3D3D",
          orange: "#FF7A00",
          /* legacy — migrar en Fase 2 */
          surface: "#001570",
          card: "#0A2080",
          card2: "#0D2898",
          border: "#1A3AA0",
          muted: "#7B93D0",
          text: "#EEF2FF",
        },

        /* ------------------------------------------------------------------
           urgent.* — match cards por tiempo de cierre
        ------------------------------------------------------------------ */
        urgent: {
          critical: "#FF2E2E",
          "critical-bg": "#FFE5E5",
          high: "#FF7A00",
          "high-bg": "#FFEDD5",
          med: "#FFB800",
          "med-bg": "#FFF3C2",
          low: "#7B93D0",
          "low-bg": "#EEF2FF",
        },

        /* ------------------------------------------------------------------
           accent.* — acento por tipo de torneo
        ------------------------------------------------------------------ */
        accent: {
          mundial: "#8B5CF6",
          "mundial-bg": "#F3E8FF",
          clasico: "#DC2626",
          "clasico-bg": "#FFEBEB",
          libertadores: "#059669",
          "libertadores-bg": "#D1FAE5",
        },

        /* ------------------------------------------------------------------
           dark.* — superficies oscuras (header, live hero, estadio vibe)
        ------------------------------------------------------------------ */
        dark: {
          surface: "#001050",
          card: "#0A2080",
          "card-2": "#0D2898",
          border: "#1A3AA0",
          text: "#EEF2FF",
          muted: "#7B93D0",
        },

        /* ------------------------------------------------------------------
           pred.* — resultado de predicciones (chips en tickets / live)
        ------------------------------------------------------------------ */
        pred: {
          correct: "#00D68F",
          "correct-bg": "#D1FAE5",
          wrong: "#FF3D3D",
          "wrong-bg": "#FFE5E5",
          pending: "rgba(0, 16, 80, 0.35)",
          "pending-bg": "#F1F4FB",
        },
      },

      /* ------------------------------------------------------------------
         backgroundColor — clases bg-page, bg-app, bg-subtle, bg-hover
      ------------------------------------------------------------------ */
      backgroundColor: {
        page: "#F5F7FC",
        app: "#FFFFFF",
        card: "#FFFFFF",
        subtle: "#F1F4FB",
        hover: "rgba(0, 16, 80, 0.04)",
      },

      /* ------------------------------------------------------------------
         textColor — clases text-dark, text-body, text-muted-d, text-soft
      ------------------------------------------------------------------ */
      textColor: {
        dark: "#001050",
        body: "rgba(0, 16, 80, 0.85)",
        "muted-d": "rgba(0, 16, 80, 0.58)",
        soft: "rgba(0, 16, 80, 0.42)",
      },

      /* ------------------------------------------------------------------
         borderColor — clases border-light, border-strong
      ------------------------------------------------------------------ */
      borderColor: {
        light: "rgba(0, 16, 80, 0.08)",
        strong: "rgba(0, 16, 80, 0.16)",
      },

      /* ------------------------------------------------------------------
         borderRadius — escala rounded-sm/md/lg/xl
      ------------------------------------------------------------------ */
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "20px",
      },

      /* ------------------------------------------------------------------
         boxShadow — escala + shadow-gold / shadow-urgent
      ------------------------------------------------------------------ */
      boxShadow: {
        sm: "0 1px 2px rgba(0, 16, 80, 0.06), 0 1px 3px rgba(0, 16, 80, 0.08)",
        md: "0 4px 12px rgba(0, 16, 80, 0.1), 0 2px 4px rgba(0, 16, 80, 0.06)",
        lg: "0 12px 28px rgba(0, 16, 80, 0.14), 0 4px 8px rgba(0, 16, 80, 0.08)",
        xl: "0 24px 60px rgba(0, 16, 80, 0.25), 0 8px 16px rgba(0, 16, 80, 0.12)",
        gold: "0 8px 24px rgba(255, 184, 0, 0.3)",
        urgent: "0 8px 24px rgba(255, 46, 46, 0.25)",
      },

      /* ------------------------------------------------------------------
         fontFamily
      ------------------------------------------------------------------ */
      fontFamily: {
        display: ["var(--font-barlow)", "sans-serif"],
        body: ["var(--font-dm-sans)", "sans-serif"],
      },

      /* ------------------------------------------------------------------
         keyframes + animation — clonados del mockup
      ------------------------------------------------------------------ */
      keyframes: {
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
        "pulse-dot": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(255, 46, 46, 0.7)" },
          "70%": { boxShadow: "0 0 0 10px rgba(255, 46, 46, 0)" },
        },
        "pulse-border": {
          "0%, 100%": {
            boxShadow:
              "0 8px 24px rgba(255, 46, 46, 0.25), 0 0 0 0 rgba(255, 46, 46, 0.4)",
          },
          "70%": {
            boxShadow:
              "0 8px 24px rgba(255, 46, 46, 0.25), 0 0 0 8px rgba(255, 46, 46, 0)",
          },
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.9)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "25%": { transform: "translateX(-4px)" },
          "75%": { transform: "translateX(4px)" },
        },
        "slide-down": {
          from: { opacity: "0", transform: "translateY(-12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "live-pulse-bg": {
          "0%, 100%": { backgroundColor: "rgba(255, 46, 46, 0)" },
          "50%": { backgroundColor: "rgba(255, 46, 46, 0.08)" },
        },
      },
      animation: {
        "live-pulse": "pulse 1.5s infinite",
        "pulse-dot": "pulse-dot 1.2s infinite",
        "pulse-border": "pulse-border 2s infinite",
        shimmer: "shimmer 2s infinite linear",
        "scale-in": "scale-in 0.3s ease",
        shake: "shake 0.4s ease-in-out",
        "slide-down": "slide-down 0.25s ease",
        "fade-in": "fade-in 0.3s ease",
        "live-pulse-bg": "live-pulse-bg 2s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
