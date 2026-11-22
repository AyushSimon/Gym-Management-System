import type { MemberPaymentHistory, Page, Payment, PaymentInput, PaymentQuery, PaymentSummary } from "@/types";
import { api, cleanParams } from "./api";

export const listPayments = (query: PaymentQuery, signal?: AbortSignal) =>
  api.get<Page<Payment>>("/payments", { params: cleanParams(query), signal }).then((r) => r.data);

export const getPaymentSummary = (signal?: AbortSignal) =>
  api.get<PaymentSummary>("/payments/summary", { signal }).then((r) => r.data);

export const getPayment = (id: string, signal?: AbortSignal) =>
  api.get<Payment>(`/payments/${encodeURIComponent(id)}`, { signal }).then((r) => r.data);

export const getMemberPayments = (memberId: string, signal?: AbortSignal) =>
  api.get<MemberPaymentHistory>(`/payments/member/${encodeURIComponent(memberId)}`, { signal }).then((r) => r.data);

export const createPayment = (input: PaymentInput) => api.post<Payment>("/payments", input).then((r) => r.data);

export const updatePayment = (id: string, input: PaymentInput) =>
  api.put<Payment>(`/payments/${encodeURIComponent(id)}`, input).then((r) => r.data);

export const deletePayment = (id: string) => api.delete(`/payments/${encodeURIComponent(id)}`).then(() => undefined);