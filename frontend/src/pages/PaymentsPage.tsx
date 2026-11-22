import { motion } from "framer-motion";
import { CheckCircle2, Clock, Eye, IndianRupee, Pencil, Plus, Receipt, Trash2, X, XCircle, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PaymentDetailsModal } from "@/components/payments/PaymentDetailsModal";
import { PaymentFormModal } from "@/components/payments/PaymentFormModal";
import { PaymentBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Field";
import { Menu, type MenuItem } from "@/components/ui/Menu";
import { ConfirmDialog } from "@/components/ui/Overlay";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Skeleton, TableSkeleton } from "@/components/ui/Skeleton";
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
import { deletePayment, getMemberPayments, getPayment, getPaymentSummary, listPayments } from "@/services/payments";
import type { Payment, PaymentMethod, PaymentQuery, PaymentStatus, SortOrder } from "@/types";
import { METHOD_LABELS, cn, formatCurrency, formatDate, formatNumber } from "@/utils/format";

const STATUS_VALUES = ["paid", "pending", "failed"] as const;
const METHOD_VALUES = Object.keys(METHOD_LABELS) as PaymentMethod[];
const SORT_KEYS = ["id", "member_name", "amount", "payment_date", "status", "method", "created_at"] as const;
const pick = <T extends string>(value: string | null, allowed: readonly T[]): T | "" => (allowed.includes(value as T) ? (value as T) : "");

function Stat({ label, value, caption, icon: Icon, tone }: { label: string; value: string; caption: string; icon: LucideIcon; tone: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <p className="text-label font-medium text-fg2">{label}</p>
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg [&>svg]:h-4 [&>svg]:w-4", tone)}>
          <Icon aria-hidden />
        </span>
      </div>
      <p className="num mt-2 text-2xl font-semibold leading-none">{value}</p>
      <p className="mt-1.5 text-label text-muted">{caption}</p>
    </Card>
  );
}

export default function PaymentsPage() {
  const toast = useToast();
  const { bump } = useDataVersion();
  const { settings } = useSettings();
  const isWide = useMediaQuery("(min-width: 768px)");
  const [params, setParams] = useSearchParams();

  const q = params.get("q") ?? "";
  const status = pick(params.get("status"), STATUS_VALUES);
  const method = pick(params.get("method"), METHOD_VALUES);
  const memberId = params.get("member") ?? "";
  const dateFrom = params.get("from") ?? "";
  const dateTo = params.get("to") ?? "";
  const sortKey = pick(params.get("sort"), SORT_KEYS) || "payment_date";
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

  const [rev, setRev] = useState(0);
  const refresh = () => {
    setRev((r) => r + 1);
    bump();
  };

  const [viewing, setViewing] = useState<Payment | null>(null);
  const [form, setForm] = useState<{ open: boolean; payment: Payment | null }>({ open: false, payment: null });
  const [deleting, setDeleting] = useState<Payment | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const deletingShown = useLastDefined(deleting);

  // Deep links: ?new=1 opens the form, ?view=PAY-0001 opens the details.
  useEffect(() => {
    const view = params.get("view");
    const isNew = params.get("new");
    if (!view && !isNew) return;
    if (isNew) setForm({ open: true, payment: null });
    if (view) {
      getPayment(view)
        .then(setViewing)
        .catch((err) => toast.error(getErrorMessage(err)));
    }
    const next = new URLSearchParams(params);
    next.delete("view");
    next.delete("new");
    setParams(next, { replace: true });
  }, [params, setParams, toast]);

  const query: PaymentQuery = { q, status: status as PaymentStatus | "", method: method as PaymentMethod | "", member_id: memberId, date_from: dateFrom, date_to: dateTo, sort_by: sortKey, sort_order: order, page, page_size: pageSize };
  const payments = useApi((s) => listPayments(query, s), [q, status, method, memberId, dateFrom, dateTo, sortKey, order, page, pageSize, rev]);
  const summary = useApi((s) => getPaymentSummary(s), [rev]);
  const history = useApi((s) => (memberId ? getMemberPayments(memberId, s) : Promise.resolve(null)), [memberId, rev]);

  const data = payments.data;
  const hasFilters = Boolean(q || status || method || memberId || dateFrom || dateTo);
  const sort = { key: sortKey, order };
  const memberHistory = memberId && history.data?.member_id === memberId ? history.data : null;

  const clearFilters = () => {
    setSearch("");
    pushed.current = "";
    setParams(new URLSearchParams(), { replace: true });
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await deletePayment(deleting.id);
      toast.success(`Deleted payment ${deleting.id}`);
      setDeleting(null);
      setViewing(null);
      refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleteBusy(false);
    }
  };

  const edit = (p: Payment) => {
    setViewing(null);
    setForm({ open: true, payment: p });
  };

  const menu = (p: Payment): MenuItem[] => [
    { label: "View details", icon: <Eye />, onSelect: () => setViewing(p) },
    { label: "Edit", icon: <Pencil />, onSelect: () => edit(p) },
    { label: "Delete", icon: <Trash2 />, tone: "danger", divider: true, onSelect: () => setDeleting(p) },
  ];

  const s = summary.data;
  const busy = payments.loading && Boolean(data);

  return (
    <>
      <PageHeader
        title="Payments"
        description="A record of payments received. Nothing is charged through this app."
        actions={
          <Button variant="primary" onClick={() => setForm({ open: true, payment: null })}>
            <Plus className="h-4 w-4" /> Record payment
          </Button>
        }
      />

      <section aria-label="Payment totals" className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {s ? (
          <>
            <Stat label="Total recorded" value={formatNumber(s.total_recorded)} caption={`${formatCurrency(s.total_paid_amount)} collected`} icon={Receipt} tone="bg-accent/10 text-accent" />
            <Stat label="Paid this month" value={formatCurrency(s.paid_this_month)} caption="Payments marked paid" icon={CheckCircle2} tone="bg-ok/10 text-ok" />
            <Stat label="Pending" value={formatNumber(s.pending_count)} caption={`${formatCurrency(s.pending_amount)} outstanding`} icon={Clock} tone="bg-warn/10 text-warn" />
            <Stat label="Failed" value={formatNumber(s.failed_count)} caption="Kept for your records" icon={XCircle} tone="bg-err/10 text-err" />
          </>
        ) : summary.error ? (
          <Card className="sm:col-span-2 xl:col-span-4">
            <ErrorState message={summary.error} onRetry={summary.reload} className="py-6" />
          </Card>
        ) : (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[108px] rounded-xl" />)
        )}
      </section>

      {memberId && (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 border-accent/30 bg-accent/5 px-4 py-3">
          <div className="min-w-0">
            <p className="eyebrow">Payment history for</p>
            <p className="truncate text-sm font-medium">
              {memberHistory?.member_name ?? "Member"} <span className="num text-muted">({memberId})</span>
            </p>
          </div>
          <div className="flex items-center gap-5">
            {memberHistory && (
              <>
                <div>
                  <p className="text-meta text-muted">Total paid</p>
                  <p className="num text-sm text-ok">{formatCurrency(memberHistory.total_paid)}</p>
                </div>
                <div>
                  <p className="text-meta text-muted">Pending</p>
                  <p className="num text-sm text-warn">{formatCurrency(memberHistory.total_pending)}</p>
                </div>
              </>
            )}
            <Button size="sm" variant="ghost" onClick={() => patchParams({ member: null })} aria-label="Show payments for all members">
              <X className="h-3.5 w-3.5" /> All members
            </Button>
          </div>
        </Card>
      )}

      <Card className="mb-4 p-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_9rem_10rem_9.5rem_9.5rem_auto]">
          <SearchInput value={search} onChange={setSearch} label="Search payments" placeholder="Search by ID, member or notes…" className="sm:col-span-2 lg:col-span-1" />
          <Select aria-label="Filter by payment status" value={status} onChange={(e) => patchParams({ status: e.target.value || null })}>
            <option value="">All statuses</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </Select>
          <Select aria-label="Filter by payment method" value={method} onChange={(e) => patchParams({ method: e.target.value || null })}>
            <option value="">All methods</option>
            {METHOD_VALUES.map((m) => (
              <option key={m} value={m}>
                {METHOD_LABELS[m]}
              </option>
            ))}
          </Select>
          <Input type="date" aria-label="Paid from date" value={dateFrom} max={dateTo || undefined} onChange={(e) => patchParams({ from: e.target.value || null })} />
          <Input type="date" aria-label="Paid to date" value={dateTo} min={dateFrom || undefined} onChange={(e) => patchParams({ to: e.target.value || null })} />
          {hasFilters && (
            <Button variant="ghost" onClick={clearFilters} className="sm:col-span-2 lg:col-span-1">
              <X className="h-4 w-4" /> Clear
            </Button>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        {payments.error && !data ? (
          <ErrorState message={payments.error} onRetry={payments.reload} />
        ) : !data ? (
          <TableSkeleton rows={Math.min(pageSize, 8)} cols={6} />
        ) : data.total === 0 ? (
          hasFilters ? (
            <EmptyState icon={<IndianRupee />} title="No payments match these filters" description="Try a different search or clear the filters." action={<Button onClick={clearFilters}>Clear filters</Button>} />
          ) : (
            <EmptyState
              icon={<IndianRupee />}
              title="No payments recorded yet"
              description="Record a payment when a member pays by cash, UPI, card or bank transfer."
              action={
                <Button variant="primary" onClick={() => setForm({ open: true, payment: null })}>
                  <Plus className="h-4 w-4" /> Record payment
                </Button>
              }
            />
          )
        ) : (
          <div aria-busy={busy} className={cn("transition-opacity duration-150", busy && "opacity-60")}>
            {payments.error && (
              <div role="alert" className="flex items-center justify-between gap-3 border-b border-line bg-err/10 px-4 py-2 text-label text-err">
                {payments.error}
                <button type="button" onClick={payments.reload} className="font-medium underline">
                  Retry
                </button>
              </div>
            )}
            {isWide ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-table">
                  <thead className="border-b border-line bg-base/50">
                    <tr>
                      <Th label="Payment ID" sortKey="id" sort={sort} onSort={(k) => patchParams({ sort: nextSort(sort, k).key, order: nextSort(sort, k).order })} />
                      <Th label="Member" sortKey="member_name" sort={sort} onSort={(k) => patchParams({ sort: nextSort(sort, k).key, order: nextSort(sort, k).order })} />
                      <Th label="Amount" sortKey="amount" sort={sort} align="right" onSort={(k) => patchParams({ sort: nextSort(sort, k).key, order: nextSort(sort, k).order })} />
                      <Th label="Date" sortKey="payment_date" sort={sort} onSort={(k) => patchParams({ sort: nextSort(sort, k).key, order: nextSort(sort, k).order })} />
                      <Th label="Method" sortKey="method" sort={sort} onSort={(k) => patchParams({ sort: nextSort(sort, k).key, order: nextSort(sort, k).order })} />
                      <Th label="Status" sortKey="status" sort={sort} onSort={(k) => patchParams({ sort: nextSort(sort, k).key, order: nextSort(sort, k).order })} />
                      <Th label="Notes" className="hidden xl:table-cell" />
                      <th scope="col" className="w-12 px-2">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {data.items.map((p) => (
                      <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }} onClick={() => setViewing(p)} className="cursor-pointer transition-colors hover:bg-elevated/50">
                        <td className="num whitespace-nowrap px-4 py-3 text-fg2">{p.id}</td>
                        <td className="px-4 py-3">
                          <p className="max-w-[14rem] truncate font-medium">{p.member_name}</p>
                          <p className="num text-meta text-muted">{p.member_id}</p>
                        </td>
                        <td className="num whitespace-nowrap px-4 py-3 text-right font-medium">{formatCurrency(p.amount)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-fg2">{formatDate(p.payment_date)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-fg2">{METHOD_LABELS[p.method]}</td>
                        <td className="px-4 py-3">
                          <PaymentBadge status={p.status} />
                        </td>
                        <td className="hidden max-w-[16rem] truncate px-4 py-3 text-fg2 xl:table-cell">{p.notes || "—"}</td>
                        <td className="px-2 py-3 text-right">
                          <Menu items={menu(p)} label={`Actions for payment ${p.id}`} />
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {data.items.map((p) => (
                  <li key={p.id} className="flex items-start gap-3 px-4 py-4">
                    <button type="button" onClick={() => setViewing(p)} className="min-w-0 flex-1 text-left">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="num text-base font-semibold">{formatCurrency(p.amount)}</span>
                        <PaymentBadge status={p.status} />
                      </span>
                      <span className="mt-1 block truncate text-sm">{p.member_name}</span>
                      <span className="num block text-meta text-muted">
                        {p.id} · {formatDate(p.payment_date)} · {METHOD_LABELS[p.method]}
                      </span>
                    </button>
                    <Menu items={menu(p)} label={`Actions for payment ${p.id}`} />
                  </li>
                ))}
              </ul>
            )}
            <Pagination page={data.page} pages={data.pages} total={data.total} pageSize={data.page_size} noun="payments" onPage={(p) => patchParams({ page: p > 1 ? String(p) : null }, true)} />
          </div>
        )}
      </Card>

      <PaymentDetailsModal payment={viewing} onClose={() => setViewing(null)} onEdit={edit} onDelete={(p) => setDeleting(p)} />

      <PaymentFormModal
        open={form.open}
        payment={form.payment}
        presetMember={memberHistory ? { id: memberHistory.member_id, full_name: memberHistory.member_name, plan_id: "" } : null}
        onClose={() => setForm((f) => ({ ...f, open: false }))}
        onSaved={() => {
          setForm((f) => ({ ...f, open: false }));
          refresh();
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete payment record?"
        confirmLabel="Delete record"
        loading={deleteBusy}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        message={
          <>
            This removes record <strong className="text-fg">{deletingShown?.id}</strong> ({deletingShown ? formatCurrency(deletingShown.amount) : ""} for {deletingShown?.member_name}). It doesn’t affect the member’s payment status.
          </>
        }
      />
    </>
  );
}
