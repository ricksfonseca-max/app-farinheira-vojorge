/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        // Identidade Vô Jorge (cores tiradas da logo)
        marca: {        // verde da faixa
          50: "#e8f7ee", 100: "#c6ecd5", 200: "#93dbb0", 300: "#6ccb93", 400: "#3dbb74",
          500: "#069a4f", 600: "#058443", 700: "#056b38", 800: "#06552e", 900: "#064325", 950: "#032716",
        },
        cereja: {       // vermelho do contorno da faixa
          300: "#f48a8e", 400: "#ee5a5f", 500: "#e41f27", 600: "#c3151c", 700: "#9e1218",
        },
        mandioca: {     // casca da mandioca
          200: "#efdfc6", 300: "#e3c9a3", 400: "#d6b383", 500: "#c99f68", 600: "#a87f4c", 700: "#7f5f37",
        },
        mata: {         // neutros esverdeados do tema escuro
          50: "#f5f8f6", 100: "#eef3ef", 200: "#dfe8e1", 300: "#c3d1c7", 400: "#93a89a", 500: "#6b8273",
          600: "#4d6355", 700: "#34493c", 800: "#23352a", 900: "#172820", 925: "#10211a", 950: "#0d1b14", 975: "#091510",
        },
        creme: "#fffdf7",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
}
