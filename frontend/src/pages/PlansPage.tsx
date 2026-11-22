import { motion } from "framer-motion";
import { Eye, Pencil, Plus, PowerOff, Power, Tags, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { PlanDetailsModal } from "@/components/plans/PlanDetailsModal";
import { PlanFormModal } from "@/components/plans/PlanFormModal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Menu, type MenuItem } from "@/components/ui/Menu";
import { ConfirmDialog } from "@/components/ui/Overlay";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useApi } from "@/hooks/useApi";
import { useDataVersion } from "@/hooks/useDataVersion";
import { useDebounce } from "@/hooks/useDebounce";
import { useLastDefined } from "@/hooks/useLastDefined";
import { getErrorMessage } from "@/services/api";
import { deletePlan, listPlans, updatePlan } from "@/services/memberships";
import type { Plan } from "@/types";
import { cn, formatCurrency, plural } from "@/utils/format";
import { rise, staggerParent } from "@/utils/motion";

type ActiveFilter = "all" | "active" | "inactive";

const toInput = (p: Plan, is_active: boolean) => ({
  name: p.name,
  duration_days: p.duration_days,
  price: p.price,
  description: p.description,
  is_active,
});

export default function PlansPage() {
  const toast = useToast();
  const { bump } = useDataVersion();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ActiveFilter>("all");
  const q = useDebounce(search.trim(), 250);
  const [rev, setRev] = useState(0);
  const refresh = () => {
    setRev((r) => r + 1);
    bump();
  };

  const [form, setForm] = useState<{ open: boolean; plan: Plan | null }>({ open: false, plan: null });
  const [viewing, setViewing] = useState<Plan | null>(null);
  const [deleting, setDeleting] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const deletingShown = useLastDefined(deleting);

  const plans = useApi((s) => listPlans({ q, active: filter === "all" ? undefined : filter === "active" }, s), [q, filter, rev]);
  const list = plans.data ?? [];
  const hasFilters = Boolean(q) || filter !== "all";
  const topCount = Math.max(0, ...list.map((p) => p.member_count));

  const setActive = async (plan: Plan, active: boolean) => {
    setBusy(true);
    try {
      await updatePlan(plan.id, toInput(plan, active));
      toast.success(`${plan.name} is now ${active ? "active" : "inactive"}`);
      setDeleting(null);
      setViewing(null);
      refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    // A plan that members are on can't be removed: offer to retire it instead.
    if (deleting.member_count > 0) {
      if (deleting.is_active) await setActive(deleting, false);
      else setDeleting(null);
      return;
    }
    setBusy(true);
    try {
      await deletePlan(deleting.id);
      toast.success(`Deleted the ${deleting.name} plan`);
      setDeleting(null);
      setViewing(null);
      refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const menu = (p: Plan): MenuItem[] => [
    { label: "View details", icon: <Eye />, onSelect: () => setViewing(p) },
    { label: "Edit", icon: <Pencil />, onSelect: () => setForm({ open: true, plan: p }) },
    { label: p.is_active ? "Mark inactive" : "Mark active", icon: p.is_active ? <PowerOff /> : <Power />, onSelect: () => void setActive(p, !p.is_active) },
    { label: "Delete", icon: <Trash2 />, tone: "danger", divider: true, onSelect: () => setDeleting(p) },
  ];

  const inUse = (deletingShown?.member_count ?? 0) > 0;

  return (
    <>
      <PageHeader
        title="Membership plans"
        description={plans.data ? `${plans.data.length} ${plans.data.length === 1 ? "plan" : "plans"}${hasFilters ? " match your filters" : ""}` : "Define durations and pricing for your memberships."}
        actions={
          <Button variant="primary" onClick={() => setForm({ open: true, plan: null })}>
            <Plus className="h-4 w-4" /> New plan
          </Button>
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput value={search} onChange={setSearch} label="Search plans" placeholder="Search plans…" className="sm:w-80" />
        <Segmented
          label="Filter plans by status"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ]}
        />
      </div>

      {plans.error && !plans.data ? (
        <Card>
          <ErrorState message={plans.error} onRetry={plans.reload} />
        </Card>
      ) : !plans.data ? (
        <div role="status" aria-label="Loading plans" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Card>
          {hasFilters ? (
            <EmptyState
              icon={<Tags />}
              title="No plans match"
              description="Try a different search or filter."
              action={
                <Button
                  onClick={() => {
                    setSearch("");
                    setFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<Tags />}
              title="No membership plans yet"
              description="Create a plan before adding members, since every member belongs to a plan."
              action={
                <Button variant="primary" onClick={() => setForm({ open: true, plan: null })}>
                  <Plus className="h-4 w-4" /> Create a plan
                </Button>
              }
            />
          )}
        </Card>
      ) : (
        <motion.ul key={`${q}-${filter}`} variants={staggerParent} initial="initial" animate="animate" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => (
            <motion.li key={p.id} variants={rise}>
              <article
                onClick={() => setViewing(p)}
                className={cn(
                  "flex h-full cursor-pointer flex-col rounded-xl border border-line bg-surface p-5 shadow-card transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-fg2/30",
                  !p.is_active && "opacity-75",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate font-display text-lg font-semibold tracking-tight">{p.name}</h2>
                      {topCount > 0 && list.length > 1 && p.member_count === topCount && <Badge tone="info" dot={false}>Most popular</Badge>}
                    </div>
                    <p className="num mt-0.5 text-meta text-muted">{p.id}</p>
                  </div>
                  <Menu items={menu(p)} label={`Actions for ${p.name}`} />
                </div>

                <p className="num mt-4 text-[1.75rem] font-semibold leading-none">{formatCurrency(p.price)}</p>
                <p className="mt-1.5 text-label text-fg2">
                  for {plural(p.duration_days, "day")} · <span className="num">{formatCurrency(Math.round((p.price / p.duration_days) * 100) / 100)}</span>/day
                </p>

                <p className="mt-4 line-clamp-2 min-h-[2.5rem] flex-1 text-sm text-fg2">{p.description || "No description."}</p>

                <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                  <Link
                    to={`/members?plan=${p.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 text-label text-fg2 transition-colors hover:text-accent"
                  >
                    <Users className="h-3.5 w-3.5" aria-hidden /> {plural(p.member_count, "member")}
                  </Link>
                  <Badge tone={p.is_active ? "ok" : "neutral"}>{p.is_active ? "Active" : "Inactive"}</Badge>
                </div>
              </article>
            </motion.li>
          ))}
        </motion.ul>
      )}

      <PlanDetailsModal plan={viewing} onClose={() => setViewing(null)} onEdit={(p) => setForm({ open: true, plan: p })} onDelete={(p) => setDeleting(p)} />

      <PlanFormModal
        open={form.open}
        plan={form.plan}
        onClose={() => setForm((f) => ({ ...f, open: false }))}
        onSaved={() => {
          setForm((f) => ({ ...f, open: false }));
          setViewing(null);
          refresh();
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title={inUse ? "This plan is in use" : "Delete plan?"}
        tone={inUse ? "primary" : "danger"}
        confirmLabel={inUse ? (deletingShown?.is_active ? "Mark as inactive" : "Got it") : "Delete plan"}
        loading={busy}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        message={
          inUse ? (
            <>
              <strong className="text-fg">{deletingShown?.name}</strong> is assigned to {plural(deletingShown?.member_count ?? 0, "member")}, so it can’t be deleted.{" "}
              {deletingShown?.is_active
                ? "You can mark it inactive instead: current members keep it, but it can’t be chosen for new memberships."
                : "Reassign those members to another plan first."}
            </>
          ) : (
            <>
              This permanently deletes the <strong className="text-fg">{deletingShown?.name}</strong> plan. No members are using it.
            </>
          )
        }
      />
    </>
  );
}
