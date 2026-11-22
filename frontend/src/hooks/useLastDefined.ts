import { useRef } from "react";

/** Returns the latest non-null value, so exit animations can keep rendering the content that just closed. */
export function useLastDefined<T>(value: T | null | undefined): T | null {
  const last = useRef<T | null>(null);
  if (value) last.current = value;
  return value ?? last.current;
}