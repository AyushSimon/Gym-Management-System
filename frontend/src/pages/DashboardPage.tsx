import { motion } from "framer-motion";
import { CalendarClock, ClipboardList, CreditCard, IndianRupee, UserCheck, UserPlus, UserX, Users, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { DistributionChart } from "@/components/charts/DistributionChart";
import { GrowthChart } from "@/components/charts/GrowthChart";
import { Avatar } from "@/components/ui/Avatar";
import { MemberStatusBadge, PaymentBadge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ListSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useApi } from "@/hooks/useApi";
import { useDataVersion } from "@/hooks/useDataVersion";
import { useSettings } from "@/hooks/useSettings";
import {
  getDashboardStats,
  getExpiringMemberships,
  getMembershipDistribution,
  getMembershipGrowth,
  getRecentMembers,
  getRecentPayments,
} from "@/services/dashboard";
import { cn, expiryLabel, formatCurrency, formatDate, formatNumber, METHOD_LABELS } from "@/utils/format";
import { rise, staggerParent } from "@/utils/motion";

interface Query<T> {
  data: T | null;
  error: string | null;
  reload: () => void;
}

/** Renders skeleton → error → empty → content for one dashboard widget. */
function Async<T>({
  q,
  skeleton,
  isEmpty,
  empty,
  children,
}: {
  q: Query<T>;
  skeleton: ReactNode;
  isEmpty?: (data: T) => boolean;
  empty: ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (q.data) return isEmpty?.(q.data) ? <>{empty}</> : <>{children(q.data)}</>;
  if (q.error) return <ErrorState message={q.error} onRetry={q.reload} className="py-8" />;
  return <>{skeleton}</>;
}

const TONES = {
  accent: "bg-accent/10 text-accent",
  ok: "bg-ok/10 text-ok",
  err: "bg-err/10 text-err",
  warn: "bg-warn/10 text-warn",
} as const;

function Kpi({ label, value, caption, icon: Icon, tone, to }: { label: string; value: ReactNode; caption: string; icon: LucideIcon; tone: keyof typeof TONES; to: string }) {
  return (
    <motion.div variants={rise}>
      <Link
        to={to}
        className="group block rounded-xl border border-line bg-surface p-5 shadow-card transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-fg2/30"
      >
        <div className="flex items-start justify-between">
          <p className="text-label font-medium text-fg2">{label}</p>
          <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg [&>svg]:h-[18px] [&>svg]:w-[18px]", TONES[tone])}>
            <Icon aria-hidden />
          </span>
        </div>
        <p className="num mt-3 text-[2rem] font-semibold leading-none">{value}</p>
        <p className="mt-2 text-label text-muted">{caption}</p>
      </Link>
    </motion.div>
  );
}

function KpiSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-[138px] rounded-xl" />
      ))}
    </>
  );
}

const ACTIONS = [
  { to: "/members?new=1", label: "Add Member", hint: "Register someone new", icon: UserPlus },
  { to: "/payments?new=1", label: "Record Payment", hint: "Log a payment received", icon: IndianRupee },
  { to: "/members", label: "Manage Members", hint: "Search, edit and renew", icon: Users },
  { to: "/plans", label: "Manage Plans", hint: "Pricing and durations", icon: ClipboardList },
];

function RowLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-elevated/60">
      {children}
    </Link>
  );
}

export default function DashboardPage() {
  const { version } = useDataVersion();
  const { settings } = useSettings();
  const stats = useApi((s) => getDashboardStats(s), [version]);
  const growth = useApi((s) => getMembershipGrowth(6, s), [version]);
  const distribution = useApi((s) => getMembershipDistribution(s), [version]);
  const recentMembers = useApi((s) => getRecentMembers(5, s), [version]);
  const recentPayments = useApi((s) => getRecentPayments(5, s), [version]);
  const expiring = useApi((s) => getExpiringMemberships(6, s), [version]);

  const today = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  const s = stats.data;
  const newThisMonth = growth.data?.[growth.data.length - 1]?.new_members;

  return (
    <>
      <PageHeader title="Dashboard" description={`${today} · ${settings.gymName || "Your gym"} at a glance`} />

      <motion.div variants={staggerParent} initial="initial" animate="animate" className="space-y-6">
        {stats.error && !s ? (
          <div className="rounded-xl border border-line bg-surface">
            <ErrorState message={stats.error} onRetry={stats.reload} />
          </div>
        ) : (
          <section aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {!s ? (
              <KpiSkeleton />
            ) : (
              <>
                <Kpi
                  label="Total members"
                  value={formatNumber(s.total_members)}
                  caption={newThisMonth !== undefined ? `${newThisMonth} joined this month` : `${s.total_plans} plans on offer`}
                  icon={Users}
                  tone="accent"
                  to="/members"
                />
                <Kpi
                  label="Active members"
                  value={formatNumber(s.active_members)}
                  caption={s.expiring_soon > 0 ? `${s.expiring_soon} expiring soon` : "No memberships ending soon"}
                  icon={UserCheck}
                  tone="ok"
                  to="/members?status=active"
                />
                <Kpi
                  label="Expired members"
                  value={formatNumber(s.expired_members)}
                  caption={s.expired_members > 0 ? "Ready to be renewed" : "Everyone is up to date"}
                  icon={UserX}
                  tone="err"
                  to="/members?status=expired"
                />
                <Kpi
                  label="Pending payments"
                  value={formatNumber(s.pending_payments)}
                  caption={s.pending_payments > 0 ? `${formatCurrency(s.pending_amount)} outstanding` : "Nothing outstanding"}
                  icon={CreditCard}
                  tone="warn"
                  to="/payments?status=pending"
                />
              </>
            )}
          </section>
        )}

        <motion.section variants={rise} aria-label="Quick actions" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {ACTIONS.map((a) => (
            <Link
              key={a.label}
              to={a.to}
              className="group flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 transition-colors hover:border-accent/40 hover:bg-elevated/50"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-elevated text-accent [&>svg]:h-[18px] [&>svg]:w-[18px]">
                <a.icon aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{a.label}</span>
                <span className="hidden truncate text-meta text-muted sm:block">{a.hint}</span>
              </span>
            </Link>
          ))}
        </motion.section>

        <div className="grid gap-4 xl:grid-cols-5">
          <motion.div variants={rise} className="xl:col-span-3">
            <SectionCard title="Membership growth" description="Total members and new sign-ups over the last 6 months" className="h-full">
              <Async
                q={growth}
                skeleton={<Skeleton className="h-64 w-full" />}
                isEmpty={(d) => d.every((p) => p.total_members === 0)}
                empty={<EmptyState icon={<Users />} title="No growth data yet" description="Add your first member to start tracking growth." className="py-10" />}
              >
                {(d) => <GrowthChart data={d} />}
              </Async>
            </SectionCard>
          </motion.div>
          <motion.div variants={rise} className="xl:col-span-2">
            <SectionCard title="Membership distribution" description="Members by their current plan" className="h-full">
              <Async
                q={distribution}
                skeleton={<Skeleton className="h-48 w-full" />}
                isEmpty={(d) => d.length === 0}
                empty={<EmptyState icon={<ClipboardList />} title="Nothing to chart yet" description="Distribution appears once members are assigned to plans." className="py-10" />}
              >
                {(d) => <DistributionChart data={d} />}
              </Async>
            </SectionCard>
          </motion.div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <motion.div variants={rise}>
            <SectionCard
              title="Recent registrations"
              className="h-full"
              action={
                <Link to="/members" className="text-label text-accent hover:underline">
                  View all
                </Link>
              }
            >
              <Async
                q={recentMembers}
                skeleton={<ListSkeleton />}
                isEmpty={(d) => d.length === 0}
                empty={<EmptyState title="No members yet" description="New registrations will show up here." className="py-8" />}
              >
                {(list) => (
                  <ul>
                    {list.map((m) => (
                      <li key={m.id}>
                        <RowLink to={`/members?view=${m.id}`}>
                          <Avatar name={m.full_name} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm">{m.full_name}</span>
                            <span className="block truncate text-meta text-muted">
                              {m.plan_name} · joined {formatDate(m.created_at)}
                            </span>
                          </span>
                          <MemberStatusBadge status={m.status} expiringSoon={m.expiring_soon} />
                        </RowLink>
                      </li>
                    ))}
                  </ul>
                )}
              </Async>
            </SectionCard>
          </motion.div>

          <motion.div variants={rise}>
            <SectionCard
              title="Recent payments"
              className="h-full"
              action={
                <Link to="/payments" className="text-label text-accent hover:underline">
                  View all
                </Link>
              }
            >
              <Async
                q={recentPayments}
                skeleton={<ListSkeleton />}
                isEmpty={(d) => d.length === 0}
                empty={<EmptyState title="No payments recorded" description="Payments you record will appear here." className="py-8" />}
              >
                {(list) => (
                  <ul>
                    {list.map((p) => (
                      <li key={p.id}>
                        <RowLink to={`/payments?view=${p.id}`}>
                          <span className="min-w-0 flex-1">
                            <span className="num block text-sm">{formatCurrency(p.amount)}</span>
                            <span className="block truncate text-meta text-muted">
                              {p.member_name} · {formatDate(p.payment_date)} · {METHOD_LABELS[p.method]}
                            </span>
                          </span>
                          <PaymentBadge status={p.status} />
                        </RowLink>
                      </li>
                    ))}
                  </ul>
                )}
              </Async>
            </SectionCard>
          </motion.div>

          <motion.div variants={rise} className="lg:col-span-2 xl:col-span-1">
            <SectionCard title="Upcoming expirations" description="Active memberships ending within a week" className="h-full">
              <Async
                q={expiring}
                skeleton={<ListSkeleton />}
                isEmpty={(d) => d.length === 0}
                empty={<EmptyState icon={<CalendarClock />} title="Nothing expiring soon" description="You’ll see memberships here when they’re about to end." className="py-8" />}
              >
                {(list) => (
                  <ul>
                    {list.map((m) => (
                      <li key={m.id}>
                        <RowLink to={`/members?view=${m.id}`}>
                          <Avatar name={m.full_name} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm">{m.full_name}</span>
                            <span className="block truncate text-meta text-muted">
                              {m.plan_name} · ends {formatDate(m.end_date)}
                            </span>
                          </span>
                          <span className={cn("shrink-0 text-meta font-medium", m.days_remaining <= 2 ? "text-err" : "text-warn")}>{expiryLabel(m)}</span>
                        </RowLink>
                      </li>
                    ))}
                  </ul>
                )}
              </Async>
            </SectionCard>
          </motion.div>
        </div>
      </motion.div>
    </>
  );
}
