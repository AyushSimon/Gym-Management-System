import clsx from "clsx";
import type { Member, PaymentMethod } from "@/types";

export const cn = clsx;

const pad = (n: number) => String(n).padStart(2, "0");

/** Parse a YYYY-MM-DD string as a local date (avoids UTC off-by-one errors). */
export function parseISODate(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const todayISO = () => toISODate(new Date());

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** A membership is valid from start through end, inclusive (mirrors the backend rule). */
export function computeEndDate(startISO: string, durationDays: number): string {
  return addDays(startISO, durationDays - 1);
}

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return toISODate(parseISODate(value)) === value;
}

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  return dateFmt.format(parseISODate(value));
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : dateTimeFmt.format(d);
}

const inr0 = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });
const plain = new Intl.NumberFormat("en-IN");

export function formatCurrency(value: number): string {
  return Number.isInteger(value) ? inr0.format(value) : inr2.format(value);
}

export const formatNumber = (value: number) => plain.format(value);

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((parseISODate(toISO).getTime() - parseISODate(fromISO).getTime()) / 86_400_000);
}

export function expiryLabel(member: Pick<Member, "status" | "days_remaining" | "start_date">): string {
  if (member.status === "upcoming") {
    const until = daysBetween(todayISO(), member.start_date);
    return until <= 0 ? "Starts today" : `Starts in ${plural(until, "day")}`;
  }
  if (member.status === "expired") return `Expired ${plural(Math.abs(member.days_remaining), "day")} ago`;
  if (member.days_remaining === 0) return "Expires today";
  return `${plural(member.days_remaining, "day")} left`;
}

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  bank_transfer: "Bank transfer",
  other: "Other",
};

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}