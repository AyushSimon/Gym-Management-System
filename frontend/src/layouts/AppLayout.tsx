import { AnimatePresence, motion } from "framer-motion";
import { Suspense, useEffect, useState } from "react";
import { useLocation, useOutlet } from "react-router-dom";
import { MobileNav } from "@/components/layout/MobileNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { DataVersionProvider } from "@/hooks/useDataVersion";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useSettings } from "@/hooks/useSettings";
import { findNav } from "@/layouts/nav";
import { pageVariants } from "@/utils/motion";

function PageFallback() {
  return (
    <div role="status" aria-label="Loading page" className="space-y-6">
      <Skeleton className="h-9 w-56" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

export function AppLayout() {
  const { pathname } = useLocation();
  // Holding the element lets the outgoing page finish its exit animation with its own content.
  const outlet = useOutlet();
  const { settings, update } = useSettings();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [navOpen, setNavOpen] = useState(false);

  // Tablets get the icon rail; desktops remember the user's choice; phones use the slide-in drawer.
  const collapsed = isDesktop ? settings.sidebarCollapsed : true;

  useEffect(() => {
    const title = findNav(pathname)?.title ?? "Page not found";
    document.title = `${title} · Forma`;
    window.scrollTo(0, 0);
    setNavOpen(false);
  }, [pathname]);

  return (
    <DataVersionProvider>
      <a
        href="#main"
        className="sr-only z-[200] rounded-lg bg-accent px-4 py-2 text-sm font-medium text-[rgb(var(--c-on-accent))] focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <div className="flex min-h-full">
        <Sidebar collapsed={collapsed} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            collapsed={collapsed}
            canToggleSidebar={isDesktop}
            onToggleSidebar={() => update({ sidebarCollapsed: !settings.sidebarCollapsed })}
            onOpenNav={() => setNavOpen(true)}
          />
          <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={pathname} variants={pageVariants} initial="initial" animate="animate" exit="exit">
                <Suspense fallback={<PageFallback />}>{outlet}</Suspense>
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
      <MobileNav open={navOpen} onClose={() => setNavOpen(false)} />
    </DataVersionProvider>
  );
}
