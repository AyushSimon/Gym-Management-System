import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { getFieldErrors } from "@/services/api";

/**
 * Attach field-level errors returned by the API to the matching form fields.
 * Returns true when at least one error was attached.
 */
export function applyServerErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, fields: readonly string[]): boolean {
  let applied = false;
  for (const item of getFieldErrors(error)) {
    const name = item.field.split(".")[0];
    if (fields.includes(name)) {
      setError(name as Path<T>, { type: "server", message: item.message });
      applied = true;
    }
  }
  return applied;
}