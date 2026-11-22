import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Field, Input, Switch, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast";
import { getErrorMessage } from "@/services/api";
import { createPlan, updatePlan } from "@/services/memberships";
import type { Plan, PlanInput } from "@/types";
import { applyServerErrors } from "@/utils/forms";
import { planSchema, type PlanFormValues } from "@/utils/schemas";

const FORM_ID = "plan-form";
const FIELDS = ["name", "duration_days", "price", "description", "is_active"] as const;

const defaultsFor = (plan?: Plan | null): PlanFormValues =>
  plan
    ? { name: plan.name, duration_days: plan.duration_days, price: plan.price, description: plan.description, is_active: plan.is_active }
    : {
        name: "",
        duration_days: undefined as unknown as number,
        price: undefined as unknown as number,
        description: "",
        is_active: true,
      };

interface Props {
  open: boolean;
  plan?: Plan | null;
  onClose: () => void;
  onSaved: (plan: Plan) => void;
}

export function PlanFormModal({ open, plan, onClose, onSaved }: Props) {
  const toast = useToast();
  const isEdit = Boolean(plan);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PlanFormValues>({ resolver: zodResolver(planSchema), defaultValues: defaultsFor(plan), mode: "onTouched" });

  useEffect(() => {
    if (open) {
      reset(defaultsFor(plan));
      setFormError(null);
    }
  }, [open, plan, reset]);

  const active = watch("is_active");

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    const payload: PlanInput = { ...values, name: values.name.trim(), description: values.description.trim() };
    try {
      const saved = plan ? await updatePlan(plan.id, payload) : await createPlan(payload);
      toast.success(isEdit ? `Updated the ${saved.name} plan` : `Created the ${saved.name} plan`);
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
      title={isEdit ? `Edit ${plan?.name}` : "New membership plan"}
      description={
        isEdit
          ? "Changes apply to new memberships. Existing members keep the name and length they signed up with."
          : "Plans define how long a membership lasts and what it costs."
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={FORM_ID} loading={isSubmitting}>
            {isEdit ? "Save changes" : "Create plan"}
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
        <Field label="Plan name" htmlFor="pf-name" required error={errors.name?.message} className="sm:col-span-2">
          <Input id="pf-name" autoComplete="off" placeholder="e.g. Quarterly" invalid={!!errors.name} {...register("name")} />
        </Field>
        <Field label="Duration (days)" htmlFor="pf-days" required error={errors.duration_days?.message} hint="30 = one month, 365 = one year">
          <Input id="pf-days" type="number" inputMode="numeric" placeholder="e.g. 90" invalid={!!errors.duration_days} {...register("duration_days", { valueAsNumber: true })} />
        </Field>
        <Field label="Price (₹)" htmlFor="pf-price" required error={errors.price?.message}>
          <Input id="pf-price" type="number" inputMode="decimal" step="0.01" placeholder="e.g. 4000" invalid={!!errors.price} {...register("price", { valueAsNumber: true })} />
        </Field>
        <Field label="Description" htmlFor="pf-desc" error={errors.description?.message} className="sm:col-span-2">
          <Textarea id="pf-desc" placeholder="What does this plan include?" invalid={!!errors.description} {...register("description")} />
        </Field>
        <div className="flex items-center justify-between gap-4 rounded-lg border border-line bg-base px-4 py-3 sm:col-span-2">
          <div>
            <p className="text-sm font-medium">Active</p>
            <p className="text-meta text-muted">Inactive plans stay on existing members but can’t be assigned to new ones.</p>
          </div>
          <Switch label="Plan is active" checked={active} onChange={(v) => setValue("is_active", v, { shouldDirty: true })} />
        </div>
      </form>
    </Modal>
  );
}
