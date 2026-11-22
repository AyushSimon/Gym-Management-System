import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { api, retryConfig } from "@/services/api";
import type { Member, Payment, Plan } from "@/types";
import { computeEndDate, daysBetween, todayISO } from "@/utils/format";

/**
 * A tiny in-memory stand-in for the FastAPI backend, installed as the Axios adapter.
 * Tests therefore run the real services, hooks, forms and pages; only the network is faked.
 */

export const makePlan = (over: Partial<Plan> = {}): Plan => ({
  id: "PLN-001",
  name: "Monthly",
  duration_days: 30,
  price: 1500,
  description: "Full access for a month.",
  is_active: true,
  created_at: "2026-01-01T10:00:00+00:00",
  member_count: 0,
  ...over,
});

export const makeMember = (over: Partial<Member> = {}): Member => ({
  id: "M-0001",
  full_name: "Aarav Sharma",
  age: 27,
  phone: "9876500011",
  plan_id: "PLN-001",
  plan_name: "Monthly",
  plan_duration_days: 30,
  start_date: "2026-01-01",
  end_date: "2999-01-30",
  status: "active",
  days_remaining: 20,
  expiring_soon: false,
  payment_status: "paid",
  created_at: "2026-01-02T10:00:00+00:00",
  history: [],
  ...over,
});

export const makePayment = (over: Partial<Payment> = {}): Payment => ({
  id: "PAY-0001",
  member_id: "M-0001",
  member_name: "Aarav Sharma",
  amount: 1500,
  payment_date: "2026-01-05",
  method: "upi",
  status: "paid",
  notes: "",
  created_at: "2026-01-05T10:00:00+00:00",
  ...over,
});

export interface FakeDb {
  plans: Plan[];
  members: Member[];
  payments: Payment[];
}

interface Rule {
  method: string;
  urlIncludes: string;
  status?: number;
  detail?: string;
  network?: boolean;
  once: boolean;
}

const pad = (n: number, w: number) => String(n).padStart(w, "0");
const nextId = (prefix: string, w: number, ids: string[]) => `${prefix}${pad(Math.max(0, ...ids.map((i) => Number(i.replace(/\D/g, "")))) + 1, w)}`;

function page<T>(items: T[], params: Record<string, unknown>) {
  const size = Number(params.page_size ?? 10);
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(Number(params.page ?? 1), 1), pages);
  return { items: items.slice((current - 1) * size, current * size), total: items.length, page: current, page_size: size, pages };
}

function sortBy<T>(items: T[], params: Record<string, unknown>, fallback: string) {
  const key = String(params.sort_by ?? fallback) as keyof T;
  const dir = params.sort_order === "asc" ? 1 : -1;
  return [...items].sort((a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * dir);
}

export function installFakeServer(seed: Partial<FakeDb> = {}) {
  retryConfig.retries = 0; // no back-off delays in tests
  const db: FakeDb = { plans: seed.plans ?? [], members: seed.members ?? [], payments: seed.payments ?? [] };
  const rules: Rule[] = [];
  const calls: { method: string; url: string }[] = [];

  const withCounts = (p: Plan): Plan => ({ ...p, member_count: db.members.filter((m) => m.plan_id === p.id).length });

  function route(method: string, path: string, params: Record<string, unknown>, body: any): { status: number; data?: unknown } {
    const seg = path.split("/").filter(Boolean);
    const [root, a, b] = seg;
    const ok = (data: unknown, status = 200) => ({ status, data });
    const err = (status: number, detail: string) => ({ status, data: { detail } });

    if (root === "health") return ok({ status: "ok" });
    if (root === "system" && a === "info")
      return ok({ app_name: "Gym API", version: "1.0.0", data_dir: "C:\\data", expiry_warning_days: 7, counts: { members: db.members.length, plans: db.plans.length, payments: db.payments.length } });

    // ------------------------------------------------------------- dashboard
    if (root === "dashboard") {
      const pending = db.payments.filter((p) => p.status === "pending");
      if (a === "stats")
        return ok({
          total_members: db.members.length,
          active_members: db.members.filter((m) => m.status === "active").length,
          expired_members: db.members.filter((m) => m.status === "expired").length,
          upcoming_members: db.members.filter((m) => m.status === "upcoming").length,
          expiring_soon: db.members.filter((m) => m.expiring_soon).length,
          members_with_pending_payment: db.members.filter((m) => m.payment_status === "pending").length,
          pending_payments: pending.length,
          pending_amount: pending.reduce((s, p) => s + p.amount, 0),
          total_collected: db.payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0),
          total_plans: db.plans.length,
        });
      if (a === "recent-members") return ok([...db.members].reverse().slice(0, Number(params.limit ?? 5)));
      if (a === "recent-payments") return ok([...db.payments].reverse().slice(0, Number(params.limit ?? 5)));
      if (a === "membership-distribution") {
        const out = db.plans.map((p) => ({ plan_id: p.id, plan_name: p.name, count: db.members.filter((m) => m.plan_id === p.id).length })).filter((d) => d.count > 0);
        return ok(out);
      }
      if (a === "membership-growth") return ok([{ month: "2026-01", label: "Jan 26", new_members: db.members.length, total_members: db.members.length }]);
      if (a === "expiring-memberships") return ok(db.members.filter((m) => m.expiring_soon));
    }

    // ----------------------------------------------------------------- plans
    if (root === "memberships") {
      if (!a) {
        if (method === "get") {
          let list = db.plans.map(withCounts);
          if (params.q) list = list.filter((p) => p.name.toLowerCase().includes(String(params.q).toLowerCase()));
          if (params.active !== undefined) list = list.filter((p) => p.is_active === (String(params.active) === "true"));
          return ok(list);
        }
        const plan: Plan = { ...body, id: nextId("PLN-", 3, db.plans.map((p) => p.id)), created_at: new Date().toISOString(), member_count: 0 };
        db.plans.push(plan);
        return ok(plan, 201);
      }
      const plan = db.plans.find((p) => p.id === a);
      if (!plan) return err(404, `Membership plan '${a}' not found`);
      if (method === "get") return ok(withCounts(plan));
      if (method === "put") {
        Object.assign(plan, body);
        return ok(withCounts(plan));
      }
      if (method === "delete") {
        const used = db.members.filter((m) => m.plan_id === a).length;
        if (used) return err(409, `Plan is assigned to ${used} member${used === 1 ? "" : "s"}.`);
        db.plans = db.plans.filter((p) => p.id !== a);
        return ok(null, 204);
      }
    }

    // --------------------------------------------------------------- members
    if (root === "members") {
      const build = (input: any, existing?: Member): Member | { error: string } => {
        const plan = db.plans.find((p) => p.id === input.plan_id);
        if (!plan) return { error: "Selected plan does not exist" };
        const end = input.end_date || computeEndDate(input.start_date, plan.duration_days);
        const today = todayISO();
        const status = today < input.start_date ? "upcoming" : today > end ? "expired" : "active";
        const remaining = daysBetween(today, end);
        return {
          ...(existing ?? makeMember({ history: [] })),
          ...input,
          end_date: end,
          plan_name: plan.name,
          plan_duration_days: plan.duration_days,
          status,
          days_remaining: remaining,
          expiring_soon: status === "active" && remaining <= 7,
        };
      };

      if (a === "search") {
        const needle = String(params.q ?? "").toLowerCase();
        return ok(db.members.filter((m) => [m.id, m.full_name, m.phone].some((v) => v.toLowerCase().includes(needle))).slice(0, Number(params.limit ?? 20)));
      }
      if (!a) {
        if (method === "get") {
          let list = db.members;
          const needle = String(params.q ?? "").toLowerCase();
          if (needle) list = list.filter((m) => [m.id, m.full_name, m.phone].some((v) => v.toLowerCase().includes(needle)));
          if (params.status) list = list.filter((m) => m.status === params.status);
          if (params.expiring) list = list.filter((m) => m.expiring_soon);
          if (params.payment_status) list = list.filter((m) => m.payment_status === params.payment_status);
          if (params.plan_id) list = list.filter((m) => m.plan_id === params.plan_id);
          return ok(page(sortBy(list, params, "created_at"), params));
        }
        if (db.members.some((m) => m.phone === body.phone)) return err(409, "A member with this phone number already exists");
        const built = build(body);
        if ("error" in built) return err(422, built.error);
        const member = { ...built, id: nextId("M-", 4, db.members.map((m) => m.id)), created_at: new Date().toISOString() };
        db.members.push(member);
        return ok(member, 201);
      }
      const member = db.members.find((m) => m.id === a);
      if (!member) return err(404, `Member '${a}' not found`);
      if (b === "renew") {
        const plan = db.plans.find((p) => p.id === (body?.plan_id ?? member.plan_id))!;
        const start = body?.start_date || todayISO();
        const built = build({ ...member, plan_id: plan.id, start_date: start, end_date: undefined, payment_status: "pending" }, member) as Member;
        Object.assign(member, built, { history: [...member.history, { plan_id: member.plan_id, plan_name: member.plan_name, start_date: member.start_date, end_date: member.end_date }] });
        return ok(member);
      }
      if (method === "get") return ok(member);
      if (method === "put") {
        const built = build(body, member);
        if ("error" in built) return err(422, built.error);
        Object.assign(member, built);
        return ok(member);
      }
      if (method === "delete") {
        db.members = db.members.filter((m) => m.id !== a);
        return ok(null, 204);
      }
    }

    // -------------------------------------------------------------- payments
    if (root === "payments") {
      if (a === "summary") {
        const paid = db.payments.filter((p) => p.status === "paid");
        const pend = db.payments.filter((p) => p.status === "pending");
        return ok({
          total_recorded: db.payments.length,
          total_paid_amount: paid.reduce((s, p) => s + p.amount, 0),
          pending_count: pend.length,
          pending_amount: pend.reduce((s, p) => s + p.amount, 0),
          failed_count: db.payments.filter((p) => p.status === "failed").length,
          paid_this_month: 0,
        });
      }
      if (a === "member") {
        const member = db.members.find((m) => m.id === b);
        if (!member) return err(404, `Member '${b}' not found`);
        const items = db.payments.filter((p) => p.member_id === b);
        return ok({
          member_id: b,
          member_name: member.full_name,
          items,
          total_paid: items.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0),
          total_pending: items.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0),
        });
      }
      if (!a) {
        if (method === "get") {
          let list = db.payments;
          const needle = String(params.q ?? "").toLowerCase();
          if (needle) list = list.filter((p) => [p.id, p.member_id, p.member_name, p.notes].some((v) => v.toLowerCase().includes(needle)));
          if (params.status) list = list.filter((p) => p.status === params.status);
          if (params.method) list = list.filter((p) => p.method === params.method);
          if (params.member_id) list = list.filter((p) => p.member_id === params.member_id);
          return ok(page(sortBy(list, params, "payment_date"), params));
        }
        const member = db.members.find((m) => m.id === body.member_id);
        if (!member) return err(422, `member_id: Member '${body.member_id}' does not exist`);
        const payment: Payment = { ...body, id: nextId("PAY-", 4, db.payments.map((p) => p.id)), member_name: member.full_name, created_at: new Date().toISOString() };
        db.payments.push(payment);
        return ok(payment, 201);
      }
      const payment = db.payments.find((p) => p.id === a);
      if (!payment) return err(404, `Payment '${a}' not found`);
      if (method === "get") return ok(payment);
      if (method === "put") {
        Object.assign(payment, body);
        return ok(payment);
      }
      if (method === "delete") {
        db.payments = db.payments.filter((p) => p.id !== a);
        return ok(null, 204);
      }
    }
    return err(404, `No fake route for ${method.toUpperCase()} ${path}`);
  }

  api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    const method = (config.method ?? "get").toLowerCase();
    const url = String(config.url ?? "");
    calls.push({ method, url });

    const ruleIndex = rules.findIndex((r) => r.method === method && url.includes(r.urlIncludes));
    if (ruleIndex >= 0) {
      const rule = rules[ruleIndex];
      if (rule.once) rules.splice(ruleIndex, 1);
      if (rule.network) throw new AxiosError("Network Error", "ERR_NETWORK", config);
      const response = { data: { detail: rule.detail }, status: rule.status ?? 500, statusText: "Error", headers: {}, config } as AxiosResponse;
      throw new AxiosError(rule.detail ?? "Error", "ERR_BAD_RESPONSE", config, {}, response);
    }

    const body = typeof config.data === "string" && config.data ? JSON.parse(config.data) : config.data;
    const result = route(method, url, (config.params ?? {}) as Record<string, unknown>, body);
    const response = { data: result.data, status: result.status, statusText: "OK", headers: {}, config, request: {} } as AxiosResponse;
    if (result.status >= 400) throw new AxiosError(String((result.data as { detail?: string })?.detail), "ERR_BAD_REQUEST", config, {}, response);
    return response;
  };

  return {
    db,
    calls,
    /** Make matching requests fail. Pass `once: false` to keep failing until `clearFailures()`. */
    fail(method: string, urlIncludes: string, opts: { status?: number; detail?: string; network?: boolean; once?: boolean } = {}) {
      rules.push({ method: method.toLowerCase(), urlIncludes, once: opts.once ?? true, status: opts.status, detail: opts.detail, network: opts.network });
    },
    clearFailures() {
      rules.length = 0;
    },
  };
}
