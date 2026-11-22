import type { DashboardStats, DistributionItem, GrowthPoint, Member, Payment } from "@/types";
import { api } from "./api";

export const getDashboardStats = (signal?: AbortSignal) =>
  api.get<DashboardStats>("/dashboard/stats", { signal }).then((r) => r.data);

export const getRecentMembers = (limit = 5, signal?: AbortSignal) =>
  api.get<Member[]>("/dashboard/recent-members", { params: { limit }, signal }).then((r) => r.data);

export const getRecentPayments = (limit = 5, signal?: AbortSignal) =>
  api.get<Payment[]>("/dashboard/recent-payments", { params: { limit }, signal }).then((r) => r.data);

export const getMembershipDistribution = (signal?: AbortSignal) =>
  api.get<DistributionItem[]>("/dashboard/membership-distribution", { signal }).then((r) => r.data);

export const getMembershipGrowth = (months = 6, signal?: AbortSignal) =>
  api.get<GrowthPoint[]>("/dashboard/membership-growth", { params: { months }, signal }).then((r) => r.data);

export const getExpiringMemberships = (limit = 8, signal?: AbortSignal) =>
  api.get<Member[]>("/dashboard/expiring-memberships", { params: { limit }, signal }).then((r) => r.data);