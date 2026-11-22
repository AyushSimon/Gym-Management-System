import { ArrowUpRight, Pencil, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { PaymentBadge } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Overlay";
import { useLastDefined } from "@/hooks/useLastDefined";
import type { Payment } from "@/types";
import { METHOD_LABELS, formatCurrency, formatDate, formatDateTime } from "@/utils/format";

interface Props {
  payment: Payment | null;
  onClose: () => void;
  onEdit: (payment: Payment) => void;
  onDelete: (payment: Payment) => void;
}

export function PaymentDetailsModal({ payment, onClose, onEdit, onDelete }: Props) {
  const p = useLastDefined(payment);
  return (
    <Modal
      open={Boolean(payment)}
      size="sm"
      onClose={onClose}
      title="Payment details"
      description={p ? `Record ${p.id}` : undefined}
      footer={
        p && (
          <>
            <Button variant="danger" className="mr-auto" onClick={() => onDelete(p)}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
            <Button onClick={() => onEdit(p)}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
          </>
        )
      }
    >
      {p && (
        <div className="space-y-5">
          <div className="flex items-end justify-between gap-4">
            <p className="num text-3xl font-semibold">{formatCurrency(p.amount)}</p>
            <PaymentBadge status={p.status} />
          </div>
          <dl className="divide-y divide-line rounded-xl border border-line bg-base px-4 text-sm">
            <div className="flex justify-between gap-4 py-2.5">
              <dt className="text-fg2">Member</dt>
              <dd className="text-right">
                {p.member_name} <span className="num text-muted">({p.member_id})</span>
              </dd>
            </div>
            <div className="flex justify-between gap-4 py-2.5">
              <dt className="text-fg2">Payment date</dt>
              <dd>{formatDate(p.payment_date)}</dd>
            </div>
            <div className="flex justify-between gap-4 py-2.5">
              <dt className="text-fg2">Method</dt>
              <dd>{METHOD_LABELS[p.method]}</dd>
            </div>
            <div className="flex justify-between gap-4 py-2.5">
              <dt className="text-fg2">Recorded</dt>
              <dd>{formatDateTime(p.created_at)}</dd>
            </div>
          </dl>
          <div>
            <p className="eyebrow mb-1.5">Notes</p>
            <p className="text-sm text-fg2">{p.notes || "No notes."}</p>
          </div>
          <Link to={`/payments?member=${p.member_id}`} onClick={onClose} className={buttonClasses("secondary", "md", "w-full")}>
            Payment history for {p.member_name} <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </Modal>
  );
}