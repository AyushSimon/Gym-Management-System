import { AnimatePresence, motion } from "framer-motion";
import { Bell, CalendarClock, CreditCard, UserX } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useApi } from "@/hooks/useApi";
import { useDataVersion } from "@/hooks/useDataVersion";
import { getDashboardStats, getExpiringMemberships } from "@/services/dashboard";
import { expiryLabel, plural } from "@/utils/format";

function Item({ to, icon, title, detail, onClick }: { to: string; icon: ReactNode; title: string; detail: string; onClick: () => void }) {
  return (
    <Link to={to} onClick={onClick} className="flex items-start gap-3 rounded-lg px-2.5 py-2.5 transition-colors hover:bg-surface">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-elevated text-fg2 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm">{title}</span>
        <span className="block text-meta text-muted">{detail}</span>
      </span>
    </Link>
  );
}

/** Alerts derived from live backend data: memberships about to end, expired members and pending payments. */
export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const { version } = useDataVersion();
  const wrapper = useRef<HTMLDivElement>(null);
  const stats = useApi((s) => getDashboardStats(s), [version]);
  const expiring = useApi((s) => getExpiringMemberships(4, s), [version]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const s = stats.data;
  const count = s ? s.expiring_soon + s.expired_members + s.pending_payments : 0;
  const close = () => setOpen(false);

  return (
    <div ref={wrapper} className="relative">
      <Button
        variant="ghost"
        size="icon"
        aria-label={count > 0 ? `Notifications, ${count} items need attention` : "Notifications"}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative"
      >
        <Bell className="h-[18px] w-[18px]" />
        {count > 0 && <span aria-hidden className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent ring-2 ring-base" />}
      </Button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] origin-top-right rounded-xl border border-line bg-elevated p-1.5 shadow-pop"
          >
            <p className="eyebrow px-2.5 pb-1 pt-2">Needs attention</p>
            {!s ? (
              stats.error ? (
                <p className="px-2.5 py-4 text-label text-err">{stats.error}</p>
              ) : (
                <div className="space-y-2 p-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              )
            ) : count === 0 ? (
              <p className="px-2.5 py-5 text-center text-label text-fg2">You’re all caught up.</p>
            ) : (
              <div>
                {(expiring.data ?? []).map((m) => (
                  <Item
                    key={m.id}
                    to={`/members?view=${m.id}`}
                    onClick={close}
                    icon={<CalendarClock />}
                    title={`${m.full_name}’s plan is ending`}
                    detail={expiryLabel(m)}
                  />
                ))}
                {s.expired_members > 0 && (
                  <Item
                    to="/members?status=expired"
                    onClick={close}
                    icon={<UserX />}
                    title={`${plural(s.expired_members, "expired membership")}`}
                    detail="Review and renew"
                  />
                )}
                {s.pending_payments > 0 && (
                  <Item
                    to="/payments?status=pending"
                    onClick={close}
                    icon={<CreditCard />}
                    title={`${plural(s.pending_payments, "pending payment")}`}
                    detail="Follow up and mark as paid"
                  />
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
