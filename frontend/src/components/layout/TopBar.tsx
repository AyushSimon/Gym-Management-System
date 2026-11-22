import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Menu, Moon, PanelLeftClose, PanelLeftOpen, Search, Sun, X } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { useSettings } from "@/hooks/useSettings";
import { findNav } from "@/layouts/nav";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationsMenu } from "./NotificationsMenu";

interface Props {
  collapsed: boolean;
  /** Only the desktop layout can expand the sidebar; tablets always use the icon rail. */
  canToggleSidebar: boolean;
  onToggleSidebar: () => void;
  onOpenNav: () => void;
}

export function TopBar({ collapsed, canToggleSidebar, onToggleSidebar, onOpenNav }: Props) {
  const { pathname } = useLocation();
  const { resolvedTheme, update } = useSettings();
  const [mobileSearch, setMobileSearch] = useState(false);
  const current = findNav(pathname);

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-base/90 backdrop-blur supports-[backdrop-filter]:bg-base/75">
      <div className="flex h-16 items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onOpenNav} aria-label="Open navigation">
          <Menu className="h-5 w-5" />
        </Button>
        {canToggleSidebar && (
          <Button variant="ghost" size="icon" className="hidden lg:inline-flex" onClick={onToggleSidebar} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
          </Button>
        )}

        <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-label sm:flex">
          <Link to="/" className="text-muted transition-colors hover:text-fg">
            Forma
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-muted" aria-hidden />
          <span aria-current="page" className="truncate font-medium text-fg">
            {current?.title ?? "Not found"}
          </span>
        </nav>
        <span className="truncate text-sm font-medium sm:hidden">{current?.title ?? "Not found"}</span>

        <div className="ml-auto flex min-w-0 items-center gap-1.5">
          <GlobalSearch className="hidden w-full min-w-[16rem] max-w-md md:block lg:w-96" />
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileSearch((v) => !v)} aria-label={mobileSearch ? "Close search" : "Search members"}>
            {mobileSearch ? <X className="h-[18px] w-[18px]" /> : <Search className="h-[18px] w-[18px]" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => update({ theme: resolvedTheme === "dark" ? "light" : "dark" })}
            aria-label={resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            {resolvedTheme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </Button>
          <NotificationsMenu />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {mobileSearch && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
            className="border-t border-line px-4 pb-3 pt-3 md:hidden"
          >
            <GlobalSearch autoFocus onDone={() => setMobileSearch(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
