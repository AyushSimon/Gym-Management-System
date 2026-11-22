import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/utils/format";
import { Button } from "./Button";

function pageList(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, 2, pages - 1, pages, page - 1, page, page + 1]);
  const sorted = [...set].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push("…");
    out.push(n);
  });
  return out;
}

interface Props {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
  noun?: string;
}

export function Pagination({ page, pages, total, pageSize, onPage, noun = "records" }: Props) {
  if (total === 0) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <nav aria-label="Pagination" className="flex flex-col items-center justify-between gap-3 border-t border-line px-4 py-3 sm:flex-row">
      <p className="text-label text-fg2">
        Showing <span className="num text-fg">{start}–{end}</span> of <span className="num text-fg">{total}</span> {noun}
      </p>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pageList(page, pages).map((n, i) =>
          n === "…" ? (
            <span key={`gap-${i}`} className="px-1.5 text-muted" aria-hidden>
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              aria-label={`Page ${n}`}
              aria-current={n === page ? "page" : undefined}
              onClick={() => onPage(n)}
              className={cn(
                "num h-8 min-w-8 rounded-lg px-2 text-label transition-colors",
                n === page ? "bg-accent/15 text-accent" : "text-fg2 hover:bg-elevated hover:text-fg",
              )}
            >
              {n}
            </button>
          ),
        )}
        <Button variant="ghost" size="icon" aria-label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}