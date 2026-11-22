import { useReducedMotion } from "framer-motion";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useSettings } from "@/hooks/useSettings";
import type { DistributionItem } from "@/types";
import { CHART_THEMES } from "@/utils/chartTheme";
import { formatNumber, plural } from "@/utils/format";

export function DistributionChart({ data }: { data: DistributionItem[] }) {
  const { resolvedTheme } = useSettings();
  const reduce = useReducedMotion();
  const theme = CHART_THEMES[resolvedTheme];
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-8">
      <div className="relative h-48 w-48 shrink-0" role="img" aria-label={`Members by plan: ${data.map((d) => `${d.plan_name} ${d.count}`).join(", ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="plan_name"
              innerRadius={58}
              outerRadius={84}
              paddingAngle={data.length > 1 ? 3 : 0}
              stroke="none"
              cornerRadius={4}
              isAnimationActive={!reduce}
              animationDuration={600}
            >
              {data.map((d, i) => (
                <Cell key={d.plan_id} fill={theme.series[i % theme.series.length]} />
              ))}
            </Pie>
            <Tooltip
              cursor={false}
              contentStyle={{ background: theme.tooltipBg, border: `1px solid ${theme.tooltipBorder}`, borderRadius: 10, fontSize: 13, color: theme.text }}
              itemStyle={{ color: theme.text }}
              formatter={(value: number, name: string) => [plural(value, "member"), name]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="num text-2xl font-semibold">{formatNumber(total)}</span>
          <span className="text-meta text-muted">members</span>
        </div>
      </div>

      <ul className="w-full min-w-0 flex-1 space-y-2.5">
        {data.map((d, i) => (
          <li key={d.plan_id} className="flex items-center gap-3 text-sm">
            <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: theme.series[i % theme.series.length] }} />
            <span className="min-w-0 flex-1 truncate text-fg2">{d.plan_name}</span>
            <span className="num text-fg">{d.count}</span>
            <span className="num w-10 text-right text-meta text-muted">{total ? Math.round((d.count / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
