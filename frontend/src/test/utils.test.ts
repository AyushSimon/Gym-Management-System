import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";
import { cleanParams, getErrorMessage, getFieldErrors } from "@/services/api";
import { addDays, computeEndDate, daysBetween, expiryLabel, formatCurrency, formatDate, initials, isValidISODate } from "@/utils/format";
import { memberSchema, paymentSchema, planSchema } from "@/utils/schemas";

describe("date helpers", () => {
  it("treats an end date as inclusive, like the backend", () => {
    expect(computeEndDate("2026-01-01", 30)).toBe("2026-01-30");
    expect(computeEndDate("2026-01-01", 1)).toBe("2026-01-01");
    expect(computeEndDate("2026-02-01", 28)).toBe("2026-02-28");
  });

  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("counts days between dates", () => {
    expect(daysBetween("2026-01-01", "2026-01-31")).toBe(30);
  });

  it("validates ISO dates strictly", () => {
    expect(isValidISODate("2026-02-30")).toBe(false);
    expect(isValidISODate("2026-2-3")).toBe(false);
    expect(isValidISODate("2026-02-28")).toBe(true);
  });

  it("formats dates without a timezone shift", () => {
    expect(formatDate("2026-03-05")).toBe("05 Mar 2026");
    expect(formatDate(null)).toBe("—");
  });
});

describe("display helpers", () => {
  it("formats rupees", () => {
    expect(formatCurrency(1500)).toBe("₹1,500");
    expect(formatCurrency(1234567)).toBe("₹12,34,567");
    expect(formatCurrency(99.5)).toBe("₹99.50");
  });

  it("builds initials", () => {
    expect(initials("Aarav Sharma")).toBe("AS");
    expect(initials("Meera")).toBe("M");
  });

  it("describes how long a membership has left", () => {
    expect(expiryLabel({ status: "active", days_remaining: 0, start_date: "2026-01-01" })).toBe("Expires today");
    expect(expiryLabel({ status: "active", days_remaining: 1, start_date: "2026-01-01" })).toBe("1 day left");
    expect(expiryLabel({ status: "expired", days_remaining: -3, start_date: "2026-01-01" })).toBe("Expired 3 days ago");
  });
});

describe("API helpers", () => {
  it("drops empty query parameters", () => {
    expect(cleanParams({ q: "", status: "active", page: 1, expiring: false, plan: undefined })).toEqual({ status: "active", page: 1 });
  });

  it("turns server and network failures into readable messages", () => {
    const network = new AxiosError("Network Error", "ERR_NETWORK");
    expect(getErrorMessage(network)).toMatch(/can't reach the server/i);

    const withDetail = new AxiosError("x", "ERR_BAD_REQUEST", undefined, undefined, {
      status: 409,
      data: { detail: "Plan is assigned to 2 members." },
    } as never);
    expect(getErrorMessage(withDetail)).toBe("Plan is assigned to 2 members.");

    const server = new AxiosError("x", "ERR_BAD_RESPONSE", undefined, undefined, { status: 500, data: {} } as never);
    expect(getErrorMessage(server)).not.toMatch(/traceback|exception/i);
  });

  it("extracts field errors", () => {
    const err = new AxiosError("x", "ERR", undefined, undefined, { status: 422, data: { errors: [{ field: "phone", message: "bad" }, { field: "", message: "skip" }] } } as never);
    expect(getFieldErrors(err)).toEqual([{ field: "phone", message: "bad" }]);
  });
});

describe("form schemas", () => {
  const validMember = { full_name: "Aarav Sharma", age: 27, phone: "98765 43210", plan_id: "PLN-001", start_date: "2026-01-01", payment_status: "paid" as const };

  it("accepts a valid member", () => {
    expect(memberSchema.safeParse(validMember).success).toBe(true);
  });

  it.each([
    ["short name", { full_name: "A" }],
    ["digits in name", { full_name: "Aarav 99" }],
    ["under-age", { age: 8 }],
    ["fractional age", { age: 20.5 }],
    ["short phone", { phone: "12345" }],
    ["no plan", { plan_id: "" }],
    ["impossible date", { start_date: "2026-02-31" }],
    ["end before start", { end_date: "2025-12-31" }],
  ])("rejects %s", (_label, patch) => {
    expect(memberSchema.safeParse({ ...validMember, ...patch }).success).toBe(false);
  });

  it("validates plans", () => {
    const ok = { name: "Annual", duration_days: 365, price: 12000, description: "", is_active: true };
    expect(planSchema.safeParse(ok).success).toBe(true);
    expect(planSchema.safeParse({ ...ok, duration_days: 0 }).success).toBe(false);
    expect(planSchema.safeParse({ ...ok, price: -1 }).success).toBe(false);
  });

  it("validates payments", () => {
    const ok = { member_id: "M-0001", amount: 100, payment_date: "2026-01-01", method: "upi" as const, status: "paid" as const, notes: "" };
    expect(paymentSchema.safeParse(ok).success).toBe(true);
    expect(paymentSchema.safeParse({ ...ok, amount: 0 }).success).toBe(false);
    expect(paymentSchema.safeParse({ ...ok, member_id: "" }).success).toBe(false);
    expect(paymentSchema.safeParse({ ...ok, payment_date: "2999-01-01" }).success).toBe(false);
  });
});
