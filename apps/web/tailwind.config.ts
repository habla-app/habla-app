import type { Config } from "tailwindcss";

// Design tokens v3.1 (Lote A). Sincronizados con
// docs/ux-spec/00-design-system/tokens.md y mockup-actualizado.html.
// Cualquier color hardcodeado en .tsx/.ts debe moverse aquí o a globals.css.
//
// Política de extensión: las paletas existentes (brand, urgent, accent, dark,
// pred, alert info/success, medal) se conservan tal cual desde Lotes 0-11.
// Lote A agrega: alert warning/danger, premium, admin, status, whatsapp,
// vital, zIndex, premium gradients/shadows, whatsapp pattern.
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
           brand.* — paleta core (azules y dorado) + estados base.
           Para dark surfaces (header, hero live) usar dark.*.
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
          "gold-dark": "#8B6200", /* gold number/icon sobre bg light */
          green: "#00D68F",
          orange: "#FF7A00",
        },

        /* urgent.* — match cards por tiempo de cierre */
        urgent: {
          critical: "#FF2E2E",
          "critical-bg": "#FFE5E5",
          "critical-hover": "#E02020",
          high: "#FF7A00",
          "high-bg": "#FFEDD5",
          "high-dark": "#9A3412",
          med: "#FFB800",
          "med-bg": "#FFF3C2",
          low: "#7B93D0",
          "low-bg": "#EEF2FF",
        },

        /* accent.* — acento por tipo de torneo */
        accent: {
          mundial: "#8B5CF6",
          "mundial-bg": "#F3E8FF",
          "mundial-dark": "#6D28D9",
          clasico: "#DC2626",
          "clasico-bg": "#FFEBEB",
          "clasico-dark": "#991B1B",
          libertadores: "#059669",
          "libertadores-bg": "#D1FAE5",
          "libertadores-dark": "#065F46",
          "champions-bg": "#E0E7FF",
          "champions-dark": "#1E3A8A",
          express: "#38BDF8",
          "express-bg": "#E0F2FE",
          "express-dark": "#0369A1",
        },

        /* dark.* — superficies oscuras (header, live hero, estadio vibe) */
        dark: {
          surface: "#001050",
          card: "#0A2080",
          "card-2": "#0D2898",
          border: "#1A3AA0",
          text: "#EEF2FF",
          muted: "#7B93D0",
        },

        /* pred.* — chips de predicciones en tickets */
        pred: {
          correct: "#00D68F",
          "correct-bg": "#D1FAE5",
          wrong: "#FF3D3D",
          "wrong-bg": "#FFE5E5",
          pending: "rgba(0, 16, 80, 0.35)",
          "pending-bg": "#F1F4FB",
        },

        /* alert.* — patrones .alert-info / .alert-success del mockup +
           warning / danger agregados en Lote A (tokens.md §4). */
        alert: {
          "info-bg": "#E0EBFF",
          "info-border": "#B8CAFF",
          "info-text": "#1D3F8E",
          "success-bg": "#D1FAE5",
          "success-border": "#A6E7C5",
          "success-text": "#065F46",
          "warning-bg": "#FFF7E6",
          "warning-border": "#FFD060",
          "warning-text": "#92400E",
          "danger-bg": "#FFE5E5",
          "danger-border": "#FFB0B0",
          "danger-text": "#991B1B",
        },

        /* hover de chip (tint dorado pastel muy sutil) */
        "chip-hover": "#FFFDF5",

        /* danger — texto de botones tipo cancelar sesión / destructive */
        danger: "#C9302C",

        /* medal.* — colores para posiciones 1°/2°/3° en rankings
           (top-pos.gold/silver/bronze del mockup). Los valores silver y
           bronze se alinearon al mockup v5 (antes #737373 / #A0522D).
           Los tints 8-10% se usan inline como border-l-[color] en
           RankingTable para las filas top-1/2/3. */
        medal: {
          gold: "#B8860B",
          silver: "#C0C0C0",
          bronze: "#CD7F32",
        },

        /* premium.* — Lote A v3.1 (tokens.md §5). Vistas Premium oscuras
           (landing, checkout, pick bloqueado, mockup WhatsApp). */
        premium: {
          surface: "#0a0e25",
          "surface-2": "#1a1f3a",
          border: "rgba(255, 184, 0, 0.3)",
          "border-soft": "rgba(255, 184, 0, 0.15)",
          "text-on-dark": "#FFFFFF",
          "text-muted-on-dark": "rgba(255, 255, 255, 0.7)",
          "text-soft-on-dark": "rgba(255, 255, 255, 0.45)",
          watermark: "rgba(255, 255, 255, 0.06)",
          "blur-content": "rgba(255, 255, 255, 0.04)",
        },

        /* admin.* — Lote A v3.1 (tokens.md §6). Vistas administrativas
           desktop. Densidad mayor, sin animaciones decorativas. */
        admin: {
          "sidebar-bg": "#001050",
          "sidebar-text": "rgba(255, 255, 255, 0.85)",
          "sidebar-text-muted": "rgba(255, 255, 255, 0.55)",
          "sidebar-active-bg": "rgba(255, 184, 0, 0.15)",
          "sidebar-active-text": "#FFB800",
          "sidebar-hover-bg": "rgba(255, 255, 255, 0.05)",
          "sidebar-section-label": "rgba(255, 255, 255, 0.4)",
          "sidebar-divider": "rgba(255, 255, 255, 0.08)",
          "content-bg": "#F5F7FC",
          "card-bg": "#FFFFFF",
          "table-row-hover": "#F1F4FB",
          "table-row-stripe": "#F8FAFD",
          "table-border": "rgba(0, 16, 80, 0.06)",
        },

        /* status.* — Lote A v3.1 (tokens.md §6). Semáforo de KPIs,
           alarmas, sync states. */
        status: {
          green: "#00D68F",
          "green-bg": "#D1FAE5",
          "green-text": "#065F46",
          amber: "#F59E0B",
          "amber-bg": "#FEF3C7",
          "amber-text": "#92400E",
          red: "#EF4444",
          "red-bg": "#FEE2E2",
          "red-text": "#991B1B",
          "neutral-bg": "#F3F4F6",
          "neutral-text": "#6B7280",
        },

        /* whatsapp.* — Lote A v3.1 (tokens.md §7). Componentes que
           visualizan WhatsApp Channel/Business (mockup Premium landing,
           badge "Activo en WhatsApp", etc.). */
        whatsapp: {
          green: "#25D366",
          "green-dark": "#128C7E",
          "green-darker": "#075E54",
          "chat-bg": "#ECE5DD",
          "chat-bubble": "#FFFFFF",
          "chat-meta": "#888888",
          "check-blue": "#4FC3F7",
        },

        /* vital.* — Lote A v3.1 (tokens.md §8). Semáforo Lighthouse para
           dashboard admin de mobile vitals. */
        vital: {
          good: "#00D68F",
          "needs-work": "#F59E0B",
          poor: "#EF4444",
        },
      },

      /* clases bg-page, bg-app, bg-card, bg-subtle, bg-hover */
      backgroundColor: {
        page: "#F5F7FC",
        app: "#FFFFFF",
        card: "#FFFFFF",
        subtle: "#F1F4FB",
        hover: "rgba(0, 16, 80, 0.04)",
      },

      /* clases text-dark, text-body, text-muted-d, text-soft */
      textColor: {
        dark: "#001050",
        body: "rgba(0, 16, 80, 0.85)",
        "muted-d": "rgba(0, 16, 80, 0.58)",
        soft: "rgba(0, 16, 80, 0.42)",
      },

      /* clases border-light, border-strong */
      borderColor: {
        light: "rgba(0, 16, 80, 0.08)",
        strong: "rgba(0, 16, 80, 0.16)",
      },

      /* escala rounded-sm/md/lg/xl */
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "20px",
      },

      /* shadows — escala + acentos (gold/urgent/green/nav-top) +
         sombras Premium agregadas en Lote A (tokens.md §10). */
      boxShadow: {
        sm: "0 1px 2px rgba(0, 16, 80, 0.06), 0 1px 3px rgba(0, 16, 80, 0.08)",
        md: "0 4px 12px rgba(0, 16, 80, 0.1), 0 2px 4px rgba(0, 16, 80, 0.06)",
        lg: "0 12px 28px rgba(0, 16, 80, 0.14), 0 4px 8px rgba(0, 16, 80, 0.08)",
        xl: "0 24px 60px rgba(0, 16, 80, 0.25), 0 8px 16px rgba(0, 16, 80, 0.12)",
        gold: "0 8px 24px rgba(255, 184, 0, 0.3)",
        "gold-btn": "0 3px 8px rgba(255, 184, 0, 0.3)",
        "gold-cta": "0 4px 14px rgba(255, 184, 0, 0.4)",
        urgent: "0 8px 24px rgba(255, 46, 46, 0.25)",
        "urgent-btn": "0 4px 12px rgba(255, 46, 46, 0.35)",
        /* glow medio para section-bar icons finalizado (verde) y live (rojo) */
        "green-glow": "0 6px 16px rgba(0, 214, 143, 0.3)",
        "red-glow": "0 6px 16px rgba(255, 46, 46, 0.3)",
        /* borde con glow para mcard.urgency-high */
        "urgent-high-glow": "0 6px 18px rgba(255, 122, 0, 0.15)",
        /* sombra hacia arriba para el bottom-nav fijo mobile */
        "nav-top": "0 -4px 12px rgba(0, 16, 80, 0.08)",
        /* Premium — Lote A v3.1 */
        "premium-card":
          "0 12px 40px rgba(10, 14, 37, 0.5), 0 0 0 1px rgba(255, 184, 0, 0.1) inset",
        "premium-cta": "0 8px 24px rgba(255, 184, 0, 0.4)",
        "premium-locked": "inset 0 0 60px rgba(0, 0, 0, 0.3)",
      },

      fontFamily: {
        display: ["var(--font-barlow)", "sans-serif"],
        body: ["var(--font-dm-sans)", "sans-serif"],
      },

      /* gradientes reutilizables del mockup + Premium/WhatsApp del Lote A */
      backgroundImage: {
        /* Dark stadium — hero live dedicado */
        stadium:
          "linear-gradient(180deg, #001050 0%, #000530 70%, #000420 100%)",
        /* Hero azul — wallet hero, perfil hero, combo-panel-head.
           Lote 6C: corregido al mockup .balance-hero-v2 (--blue-main → --blue-dark). */
        "hero-blue":
          "linear-gradient(135deg, #0052CC 0%, #001050 100%)",
        /* Logo mark circular */
        "gold-radial":
          "radial-gradient(circle at 30% 30%, #FFB800, #FF8C00)",
        /* Avatar dorado */
        "gold-diagonal":
          "linear-gradient(135deg, #FFB800 0%, #FF8C00 100%)",
        /* Gold shimmer stripe del combo-panel-head */
        "gold-shimmer":
          "linear-gradient(90deg, #FFB800, #FFD060, #FFB800)",
        /* Section-bar gradient light */
        "section-subtle":
          "linear-gradient(90deg, #F1F4FB, transparent)",
        /* Section-bar live */
        "section-live":
          "linear-gradient(90deg, #FFE5E5, transparent)",
        /* Section-bar finalized */
        "section-finalized":
          "linear-gradient(90deg, #E8FAF1, transparent)",
        /* Urgency critical mcard bg */
        "mcard-critical":
          "linear-gradient(135deg, #fff, #FFF9F9)",
        "mcard-high":
          "linear-gradient(135deg, #fff, #FFFBF5)",
        /* Stripe animado para mcard.urgency-critical (rojo-naranja-rojo) */
        "mcard-critical-stripe":
          "linear-gradient(90deg, #FF2E2E, #FF7A00, #FF2E2E)",
        /* Widget head — live (dark diagonal) y top-day (pastel dorado sutil) */
        "widget-live-head":
          "linear-gradient(135deg, #001050, #000530)",
        "widget-top-head":
          "linear-gradient(90deg, #FFF9E5, transparent)",
        /* Premium — Lote A v3.1 (tokens.md §5) */
        "premium-card-gradient":
          "linear-gradient(135deg, #0a0e25 0%, #1a1f3a 100%)",
        "premium-hero-gradient":
          "radial-gradient(circle at 80% 0%, rgba(37,211,102,0.15) 0%, transparent 50%), linear-gradient(180deg, #0a0e25 0%, #1a1f3a 100%)",
        "premium-lock-overlay":
          "linear-gradient(180deg, transparent 0%, rgba(10, 14, 37, 0.95) 90%)",
        "gold-soft-glow":
          "radial-gradient(circle at 50% 50%, rgba(255, 184, 0, 0.15) 0%, transparent 70%)",
        /* WhatsApp chat pattern — Lote A v3.1 (tokens.md §7) */
        "whatsapp-chat-pattern":
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cpath d='M0 0h100v100H0z' fill='%23ECE5DD'/%3E%3Cpath d='M20 20l5 5M40 60l5 5M70 30l5 5M30 80l5 5' stroke='%23DDD7CB' stroke-width='1.5'/%3E%3C/svg%3E\")",
      },

      /* z-index jerárquico — Lote A v3.1 (tokens.md §12). Reemplaza
         valores ad-hoc (`z-50`, `z-[100]`) dispersos. */
      zIndex: {
        base: "0",
        dropdown: "10",
        sticky: "20",
        header: "30",
        sidebar: "40",
        drawer: "50",
        "modal-backdrop": "60",
        modal: "70",
        toast: "80",
        tooltip: "90",
      },

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
        "slide-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
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
        "toast-in": {
          from: { opacity: "0", transform: "translateX(-50%) translateY(-24px)" },
          to: { opacity: "1", transform: "translateX(-50%) translateY(0)" },
        },
      },
      animation: {
        "live-pulse": "pulse 1.5s infinite",
        "pulse-dot": "pulse-dot 1.2s infinite",
        "pulse-border": "pulse-border 2s infinite",
        shimmer: "shimmer 2s infinite linear",
        "scale-in": "scale-in 0.22s cubic-bezier(.2,.9,.3,1.1)",
        shake: "shake 0.4s ease-in-out",
        "slide-down": "slide-down 0.25s ease",
        "slide-up": "slide-up 0.25s ease",
        "fade-in": "fade-in 0.3s ease",
        "live-pulse-bg": "live-pulse-bg 2s infinite",
        "toast-in": "toast-in 0.3s ease",
      },
    },
  },
  plugins: [],
};

export default config;
