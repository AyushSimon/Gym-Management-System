import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useRef } from "react";
import { createPortal } from "react-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import { useOverlay } from "@/components/ui/Overlay";
import { useSettings } from "@/hooks/useSettings";
import { EASE } from "@/utils/motion";
import { ApiStatus, NavList } from "./Sidebar";

function Panel({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const { settings } = useSettings();
  useOverlay(onClose, ref, true);
  return (
    <div className="fixed inset-0 z-40 md:hidden">
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-[rgb(var(--c-backdrop)/0.65)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
      />
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        tabIndex={-1}
        initial={{ x: "-100%" }}
        animate={{ x: 0 }}
        exit={{ x: "-100%" }}
        transition={{ duration: 0.26, ease: EASE }}
        className="absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col border-r border-line bg-base shadow-pop outline-none"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-line pl-5 pr-3">
          <Logo />
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close navigation">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <NavList collapsed={false} idPrefix="mobile" onNavigate={onClose} />
        </div>
        <div className="space-y-1 border-t border-line px-3 py-3">
          <ApiStatus />
          <div className="rounded-lg bg-surface px-3 py-2.5">
            <p className="eyebrow">Gym</p>
            <p className="mt-0.5 truncate text-sm font-medium">{settings.gymName || "My Gym"}</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  return createPortal(<AnimatePresence>{open && <Panel key="mobile-nav" onClose={onClose} />}</AnimatePresence>, document.body);
}
