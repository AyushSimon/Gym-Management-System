import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast";
import { getErrorMessage } from "@/services/api";
import { createMember, updateMember } from "@/services/members";
import type { Member, MemberInput, Plan } from "@/types";
import { computeEndDate, formatCurrency, isValidISODate, plural, todayISO } from "@/utils/format";
import { applyServerErrors } from "@/utils/forms";
import { memberSchema, stripPhone, type MemberFormValues } from "@/utils/schemas";

const FORM_ID = "member-form";
const FIELDS = ["full_name", "age", "phone", "plan_id", "start_date", "end_date", "payment_status"] as const;

function defaultsFor(member?: Member | null): MemberFormValues {
  if (member) {
    return {
      full_name: member.full_name,
      age: member.age,
      phone: member.phone,
      plan_id: member.plan_id,
      start_date: member.start_date,
      end_date: member.end_date,
      payment_status: member.payment_status,
    };
  }
  return {
    full_name: "",
    age: undefined as unknown as number,
    phone: "",
    plan_id: "",
    start_date: todayISO(),
    end_date: "",
    payment_status: "pending",
  };
}

interface Props {
  open: boolean;
  member?: Member | null;
  plans: Plan[];
  onClose: () => void;
  onSaved: (member: Member) => void;
}

export function MemberFormModal({ open, member, plans, onClose, onSaved }: Props) {
  const toast = useToast();
  const isEdit = Boolean(member);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<MemberFormValues>({ resolver: zodResolver(memberSchema), defaultValues: defaultsFor(member), mode: "onTouched" });

  // Start from a clean form every time the dialog opens (or switches to another member).
  useEffect(() => {
    if (open) {
      reset(defaultsFor(member));
      setFormError(null);
    }
  }, [open, member, reset]);

  const planOptions = useMemo(() => plans.filter((p) => p.is_active || p.id === member?.plan_id), [plans, member]);
  const planId = watch("plan_id");
  const startDate = watch("start_date");
  const plan = plans.find((p) => p.id === planId);
  const planTouched = Boolean(dirtyFields.plan_id);
  const startTouched = Boolean(dirtyFields.start_date);
  const endTouched = Boolean(dirtyFields.end_date);

  // Keep the end date in sync with plan + start date until the user overrides it.
  useEffect(() => {
    if (!open || !plan || !isValidISODate(startDate) || endTouched) return;
    if (isEdit && !planTouched && !startTouched) return;
    setValue("end_date", computeEndDate(startDate, plan.duration_days));
  }, [open, plan, startDate, endTouched, planTouched, startTouched, isEdit, setValue]);

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    const payload: MemberInput = {
      full_name: values.full_name.trim(),
      age: values.age,
      phone: stripPhone(values.phone),
      plan_id: values.plan_id,
      start_date: values.start_date,
      payment_status: values.payment_status,
      // Only send an end date the user chose themselves; otherwise the server derives it from the plan.
      ...(endTouched && values.end_date ? { end_date: values.end_date } : {}),
    };
    try {
      const saved = member ? await updateMember(member.id, payload) : await createMember(payload);
      toast.success(isEdit ? `Saved changes for ${saved.full_name}` : `${saved.full_name} was added as ${saved.id}`);
      onSaved(saved);
    } catch (err) {
      // Keep everything the user typed; just explain what went wrong.
      const attached = applyServerErrors(err, setError, FIELDS);
      setFormError(attached ? "Please fix the highlighted fields." : getErrorMessage(err));
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!isSubmitting}
      title={isEdit ? `Edit ${member?.full_name}` : "Add member"}
      description={isEdit ? `Member ${member?.id}` : "Register a new gym member and start their membership."}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={FORM_ID} loading={isSubmitting}>
            {isEdit ? "Save changes" : "Add member"}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} noValidate onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {formError && (
          <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-err/30 bg-err/10 px-3 py-2.5 text-sm text-err sm:col-span-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {formError}
          </div>
        )}

        <Field label="Full name" htmlFor="mf-name" required error={errors.full_name?.message} className="sm:col-span-2">
          <Input id="mf-name" autoComplete="off" placeholder="e.g. Aarav Sharma" invalid={!!errors.full_name} {...register("full_name")} />
        </Field>

        <Field label="Age" htmlFor="mf-age" required error={errors.age?.message}>
          <Input id="mf-age" type="number" inputMode="numeric" placeholder="e.g. 27" invalid={!!errors.age} {...register("age", { valueAsNumber: true })} />
        </Field>

        <Field label="Contact number" htmlFor="mf-phone" required error={errors.phone?.message}>
          <Input id="mf-phone" type="tel" autoComplete="off" placeholder="e.g. 98765 43210" invalid={!!errors.phone} {...register("phone")} />
        </Field>

        <Field
          label="Membership plan"
          htmlFor="mf-plan"
          required
          error={errors.plan_id?.message}
          hint={plan ? `${plural(plan.duration_days, "day")} · ${formatCurrency(plan.price)}` : planOptions.length === 0 ? "Create an active plan first." : undefined}
          className="sm:col-span-2"
        >
          <Select id="mf-plan" invalid={!!errors.plan_id} {...register("plan_id")}>
            <option value="">Select a plan…</option>
            {planOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {plural(p.duration_days, "day")} · {formatCurrency(p.price)}
                {p.is_active ? "" : " (inactive)"}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Start date" htmlFor="mf-start" required error={errors.start_date?.message}>
          <Input id="mf-start" type="date" invalid={!!errors.start_date} {...register("start_date")} />
        </Field>

        <Field
          label="End date"
          htmlFor="mf-end"
          error={errors.end_date?.message}
          hint={endTouched ? "Custom end date." : "Calculated from the plan. Change it only to override."}
        >
          <Input id="mf-end" type="date" invalid={!!errors.end_date} {...register("end_date")} />
        </Field>

        <Field
          label="Payment status"
          htmlFor="mf-pay"
          hint="Set manually. Recording a payment never changes this automatically."
          className="sm:col-span-2"
        >
          <Select id="mf-pay" {...register("payment_status")}>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
          </Select>
        </Field>
      </form>
    </Modal>
  );
}
