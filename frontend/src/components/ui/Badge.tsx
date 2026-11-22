import type { ReactNode } from "react";
import type { MembershipStatus, PaymentStatus } from "@/types";
import { cn } from "@/utils/format";

export type Tone = "ok" | "warn" | "err" | "info" | "neutral";

const TONES: Record<Tone, string> = {
  ok: "bg-ok/10 text-ok",
  warn: "bg-warn/10 text-warn",
  err: "bg-err/10 text-err",
  info: "bg-accent2/10 text-accent2",
  neutral: "bg-elevated text-fg2",
};

export function Badge({ tone = "neutral", dot = true, children }: { tone?: Tone; dot?: boolean; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-meta font-medium", TONES[tone])}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

export function MemberStatusBadge({ status, expiringSoon }: { status: MembershipStatus; expiringSoon?: boolean }) {
  if (status === "active" && expiringSoon) return <Badge tone="warn">Expiring soon</Badge>;
  if (status === "active") return <Badge tone="ok">Active</Badge>;
  if (status === "expired") return <Badge tone="err">Expired</Badge>;
  return <Badge tone="info">Upcoming</Badge>;
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  if (status === "paid") return <Badge tone="ok">Paid</Badge>;
  if (status === "pending") return <Badge tone="warn">Pending</Badge>;
  return <Badge tone="err">Failed</Badge>;
}