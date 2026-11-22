import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ArrowRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast";
import { getErrorMessage } from "@/services/api";
import { renewMember } from "@/services/members";
import type { Member, Plan } from "@/types";
import { addDays, computeEndDate, formatCurrency, formatDate, isValidISODate, plural, todayISO } from "@/utils/format";
import { applyServerErrors } from "@/utils/forms";
import { renewSchema, type RenewFormValues } from "@/utils/schemas";

const FORM_ID = "renew-form";

interface Props {
  open: boolean;
  member: Member | null;
  plans: Plan[];
  onClose: () => void;
  onRenewed: (member: Member) => void;
}

export function RenewDialog({ open, member, plans, onClose, onRenewed }: Props) {
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RenewFormValues>({ resolver: zodResolver(renewSchema), defaultValues: { plan_id: "", start_date: "" } });

  useEffect(() => {
    if (open && member) {
      reset({ plan_id: member.plan_id, start_date: "" });
      setFormError(null);
    }
  }, [open, member, reset]);

  const planId = watch("plan_id");
  const startInput = watch("start_date");
  const options = useMemo(() => plans.filter((p) => p.is_active || p.id === member?.plan_id), [plans, member]);
  const plan = plans.find((p) => p.id === planId);

  // Same rule as the server: continue straight after the current period, or start today if it already ended.
  const preview = useMemo(() => {
    if (!member || !plan) return null;
    const today = todayISO();
    const start = startInput && isValidISODate(startInput) ? startInput : member.end_date >= today ? addDays(member.end_date, 1) : today;
    return { start, end: computeEndDate(start, plan.duration_days) };
  }, [member, plan, startInput]);

  const submit = handleSubmit(async (values) => {
    if (!member) return;
    setFormError(null);
    try {
      const renewed = await renewMember(member.id, { plan_id: values.plan_id, start_date: values.start_date || null });
      toast.success(`Renewed ${renewed.full_name} until ${formatDate(renewed.end_date)}`);
      onRenewed(renewed);
    } catch (err) {
      const attached = applyServerErrors(err, setError, ["plan_id", "start_date"]);
      setFormError(attached ? "Please fix the highlighted fields." : getErrorMessage(err));
    }
  });

  return (
    <Modal
      open={open}
      size="sm"
      onClose={onClose}
      dismissible={!isSubmitting}
      title="Renew membership"
      description={member ? `${member.full_name} · ${member.id}` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={FORM_ID} loading={isSubmitting}>
            Renew
          </Button>
        </>
      }
    >
      <form id={FORM_ID} noValidate onSubmit={submit} className="space-y-4">
        {formError && (
          <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-err/30 bg-err/10 px-3 py-2.5 text-sm text-err">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {formError}
          </div>
        )}
        <Field label="Plan" htmlFor="rn-plan" required error={errors.plan_id?.message} hint={plan ? `${plural(plan.duration_days, "day")} · ${formatCurrency(plan.price)}` : undefined}>
          <Select id="rn-plan" invalid={!!errors.plan_id} {...register("plan_id")}>
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.is_active ? "" : " (inactive)"}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Start date" htmlFor="rn-start" error={errors.start_date?.message} hint="Optional. Leave empty to continue right after the current period.">
          <Input id="rn-start" type="date" invalid={!!errors.start_date} {...register("start_date")} />
        </Field>
        {preview && (
          <div className="rounded-lg border border-line bg-base px-3.5 py-3 text-sm">
            <p className="eyebrow mb-1.5">New period</p>
            <p className="flex items-center gap-2 text-fg">
              <span className="num">{formatDate(preview.start)}</span>
              <ArrowRight className="h-3.5 w-3.5 text-muted" aria-hidden />
              <span className="num">{formatDate(preview.end)}</span>
            </p>
            <p className="mt-2 text-meta text-muted">The current period is saved to the member’s history, and payment status is set to pending until you record the payment.</p>
          </div>
        )}
      </form>
    </Modal>
  );
}
