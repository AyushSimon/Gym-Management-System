/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: token("canvas"),
        base: token("base"),
        surface: token("surface"),
        elevated: token("elevated"),
        accent: token("accent"),
        accent2: token("accent2"),
        fg: token("fg"),
        fg2: token("fg2"),
        muted: token("muted"),
        line: token("line"),
        ok: token("ok"),
        warn: token("warn"),
        err: token("err"),
      },
      fontFamily: {
        sans: ['"Inter Variable"', "ui-sans-serif", "system-ui", "sans-serif"],
        display: ['"Manrope Variable"', '"Inter Variable"', "sans-serif"],
        mono: ['"JetBrains Mono Variable"', "ui-monospace", "monospace"],
      },
      fontSize: {
        meta: ["0.75rem", { lineHeight: "1rem", letterSpacing: "0.01em" }],
        label: ["0.8125rem", { lineHeight: "1.125rem", letterSpacing: "0.005em" }],
        table: ["0.875rem", { lineHeight: "1.25rem" }],
      },
      boxShadow: {
        card: "0 1px 0 0 rgb(255 255 255 / 0.03) inset, 0 8px 24px -12px rgb(0 0 0 / 0.5)",
        pop: "0 20px 48px -16px rgb(0 0 0 / 0.65)",
      },
    },
  },
  plugins: [],
};
