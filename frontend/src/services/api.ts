import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

/** Single place the backend URL is read from. Set VITE_API_BASE_URL in frontend/.env. */
export const API_BASE_URL: string = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 10_000,
  headers: { Accept: "application/json" },
});

/** Tunable so tests can disable the back-off delay. */
export const retryConfig = { retries: 2, baseDelayMs: 350 };

type RetryableConfig = InternalAxiosRequestConfig & { __retry?: number };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Read requests are retried on network failures and transient 502/503/504 responses.
api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const config = error.config as RetryableConfig | undefined;
  if (!config || axios.isCancel(error) || (config.method ?? "get").toLowerCase() !== "get") {
    return Promise.reject(error);
  }
  const status = error.response?.status;
  const transient = !error.response || status === 502 || status === 503 || status === 504;
  config.__retry = config.__retry ?? 0;
  if (!transient || config.__retry >= retryConfig.retries) return Promise.reject(error);
  config.__retry += 1;
  await wait(retryConfig.baseDelayMs * 2 ** (config.__retry - 1));
  return api.request(config);
});

export interface FieldError {
  field: string;
  message: string;
}

export function getErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (axios.isAxiosError(error)) {
    if (error.code === "ECONNABORTED") return "The server took too long to respond. Please try again.";
    if (!error.response) {
      return "Can't reach the server. Check that the backend is running and try again.";
    }
    const detail = (error.response.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === "string" && detail) return detail;
    if (error.response.status >= 500) return "The server ran into a problem. Please try again shortly.";
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function getFieldErrors(error: unknown): FieldError[] {
  if (!axios.isAxiosError(error)) return [];
  const errors = (error.response?.data as { errors?: FieldError[] } | undefined)?.errors;
  return Array.isArray(errors) ? errors.filter((e) => e.field) : [];
}

export const isCancelled = (error: unknown) => axios.isCancel(error);

/** Drop empty values so they are not sent as empty query parameters. */
export function cleanParams<T extends object>(params: T): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "" || value === false) continue;
    out[key] = value as string | number | boolean;
  }
  return out;
}