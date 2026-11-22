import { motion } from "framer-motion";
import { Eye, IndianRupee, Pencil, RefreshCw, Trash2, UserPlus, Users, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MemberDrawer } from "@/components/members/MemberDrawer";
import { MemberFormModal } from "@/components/members/MemberFormModal";
import { RenewDialog } from "@/components/members/RenewDialog";
import { PaymentFormModal } from "@/components/payments/PaymentFormModal";
import { Avatar } from "@/components/ui/Avatar";
import { MemberStatusBadge, PaymentBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import { Menu, type MenuItem } from "@/components/ui/Menu";
import { ConfirmDialog } from "@/components/ui/Overlay";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { Th, nextSort } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useApi } from "@/hooks/useApi";
import { useDataVersion } from "@/hooks/useDataVersion";
import { useDebounce } from "@/hooks/useDebounce";
import { useLastDefined } from "@/hooks/useLastDefined";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useSettings } from "@/hooks/useSettings";
import { getErrorMessage } from "@/services/api";
import { deleteMember, listMembers } from "@/services/members";
import { listPlans } from "@/services/memberships";
import type { Member, MemberPaymentStatus, MemberQuery, MembershipStatus, SortOrder } from "@/types";
import { cn, expiryLabel, formatDate } from "@/utils/format";

const STATUS_VALUES = ["active", "expiring", "expired", "upcoming"] as const;
const PAYMENT_VALUES = ["paid", "pending"] as const;
const SORT_KEYS = ["id", "full_name", "age", "plan_name", "start_date", "end_date", "status", "payment_status", "created_at"] as const;

const pick = <T extends string>(value: string | null, allowed: readonly T[]): T | "" => (allowed.includes(value as T) ? (value as T) : "");

export default function MembersPage() {
  const toast = useToast();
  const { bump } = useDataVersion();
  const { settings } = useSettings();
  const isWide = useMediaQuery("(min-width: 768px)");
  const [params, setParams] = useSearchParams();

  // ----- URL-backed list state (shareable, survives refresh and back/forward)
  const q = params.get("q") ?? "";
  const status = pick(params.get("status"), STATUS_VALUES);
  const payment = pick(params.get("payment"), PAYMENT_VALUES);
  const plan = params.get("plan") ?? "";
  const sortKey = pick(params.get("sort"), SORT_KEYS) || "created_at";
  const order: SortOrder = params.get("order") === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = settings.pageSize;

  const patchParams = (patch: Record<string, string | null>, keepPage = false) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!keepPage && !("page" in patch)) next.delete("page");
    setParams(next, { replace: true });
  };

  // ----- search box: local text, debounced into the URL
  const [search, setSearch] = useState(q);
  const debounced = useDebounce(search.trim(), 300);
  const pushed = useRef(q);
  useEffect(() => {
    if (debounced !== q) {
      pushed.current = debounced;
      patchParams({ q: debounced || null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);
  useEffect(() => {
    if (q !== pushed.current) {
      pushed.current = q;
      setSearch(q);
    }
  }, [q]);

  // ----- dialogs
  const [viewId, setViewId] = useState<string | null>(null);
  const [form, setForm] = useState<{ open: boolean; member: Member | null }>({ open: false, member: null });
  const [renewing, setRenewing] = useState<Member | null>(null);
  const [paying, setPaying] = useState<Member | null>(null);
  const [deleting, setDeleting] = useState<Member | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const renewingShown = useLastDefined(renewing);
  const payingShown = useLastDefined(paying);
  const deletingShown = useLastDefined(deleting);

  // Deep links from the dashboard, notifications and search: ?new=1 and ?view=M-0001.
  useEffect(() => {
    const view = params.get("view");
    const isNew = params.get("new");
    if (!view && !isNew) return;
    if (view) setViewId(view);
    if (isNew) setForm({ open: true, member: null });
    const next = new URLSearchParams(params);
    next.delete("view");
    next.delete("new");
    setParams(next, { replace: true });
  }, [params, setParams]);

  // ----- data
  const [rev, setRev] = useState(0);
  const refresh = () => {
    setRev((r) => r + 1);
    bump();
  };

  const query: MemberQuery = {
    q,
    status: (status === "expiring" ? "active" : status) as MembershipStatus | "",
    expiring: status === "expiring",
    payment_status: payment as MemberPaymentStatus | "",
    plan_id: plan,
    sort_by: sortKey,
    sort_order: order,
    page,
    page_size: pageSize,
  };
  const members = useApi((s) => listMembers(query, s), [q, status, payment, plan, sortKey, order, page, pageSize, rev]);
  const plans = useApi((s) => listPlans({}, s), [rev]);

  const data = members.data;
  const hasFilters = Boolean(q || status || payment || plan);
  const sort = { key: sortKey, order };
  const clearFilters = () => {
    setSearch("");
    pushed.current = "";
    setParams(new URLSearchParams(), { replace: true });
  };

  const onSort = (key: string) => {
    const next = nextSort(sort, key);
    patchParams({ sort: next.key, order: next.order });
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await deleteMember(deleting.id);
      toast.success(`Deleted ${deleting.full_name}. Their payment history was kept.`);
      if (viewId === deleting.id) setViewId(null);
      setDeleting(null);
      refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleteBusy(false);
    }
  };

  const menuItems = (m: Member): MenuItem[] => [
    { label: "View details", icon: <Eye />, onSelect: () => setViewId(m.id) },
    { label: "Edit", icon: <Pencil />, onSelect: () => setForm({ open: true, member: m }) },
    { label: "Renew membership", icon: <RefreshCw />, onSelect: () => setRenewing(m) },
    { label: "Record payment", icon: <IndianRupee />, onSelect: () => setPaying(m) },
    { label: "Delete", icon: <Trash2 />, tone: "danger", divider: true, onSelect: () => setDeleting(m) },
  ];

  const planOptions = plans.data ?? [];
  const busy = members.loading && Boolean(data);
  const sortedPlan = useMemo(() => planOptions.find((p) => p.id === plan), [planOptions, plan]);

  return (
    <>
      <PageHeader
        title="Members"
        description={data ? `${data.total} ${data.total === 1 ? "member" : "members"}${hasFilters ? " match your filters" : " registered"}` : "Manage everyone who trains at your gym."}
        actions={
          <Button variant="primary" onClick={() => setForm({ open: true, member: null })}>
            <UserPlus className="h-4 w-4" /> Add member
          </Button>
        }
      />

      <Card className="mb-4 p-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_repeat(3,11rem)_auto]">
          <SearchInput value={search} onChange={setSearch} label="Search members" placeholder="Search by ID, name or phone…" className="sm:col-span-2 lg:col-span-1" />
          <Select aria-label="Filter by membership status" value={status} onChange={(e) => patchParams({ status: e.target.value || null })}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="expiring">Expiring soon</option>
            <option value="expired">Expired</option>
            <option value="upcoming">Upcoming</option>
          </Select>
          <Select aria-label="Filter by payment status" value={payment} onChange={(e) => patchParams({ payment: e.target.value || null })}>
            <option value="">Any payment</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
          </Select>
          <Select aria-label="Filter by plan" value={plan} onChange={(e) => patchParams({ plan: e.target.value || null })}>
            <option value="">All plans</option>
            {planOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            {plan && !sortedPlan && <option value={plan}>{plan}</option>}
          </Select>
          {hasFilters && (
            <Button variant="ghost" onClick={clearFilters} className="sm:col-span-2 lg:col-span-1">
              <X className="h-4 w-4" /> Clear
            </Button>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        {members.error && !data ? (
          <ErrorState message={members.error} onRetry={members.reload} />
        ) : !data ? (
          <TableSkeleton rows={Math.min(pageSize, 8)} cols={7} />
        ) : data.total === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={<Users />}
              title="No members match these filters"
              description="Try a different search or clear the filters."
              action={<Button onClick={clearFilters}>Clear filters</Button>}
            />
          ) : (
            <EmptyState
              icon={<Users />}
              title="No members yet"
              description="Add your first member to start tracking memberships and payments."
              action={
                <Button variant="primary" onClick={() => setForm({ open: true, member: null })}>
                  <UserPlus className="h-4 w-4" /> Add member
                </Button>
              }
            />
          )
        ) : (
          <div aria-busy={busy} className={cn("transition-opacity duration-150", busy && "opacity-60")}>
            {members.error && (
              <div role="alert" className="flex items-center justify-between gap-3 border-b border-line bg-err/10 px-4 py-2 text-label text-err">
                {members.error}
                <button type="button" onClick={members.reload} className="font-medium underline">
                  Retry
                </button>
              </div>
            )}
            {isWide ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-table">
                  <thead className="border-b border-line bg-base/50">
                    <tr>
                      <Th label="ID" sortKey="id" sort={sort} onSort={onSort} />
                      <Th label="Name" sortKey="full_name" sort={sort} onSort={onSort} />
                      <Th label="Age" sortKey="age" sort={sort} onSort={onSort} className="hidden xl:table-cell" />
                      <Th label="Contact" className="hidden lg:table-cell" />
                      <Th label="Plan" sortKey="plan_name" sort={sort} onSort={onSort} />
                      <Th label="Start" sortKey="start_date" sort={sort} onSort={onSort} className="hidden lg:table-cell" />
                      <Th label="End" sortKey="end_date" sort={sort} onSort={onSort} />
                      <Th label="Status" sortKey="status" sort={sort} onSort={onSort} />
                      <Th label="Payment" sortKey="payment_status" sort={sort} onSort={onSort} />
                      <Th label="Joined" sortKey="created_at" sort={sort} onSort={onSort} className="hidden 2xl:table-cell" />
                      <th scope="col" className="w-12 px-2">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {data.items.map((m) => (
                      <motion.tr
                        key={m.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.15 }}
                        onClick={() => setViewId(m.id)}
                        className="cursor-pointer transition-colors hover:bg-elevated/50"
                      >
                        <td className="num whitespace-nowrap px-4 py-3 text-fg2">{m.id}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={m.full_name} className="h-8 w-8" />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewId(m.id);
                              }}
                              className="max-w-[14rem] truncate text-left font-medium hover:text-accent"
                            >
                              {m.full_name}
                            </button>
                          </div>
                        </td>
                        <td className="num hidden px-4 py-3 text-fg2 xl:table-cell">{m.age}</td>
                        <td className="num hidden whitespace-nowrap px-4 py-3 text-fg2 lg:table-cell">{m.phone}</td>
                        <td className="whitespace-nowrap px-4 py-3">{m.plan_name}</td>
                        <td className="hidden whitespace-nowrap px-4 py-3 text-fg2 lg:table-cell">{formatDate(m.start_date)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-fg2">{formatDate(m.end_date)}</td>
                        <td className="px-4 py-3">
                          <MemberStatusBadge status={m.status} expiringSoon={m.expiring_soon} />
                          <p className="mt-1 whitespace-nowrap text-meta text-muted">{expiryLabel(m)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <PaymentBadge status={m.payment_status} />
                        </td>
                        <td className="hidden whitespace-nowrap px-4 py-3 text-fg2 2xl:table-cell">{formatDate(m.created_at)}</td>
                        <td className="px-2 py-3 text-right">
                          <Menu items={menuItems(m)} label={`Actions for ${m.full_name}`} />
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {data.items.map((m) => (
                  <li key={m.id} className="flex items-start gap-3 px-4 py-4">
                    <Avatar name={m.full_name} />
                    <button type="button" onClick={() => setViewId(m.id)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate font-medium">{m.full_name}</span>
                      <span className="num block text-meta text-muted">
                        {m.id} · {m.phone}
                      </span>
                      <span className="mt-1 block text-label text-fg2">
                        {m.plan_name} · ends {formatDate(m.end_date)}
                      </span>
                      <span className="mt-2 flex flex-wrap items-center gap-2">
                        <MemberStatusBadge status={m.status} expiringSoon={m.expiring_soon} />
                        <PaymentBadge status={m.payment_status} />
                      </span>
                    </button>
                    <Menu items={menuItems(m)} label={`Actions for ${m.full_name}`} />
                  </li>
                ))}
              </ul>
            )}
            <Pagination page={data.page} pages={data.pages} total={data.total} pageSize={data.page_size} noun="members" onPage={(p) => patchParams({ page: p > 1 ? String(p) : null }, true)} />
          </div>
        )}
      </Card>

      <MemberDrawer
        memberId={viewId}
        version={rev}
        onClose={() => setViewId(null)}
        onEdit={(m) => setForm({ open: true, member: m })}
        onRenew={(m) => setRenewing(m)}
        onRecordPayment={(m) => setPaying(m)}
        onDelete={(m) => setDeleting(m)}
      />

      <MemberFormModal
        open={form.open}
        member={form.member}
        plans={planOptions}
        onClose={() => setForm((f) => ({ ...f, open: false }))}
        onSaved={() => {
          setForm((f) => ({ ...f, open: false }));
          refresh();
        }}
      />

      <RenewDialog
        open={Boolean(renewing)}
        member={renewingShown}
        plans={planOptions}
        onClose={() => setRenewing(null)}
        onRenewed={() => {
          setRenewing(null);
          refresh();
        }}
      />

      <PaymentFormModal
        open={Boolean(paying)}
        presetMember={payingShown ? { id: payingShown.id, full_name: payingShown.full_name, plan_id: payingShown.plan_id } : null}
        onClose={() => setPaying(null)}
        onSaved={() => {
          setPaying(null);
          refresh();
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete member?"
        confirmLabel="Delete member"
        loading={deleteBusy}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        message={
          <>
            This permanently removes <strong className="text-fg">{deletingShown?.full_name}</strong> ({deletingShown?.id}). Their recorded payments stay in the payment history.
          </>
        }
      />
    </>
  );
}
