import type { Member, MemberInput, MemberQuery, Page, RenewInput } from "@/types";
import { api, cleanParams } from "./api";

export const listMembers = (query: MemberQuery, signal?: AbortSignal) =>
  api.get<Page<Member>>("/members", { params: cleanParams(query), signal }).then((r) => r.data);

export const searchMembers = (q: string, limit = 8, signal?: AbortSignal) =>
  api.get<Member[]>("/members/search", { params: { q, limit }, signal }).then((r) => r.data);

export const getMember = (id: string, signal?: AbortSignal) =>
  api.get<Member>(`/members/${encodeURIComponent(id)}`, { signal }).then((r) => r.data);

export const createMember = (input: MemberInput) => api.post<Member>("/members", input).then((r) => r.data);

export const updateMember = (id: string, input: MemberInput) =>
  api.put<Member>(`/members/${encodeURIComponent(id)}`, input).then((r) => r.data);

export const renewMember = (id: string, input: RenewInput) =>
  api.post<Member>(`/members/${encodeURIComponent(id)}/renew`, input).then((r) => r.data);

export const deleteMember = (id: string) => api.delete(`/members/${encodeURIComponent(id)}`).then(() => undefined);