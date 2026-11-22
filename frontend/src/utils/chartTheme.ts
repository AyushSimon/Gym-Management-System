/**
 * Recharts needs concrete colour strings, so the chart palette mirrors the CSS tokens in styles/index.css.
 * Keep the two in sync when changing the theme.
 */
export interface ChartTheme {
  accent: string;
  accent2: string;
  text: string;
  muted: string;
  grid: string;
  tooltipBg: string;
  tooltipBorder: string;
  series: string[];
}

export const CHART_THEMES: Record<"dark" | "light", ChartTheme> = {
  dark: {
    accent: "#5EEAD4",
    accent2: "#A5B4FC",
    text: "#F1F5F9",
    muted: "#94A3B8",
    grid: "#303B4A",
    tooltipBg: "#263241",
    tooltipBorder: "#303B4A",
    series: ["#5EEAD4", "#A5B4FC", "#7DD3FC", "#C4B5FD", "#94A3B8", "#67E8F9"],
  },
  light: {
    accent: "#0D9488",
    accent2: "#4F46E5",
    text: "#0F172A",
    muted: "#475569",
    grid: "#E2E8F0",
    tooltipBg: "#FFFFFF",
    tooltipBorder: "#E2E8F0",
    series: ["#0D9488", "#4F46E5", "#0284C7", "#7C3AED", "#64748B", "#0891B2"],
  },
};
