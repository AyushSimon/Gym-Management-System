import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { SortState } from "@/types";
import { cn } from "@/utils/format";

export function nextSort(current: SortState, key: string, defaultOrder: "asc" | "desc" = "asc"): SortState {
  if (current.key !== key) return { key, order: defaultOrder };
  return { key, order: current.order === "asc" ? "desc" : "asc" };
}

interface ThProps {
  label: string;
  sortKey?: string;
  sort?: SortState;
  onSort?: (key: string) => void;
  className?: string;
  align?: "left" | "right";
}

export function Th({ label, sortKey, sort, onSort, className, align = "left" }: ThProps) {
  const active = sortKey && sort?.key === sortKey;
  const Icon = !active ? ChevronsUpDown : sort.order === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.order === "asc" ? "ascending" : "descending") : undefined}
      className={cn("whitespace-nowrap px-4 py-3 text-meta font-medium uppercase tracking-wider text-muted", align === "right" ? "text-right" : "text-left", className)}
    >
      {sortKey && onSort ? (
        <button
          type="button"
          onClick={() => onSort(sortKey)}
          className={cn("inline-flex items-center gap-1.5 uppercase transition-colors hover:text-fg", active && "text-fg")}
        >
          {label}
          <Icon className={cn("h-3 w-3", !active && "opacity-50")} aria-hidden />
        </button>
      ) : (
        label
      )}
    </th>
  );
}