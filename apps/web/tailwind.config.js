/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          "blue-dark": "#001050",
          "blue-mid": "#0038B8",
          "blue-main": "#0052CC",
          "blue-light": "#1A6EFF",
          "blue-pale": "#0A2080",
          gold: "#FFB800",
          "gold-light": "#FFD060",
          surface: "#001570",
          card: "#0A2080",
          card2: "#0D2898",
          border: "#1A3AA0",
          live: "#FF3D3D",
          green: "#00D68F",
          orange: "#FF7A00",
          muted: "#7B93D0",
          text: "#EEF2FF",
        },
      },
      fontFamily: {
        display: ["var(--font-barlow)", "sans-serif"],
        body: ["var(--font-dm-sans)", "sans-serif"],
      },
      keyframes: {
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.2" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "live-pulse": "pulse 1.2s infinite",
        "fade-in": "fade-in 0.3s ease",
      },
    },
  },
  plugins: [],
};
