import type { SystemInfo } from "@/types";
import { api } from "./api";

export const getSystemInfo = (signal?: AbortSignal) =>
  api.get<SystemInfo>("/system/info", { signal }).then((r) => r.data);

export const checkHealth = (signal?: AbortSignal) =>
  api.get<{ status: string }>("/health", { signal }).then((r) => r.data);

/** Returns the full JSON export as a Blob together with the server-suggested file name. */
export async function exportData(): Promise<{ blob: Blob; filename: string }> {
  const res = await api.get("/system/export", { responseType: "blob" });
  const disposition = String(res.headers["content-disposition"] ?? "");
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  return { blob: res.data as Blob, filename: match?.[1] ?? "gym-export.json" };
}