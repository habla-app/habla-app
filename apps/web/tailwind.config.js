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
        habla: {
          primary: "#FF6B00",    // Naranja principal
          secondary: "#1A1A2E",  // Azul oscuro
          accent: "#FFD700",     // Dorado (premios)
          success: "#10B981",
          danger: "#EF4444",
          dark: "#0F0F1A",
          light: "#F8F9FA",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Montserrat", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
