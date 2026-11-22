import { useReducedMotion } from "framer-motion";
import { Area, Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useSettings } from "@/hooks/useSettings";
import type { GrowthPoint } from "@/types";
import { CHART_THEMES } from "@/utils/chartTheme";

const LABELS: Record<string, string> = { total_members: "Total members", new_members: "New members" };

export function GrowthChart({ data }: { data: GrowthPoint[] }) {
  const { resolvedTheme } = useSettings();
  const reduce = useReducedMotion();
  const theme = CHART_THEMES[resolvedTheme];
  const tick = { fill: theme.muted, fontSize: 12 };

  return (
    <div className="w-full"><div className="h-60 w-full" role="img" aria-label={`Membership growth: ${data.map((d) => `${d.label} ${d.total_members} total`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="growth-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={theme.accent2} stopOpacity={0.28} />
              <stop offset="100%" stopColor={theme.accent2} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={theme.grid} strokeDasharray="3 4" />
          <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={false} dy={6} />
          <YAxis tick={tick} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
          <Tooltip
            cursor={{ fill: theme.grid, opacity: 0.35 }}
            contentStyle={{ background: theme.tooltipBg, border: `1px solid ${theme.tooltipBorder}`, borderRadius: 10, fontSize: 13, color: theme.text }}
            labelStyle={{ color: theme.muted, marginBottom: 4 }}
            itemStyle={{ color: theme.text }}
            formatter={(value: number, name: string) => [value, LABELS[name] ?? name]}
          />
          <Area
            type="monotone"
            dataKey="total_members"
            stroke={theme.accent2}
            strokeWidth={2}
            fill="url(#growth-fill)"
            dot={{ r: 3, fill: theme.accent2, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            isAnimationActive={!reduce}
            animationDuration={700}
          />
          <Bar dataKey="new_members" fill={theme.accent} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={!reduce} animationDuration={600} />
        </ComposedChart>
      </ResponsiveContainer>
      </div>
      <div className="mt-2 flex items-center justify-center gap-5 text-meta text-fg2" aria-hidden>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: theme.accent2 }} /> Total members
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ background: theme.accent }} /> New this month
        </span>
      </div>
    </div>
  );
}
