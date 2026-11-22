import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Logo, LogoMark } from "@/components/Logo";
import { useApi } from "@/hooks/useApi";
import { useSettings } from "@/hooks/useSettings";
import { NAV_ITEMS } from "@/layouts/nav";
import { checkHealth } from "@/services/system";
import { cn } from "@/utils/format";
import { EASE } from "@/utils/motion";

export const SIDEBAR_WIDTH = 264;
export const SIDEBAR_RAIL_WIDTH = 76;

interface NavListProps {
  collapsed: boolean;
  /** Distinguishes the shared active-pill animation between the sidebar and the mobile drawer. */
  idPrefix: string;
  onNavigate?: () => void;
}

export function NavList({ collapsed, idPrefix, onNavigate }: NavListProps) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          onClick={onNavigate}
          aria-label={item.label}
          title={collapsed ? item.label : undefined}
          className={({ isActive }) =>
            cn(
              "group relative flex h-10 items-center gap-3 rounded-lg px-4 text-sm font-medium transition-colors duration-150",
              isActive ? "text-fg" : "text-fg2 hover:bg-elevated/60 hover:text-fg",
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.span
                  layoutId={`${idPrefix}-active`}
                  className="absolute inset-0 rounded-lg bg-elevated"
                  transition={{ duration: 0.22, ease: EASE }}
                />
              )}
              {isActive && <span aria-hidden className="absolute left-0 top-2.5 h-5 w-[3px] rounded-r-full bg-accent" />}
              <item.icon className={cn("relative h-[18px] w-[18px] shrink-0 transition-colors", isActive && "text-accent")} aria-hidden />
              <span className={cn("relative truncate transition-opacity duration-150", collapsed && "opacity-0")} aria-hidden={collapsed}>
                {item.label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

/** Small connectivity indicator: tells the user at a glance whether the backend is reachable. */
export function ApiStatus({ collapsed = false }: { collapsed?: boolean }) {
  const health = useApi((signal) => checkHealth(signal), []);
  const online = Boolean(health.data) && !health.error;
  const checking = health.loading && !health.data;
  const label = checking ? "Checking API…" : online ? "API connected" : "API unreachable";
  return (
    <button
      type="button"
      onClick={health.reload}
      title={online ? "Backend is reachable" : "Click to retry the connection"}
      className={cn(
        "flex h-9 w-full items-center gap-2.5 rounded-lg px-4 text-label text-fg2 transition-colors hover:bg-elevated/60 hover:text-fg",
      )}
    >
      <span className="relative flex h-2 w-2 shrink-0 items-center justify-center">
        <span className={cn("h-2 w-2 rounded-full", checking ? "bg-warn" : online ? "bg-ok" : "bg-err")} />
      </span>
      <span className={cn("flex-1 truncate text-left transition-opacity duration-150", collapsed && "opacity-0")} aria-hidden={collapsed}>
        {label}
      </span>
      {!online && !checking && !collapsed && <RefreshCw className="h-3.5 w-3.5" aria-hidden />}
      <span className="sr-only">{label}</span>
    </button>
  );
}

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const { settings } = useSettings();
  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? SIDEBAR_RAIL_WIDTH : SIDEBAR_WIDTH }}
      transition={{ duration: 0.24, ease: EASE }}
      className="sticky top-0 z-30 hidden h-dvh shrink-0 flex-col overflow-hidden border-r border-line bg-base md:flex"
    >
      <div className="flex h-16 shrink-0 items-center border-b border-line px-5">{collapsed ? <LogoMark /> : <Logo />}</div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
        <NavList collapsed={collapsed} idPrefix="sidebar" />
      </div>

      <div className="shrink-0 space-y-1 border-t border-line px-3 py-3">
        <ApiStatus collapsed={collapsed} />
        {!collapsed && (
          <div className="rounded-lg bg-surface px-3 py-2.5">
            <p className="eyebrow">Gym</p>
            <p className="mt-0.5 truncate text-sm font-medium">{settings.gymName || "My Gym"}</p>
          </div>
        )}
      </div>
    </motion.aside>
  );
}
