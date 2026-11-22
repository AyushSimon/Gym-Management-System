import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast";
import { useApi } from "@/hooks/useApi";
import { getErrorMessage } from "@/services/api";
import { listPlans } from "@/services/memberships";
import { createPayment, updatePayment } from "@/services/payments";
import type { Payment, PaymentInput } from "@/types";
import { METHOD_LABELS, formatCurrency, todayISO } from "@/utils/format";
import { applyServerErrors } from "@/utils/forms";
import { paymentSchema, type PaymentFormValues } from "@/utils/schemas";
import { MemberPicker, type PickedMember } from "./MemberPicker";

const FORM_ID = "payment-form";
const FIELDS = ["member_id", "amount", "payment_date", "method", "status", "notes"] as const;

function defaultsFor(payment?: Payment | null, preset?: PickedMember | null): PaymentFormValues {
  if (payment) {
    return {
      member_id: payment.member_id,
      amount: payment.amount,
      payment_date: payment.payment_date,
      method: payment.method,
      status: payment.status,
      notes: payment.notes,
    };
  }
  return {
    member_id: preset?.id ?? "",
    amount: undefined as unknown as number,
    payment_date: todayISO(),
    method: "cash",
    status: "paid",
    notes: "",
  };
}

interface Props {
  open: boolean;
  payment?: Payment | null;
  /** Pre-selects a member, e.g. when recording from a member’s profile. */
  presetMember?: PickedMember | null;
  onClose: () => void;
  onSaved: (payment: Payment) => void;
}

export function PaymentFormModal({ open, payment, presetMember, onClose, onSaved }: Props) {
  const toast = useToast();
  const isEdit = Boolean(payment);
  const [formError, setFormError] = useState<string | null>(null);
  const [picked, setPicked] = useState<PickedMember | null>(null);
  const plans = useApi((s) => (open ? listPlans({}, s) : Promise.resolve([])), [open]);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormValues>({ resolver: zodResolver(paymentSchema), defaultValues: defaultsFor(payment, presetMember), mode: "onTouched" });

  useEffect(() => {
    if (!open) return;
    reset(defaultsFor(payment, presetMember));
    setFormError(null);
    setPicked(payment ? { id: payment.member_id, full_name: payment.member_name, plan_id: "" } : (presetMember ?? null));
  }, [open, payment, presetMember, reset]);

  // For new payments, suggest the member’s plan price once we know it (never overwrites what was typed).
  const suggestAmount = (member: PickedMember | null) => {
    const price = plans.data?.find((p) => p.id === member?.plan_id)?.price;
    const current = getValues("amount");
    if (!isEdit && price && (current === undefined || Number.isNaN(current))) setValue("amount", price);
  };
  useEffect(() => {
    if (open && picked) suggestAmount(picked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, picked, plans.data]);

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    const payload: PaymentInput = { ...values, notes: values.notes.trim() };
    try {
      const saved = payment ? await updatePayment(payment.id, payload) : await createPayment(payload);
      toast.success(isEdit ? `Updated payment ${saved.id}` : `Recorded ${formatCurrency(saved.amount)} for ${saved.member_name}`);
      onSaved(saved);
    } catch (err) {
      const attached = applyServerErrors(err, setError, FIELDS);
      setFormError(attached ? "Please fix the highlighted fields." : getErrorMessage(err));
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!isSubmitting}
      title={isEdit ? `Edit payment ${payment?.id}` : "Record payment"}
      description="This logs a payment taken outside the app. Nothing is charged here."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={FORM_ID} loading={isSubmitting}>
            {isEdit ? "Save changes" : "Record payment"}
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

        <Field label="Member" htmlFor="pay-member" required error={errors.member_id?.message} className="sm:col-span-2">
          <MemberPicker
            id="pay-member"
            selected={picked}
            invalid={!!errors.member_id}
            onSelect={(m) => {
              setPicked(m);
              setValue("member_id", m.id, { shouldValidate: true, shouldDirty: true });
            }}
          />
        </Field>

        <Field label="Amount (₹)" htmlFor="pay-amount" required error={errors.amount?.message}>
          <Input id="pay-amount" type="number" inputMode="decimal" step="0.01" placeholder="e.g. 4000" invalid={!!errors.amount} {...register("amount", { valueAsNumber: true })} />
        </Field>

        <Field label="Payment date" htmlFor="pay-date" required error={errors.payment_date?.message}>
          <Input id="pay-date" type="date" max={todayISO()} invalid={!!errors.payment_date} {...register("payment_date")} />
        </Field>

        <Field label="Method" htmlFor="pay-method" error={errors.method?.message}>
          <Select id="pay-method" {...register("method")}>
            {Object.entries(METHOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Status" htmlFor="pay-status" error={errors.status?.message}>
          <Select id="pay-status" {...register("status")}>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </Select>
        </Field>

        <Field label="Notes" htmlFor="pay-notes" error={errors.notes?.message} className="sm:col-span-2">
          <Textarea id="pay-notes" rows={2} placeholder="Optional, e.g. receipt number or what the payment covers" invalid={!!errors.notes} {...register("notes")} />
        </Field>

        <p className="flex items-start gap-2 text-meta text-muted sm:col-span-2">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Recording a payment doesn’t change the member’s own payment status. Update that on the member’s profile.
        </p>
      </form>
    </Modal>
  );
}
