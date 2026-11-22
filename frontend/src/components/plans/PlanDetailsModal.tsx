import { Pencil, Trash2, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Overlay";
import { useLastDefined } from "@/hooks/useLastDefined";
import type { Plan } from "@/types";
import { formatCurrency, formatDateTime, plural } from "@/utils/format";

interface Props {
  plan: Plan | null;
  onClose: () => void;
  onEdit: (plan: Plan) => void;
  onDelete: (plan: Plan) => void;
}

export function PlanDetailsModal({ plan: current, onClose, onEdit, onDelete }: Props) {
  const plan = useLastDefined(current);
  return (
    <Modal
      open={Boolean(current)}
      size="sm"
      onClose={onClose}
      title={plan?.name ?? "Plan"}
      description={plan ? `Plan ${plan.id}` : undefined}
      footer={
        plan && (
          <>
            <Button variant="danger" className="mr-auto" onClick={() => onDelete(plan)}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
            <Button onClick={() => onEdit(plan)}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
          </>
        )
      }
    >
      {plan && (
        <div className="space-y-5">
          <div className="flex items-end justify-between gap-4">
            <p className="num text-3xl font-semibold">{formatCurrency(plan.price)}</p>
            <Badge tone={plan.is_active ? "ok" : "neutral"}>{plan.is_active ? "Active" : "Inactive"}</Badge>
          </div>
          {plan.description ? <p className="text-sm leading-relaxed text-fg2">{plan.description}</p> : <p className="text-sm text-muted">No description.</p>}
          <dl className="divide-y divide-line rounded-xl border border-line bg-base px-4 text-sm">
            <div className="flex justify-between py-2.5">
              <dt className="text-fg2">Duration</dt>
              <dd>{plural(plan.duration_days, "day")}</dd>
            </div>
            <div className="flex justify-between py-2.5">
              <dt className="text-fg2">Price per day</dt>
              <dd className="num">{formatCurrency(Math.round((plan.price / plan.duration_days) * 100) / 100)}</dd>
            </div>
            <div className="flex justify-between py-2.5">
              <dt className="text-fg2">Members on this plan</dt>
              <dd className="num">{plan.member_count}</dd>
            </div>
            <div className="flex justify-between py-2.5">
              <dt className="text-fg2">Created</dt>
              <dd>{formatDateTime(plan.created_at)}</dd>
            </div>
          </dl>
          {plan.member_count > 0 && (
            <Link to={`/members?plan=${plan.id}`} onClick={onClose} className={buttonClasses("secondary", "md", "w-full")}>
              <Users className="h-4 w-4" /> View {plural(plan.member_count, "member")}
            </Link>
          )}
        </div>
      )}
    </Modal>
  );
}
