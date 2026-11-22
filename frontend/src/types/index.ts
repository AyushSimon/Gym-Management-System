export type MembershipStatus = "active" | "expired" | "upcoming";
export type MemberPaymentStatus = "paid" | "pending";
export type PaymentMethod = "cash" | "upi" | "card" | "bank_transfer" | "other";
export type PaymentStatus = "paid" | "pending" | "failed";

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface MembershipPeriod {
  plan_id: string;
  plan_name: string;
  start_date: string;
  end_date: string;
}

export interface Member {
  id: string;
  full_name: string;
  age: number;
  phone: string;
  plan_id: string;
  plan_name: string;
  plan_duration_days: number;
  start_date: string;
  end_date: string;
  status: MembershipStatus;
  days_remaining: number;
  expiring_soon: boolean;
  payment_status: MemberPaymentStatus;
  created_at: string;
  history: MembershipPeriod[];
}

export interface MemberInput {
  full_name: string;
  age: number;
  phone: string;
  plan_id: string;
  start_date: string;
  end_date?: string | null;
  payment_status: MemberPaymentStatus;
}

export interface RenewInput {
  plan_id?: string | null;
  start_date?: string | null;
}

export interface MemberQuery {
  q?: string;
  status?: MembershipStatus | "";
  payment_status?: MemberPaymentStatus | "";
  plan_id?: string;
  expiring?: boolean;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  page?: number;
  page_size?: number;
}

export interface Plan {
  id: string;
  name: string;
  duration_days: number;
  price: number;
  description: string;
  is_active: boolean;
  created_at: string;
  member_count: number;
}

export interface PlanInput {
  name: string;
  duration_days: number;
  price: number;
  description: string;
  is_active: boolean;
}

export interface Payment {
  id: string;
  member_id: string;
  member_name: string;
  amount: number;
  payment_date: string;
  method: PaymentMethod;
  status: PaymentStatus;
  notes: string;
  created_at: string;
}

export interface PaymentInput {
  member_id: string;
  amount: number;
  payment_date: string;
  method: PaymentMethod;
  status: PaymentStatus;
  notes: string;
}

export interface PaymentQuery {
  q?: string;
  status?: PaymentStatus | "";
  method?: PaymentMethod | "";
  member_id?: string;
  date_from?: string;
  date_to?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  page?: number;
  page_size?: number;
}

export interface PaymentSummary {
  total_recorded: number;
  total_paid_amount: number;
  pending_count: number;
  pending_amount: number;
  failed_count: number;
  paid_this_month: number;
}

export interface MemberPaymentHistory {
  member_id: string;
  member_name: string;
  items: Payment[];
  total_paid: number;
  total_pending: number;
}

export interface DashboardStats {
  total_members: number;
  active_members: number;
  expired_members: number;
  upcoming_members: number;
  expiring_soon: number;
  members_with_pending_payment: number;
  pending_payments: number;
  pending_amount: number;
  total_collected: number;
  total_plans: number;
}

export interface DistributionItem {
  plan_id: string;
  plan_name: string;
  count: number;
}

export interface GrowthPoint {
  month: string;
  label: string;
  new_members: number;
  total_members: number;
}

export interface SystemInfo {
  app_name: string;
  version: string;
  data_dir: string;
  expiry_warning_days: number;
  counts: { members: number; plans: number; payments: number };
}

export type SortOrder = "asc" | "desc";
export interface SortState {
  key: string;
  order: SortOrder;
}