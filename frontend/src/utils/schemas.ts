import { z } from "zod";
import { addDays, isValidISODate, todayISO } from "./format";

/** Client-side validation. Mirrors the backend's Pydantic rules so users get instant feedback. */
const NAME_RE = /^[A-Za-z][A-Za-z .'\-]*$/;
const PHONE_RE = /^\+?\d{10,13}$/;
export const stripPhone = (value: string) => value.replace(/[\s\-()]/g, "");

const requiredDate = (message: string) => z.string().min(1, message).refine(isValidISODate, "Enter a valid date");

export const memberSchema = z
  .object({
    full_name: z
      .string()
      .trim()
      .min(2, "Enter at least 2 characters")
      .max(80, "Keep the name under 80 characters")
      .regex(NAME_RE, "Use letters, spaces, apostrophes, periods and hyphens only"),
    age: z
      .number({ required_error: "Enter the member’s age", invalid_type_error: "Enter the age" })
      .int("Age must be a whole number")
      .min(12, "Members must be at least 12")
      .max(100, "Enter an age of 100 or less"),
    phone: z
      .string()
      .trim()
      .min(1, "Enter a contact number")
      .refine((v) => PHONE_RE.test(stripPhone(v)), "Enter 10 to 13 digits (optional leading +)"),
    plan_id: z.string().min(1, "Choose a membership plan"),
    start_date: requiredDate("Choose a start date"),
    end_date: z.string().optional(),
    payment_status: z.enum(["paid", "pending"]),
  })
  .superRefine((v, ctx) => {
    if (isValidISODate(v.start_date)) {
      if (v.start_date < "2000-01-01") {
        ctx.addIssue({ code: "custom", path: ["start_date"], message: "Start date is too far in the past" });
      } else if (v.start_date > addDays(todayISO(), 365)) {
        ctx.addIssue({ code: "custom", path: ["start_date"], message: "Start date can be at most one year ahead" });
      }
    }
    if (v.end_date) {
      if (!isValidISODate(v.end_date)) {
        ctx.addIssue({ code: "custom", path: ["end_date"], message: "Enter a valid date" });
      } else if (isValidISODate(v.start_date) && v.end_date < v.start_date) {
        ctx.addIssue({ code: "custom", path: ["end_date"], message: "End date can’t be before the start date" });
      }
    }
  });
export type MemberFormValues = z.infer<typeof memberSchema>;

export const planSchema = z.object({
  name: z.string().trim().min(2, "Enter at least 2 characters").max(60, "Keep the name under 60 characters"),
  duration_days: z
    .number({ required_error: "Enter the duration", invalid_type_error: "Enter the duration in days" })
    .int("Use whole days")
    .min(1, "Duration must be at least 1 day")
    .max(3650, "Duration can’t exceed 3650 days"),
  price: z
    .number({ required_error: "Enter a price", invalid_type_error: "Enter a price" })
    .min(0, "Price can’t be negative")
    .max(1_000_000, "Price can’t exceed 10,00,000"),
  description: z.string().max(300, "Keep the description under 300 characters"),
  is_active: z.boolean(),
});
export type PlanFormValues = z.infer<typeof planSchema>;

export const paymentSchema = z.object({
  member_id: z.string().regex(/^M-\d{4,}$/, "Select a member"),
  amount: z
    .number({ required_error: "Enter the amount", invalid_type_error: "Enter the amount" })
    .gt(0, "Amount must be greater than 0")
    .max(10_000_000, "Amount is too large"),
  payment_date: requiredDate("Choose the payment date").refine((v) => v <= todayISO(), "Payment date can’t be in the future"),
  method: z.enum(["cash", "upi", "card", "bank_transfer", "other"]),
  status: z.enum(["paid", "pending", "failed"]),
  notes: z.string().max(300, "Keep notes under 300 characters"),
});
export type PaymentFormValues = z.infer<typeof paymentSchema>;

export const renewSchema = z.object({
  plan_id: z.string().min(1, "Choose a plan"),
  start_date: z.string().optional().refine((v) => !v || isValidISODate(v), "Enter a valid date"),
});
export type RenewFormValues = z.infer<typeof renewSchema>;