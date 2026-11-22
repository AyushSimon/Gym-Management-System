import { motion } from "framer-motion";
import { ArrowUpRight, CalendarPlus, IndianRupee, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useRef } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "@/components/ui/Avatar";
import { MemberStatusBadge, PaymentBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Overlay";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { useApi } from "@/hooks/useApi";
import { getMember, } from "@/services/members";
import { getMemberPayments } from "@/services/payments";
import type { Member, MemberPaymentHistory } from "@/types";
import { METHOD_LABELS, daysBetween, expiryLabel, formatCurrency, formatDate, formatDateTime, todayISO } from "@/utils/format";

interface Props {
  memberId: string | null;
  /** Bump to refetch after an edit, renewal or payment. */
  version: number;
  onClose: () => void;
  onEdit: (member: Member) => void;
  onRenew: (member: Member) => void;
  onRecordPayment: (member: Member) => void;
  onDelete: (member: Member) => void;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-label text-fg2">{label}</dt>
      <dd className="text-right text-sm text-fg">{children}</dd>
    </div>
  );
}

function Progress({ member }: { member: Member }) {
  const total = Math.max(1, daysBetween(member.start_date, member.end_date) + 1);
  const elapsed = Math.min(total, Math.max(0, daysBetween(member.start_date, todayISO()) + 1));
  const ratio = member.status === "upcoming" ? 0 : member.status === "expired" ? 1 : elapsed / total;
  const tone = member.status === "expired" ? "bg-err" : member.expiring_soon ? "bg-warn" : "bg-accent";
  return (
    <div>
      <div className="h-1.5 overflow-hidden rounded-full bg-elevated" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)} aria-label="Membership elapsed">
        <motion.div
          className={`h-full origin-left rounded-full ${tone}`}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: ratio }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
      <p className="mt-2 text-label text-fg2">{expiryLabel(member)}</p>
    </div>
  );
}

export function MemberDrawer({ memberId, version, onClose, onEdit, onRenew, onRecordPayment, onDelete }: Props) {
  const member = useApi<Member | null>((s) => (memberId ? getMember(memberId, s) : Promise.resolve(null)), [memberId, version]);
  const history = useApi<MemberPaymentHistory | null>((s) => (memberId ? getMemberPayments(memberId, s) : Promise.resolve(null)), [memberId, version]);

  // Keep the last loaded content on screen while the drawer slides out.
  const kept = useRef<{ member: Member | null; history: MemberPaymentHistory | null }>({ member: null, history: null });
  if (member.data) kept.current.member = member.data;
  if (history.data) kept.current.history = history.data;
  const m = memberId ? (member.data?.id === memberId ? member.data : null) : kept.current.member;
  const h = memberId ? (history.data?.member_id === memberId ? history.data : null) : kept.current.history;

  return (
    <Drawer
      open={Boolean(memberId)}
      onClose={onClose}
      title={m?.full_name ?? "Member details"}
      description={m ? `${m.id} · joined ${formatDate(m.created_at)}` : undefined}
      footer={
        m && (
          <>
            <Button size="sm" onClick={() => onEdit(m)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
            <Button size="sm" onClick={() => onRenew(m)}>
              <RefreshCw className="h-3.5 w-3.5" /> Renew
            </Button>
            <Button size="sm" onClick={() => onRecordPayment(m)}>
              <IndianRupee className="h-3.5 w-3.5" /> Record payment
            </Button>
            <Button size="sm" variant="danger" className="ml-auto" onClick={() => onDelete(m)}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </>
        )
      }
    >
      {member.error && !m ? (
        <ErrorState message={member.error} onRetry={member.reload} />
      ) : !m ? (
        <div role="status" aria-label="Loading member" className="space-y-4">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar name={m.full_name} className="h-14 w-14 text-base" />
            <div className="flex flex-wrap gap-2">
              <MemberStatusBadge status={m.status} expiringSoon={m.expiring_soon} />
              <PaymentBadge status={m.payment_status} />
            </div>
          </div>

          <section aria-label="Membership period">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="eyebrow">Current plan</p>
                <p className="mt-0.5 font-display text-lg font-semibold">{m.plan_name}</p>
              </div>
              <p className="num text-label text-fg2">
                {formatDate(m.start_date)} → {formatDate(m.end_date)}
              </p>
            </div>
            <Progress member={m} />
          </section>

          <dl className="divide-y divide-line rounded-xl border border-line bg-base px-4">
            <Row label="Member ID">
              <span className="num">{m.id}</span>
            </Row>
            <Row label="Age">{m.age}</Row>
            <Row label="Contact">
              <a href={`tel:${m.phone}`} className="num text-fg hover:text-accent">
                {m.phone}
              </a>
            </Row>
            <Row label="Plan length">{m.plan_duration_days} days</Row>
            <Row label="Registered">{formatDateTime(m.created_at)}</Row>
          </dl>

          {m.history.length > 0 && (
            <section aria-label="Previous memberships">
              <h3 className="eyebrow mb-2">Previous periods</h3>
              <ul className="space-y-2">
                {[...m.history].reverse().map((p, i) => (
                  <li key={`${p.start_date}-${i}`} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-label">
                    <span className="text-fg">{p.plan_name}</span>
                    <span className="num text-fg2">
                      {formatDate(p.start_date)} → {formatDate(p.end_date)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-label="Payment history">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="eyebrow">Payment history</h3>
              <Link to={`/payments?member=${m.id}`} onClick={onClose} className="inline-flex items-center gap-1 text-label text-accent hover:underline">
                View all <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {!h ? (
              history.error ? (
                <p className="text-label text-err">{history.error}</p>
              ) : (
                <Skeleton className="h-20 w-full" />
              )
            ) : h.items.length === 0 ? (
              <p className="flex items-center gap-2 rounded-lg border border-dashed border-line px-3 py-4 text-label text-fg2">
                <CalendarPlus className="h-4 w-4" aria-hidden /> No payments recorded yet.
              </p>
            ) : (
              <>
                <div className="mb-3 grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-line bg-base px-3 py-2.5">
                    <p className="text-meta text-muted">Total paid</p>
                    <p className="num text-base text-ok">{formatCurrency(h.total_paid)}</p>
                  </div>
                  <div className="rounded-lg border border-line bg-base px-3 py-2.5">
                    <p className="text-meta text-muted">Pending</p>
                    <p className="num text-base text-warn">{formatCurrency(h.total_pending)}</p>
                  </div>
                </div>
                <ul className="divide-y divide-line rounded-lg border border-line">
                  {h.items.slice(0, 5).map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="num text-sm">{formatCurrency(p.amount)}</p>
                        <p className="text-meta text-muted">
                          {formatDate(p.payment_date)} · {METHOD_LABELS[p.method]}
                        </p>
                      </div>
                      <PaymentBadge status={p.status} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>
      )}
    </Drawer>
  );
}
