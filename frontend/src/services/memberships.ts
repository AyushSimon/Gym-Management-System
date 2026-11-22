import type { Plan, PlanInput } from "@/types";
import { api, cleanParams } from "./api";

export const listPlans = (params: { q?: string; active?: boolean } = {}, signal?: AbortSignal) =>
  api
    .get<Plan[]>("/memberships", {
      params: { ...cleanParams({ q: params.q }), ...(params.active === undefined ? {} : { active: params.active }) },
      signal,
    })
    .then((r) => r.data);

export const getPlan = (id: string, signal?: AbortSignal) =>
  api.get<Plan>(`/memberships/${encodeURIComponent(id)}`, { signal }).then((r) => r.data);

export const createPlan = (input: PlanInput) => api.post<Plan>("/memberships", input).then((r) => r.data);

export const updatePlan = (id: string, input: PlanInput) =>
  api.put<Plan>(`/memberships/${encodeURIComponent(id)}`, input).then((r) => r.data);

export const deletePlan = (id: string) => api.delete(`/memberships/${encodeURIComponent(id)}`).then(() => undefined);