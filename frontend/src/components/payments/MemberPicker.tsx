import { Check, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { controlClass } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { useApi } from "@/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";
import { listMembers, searchMembers } from "@/services/members";
import type { Member } from "@/types";
import { cn } from "@/utils/format";

export type PickedMember = Pick<Member, "id" | "full_name" | "plan_id">;

interface Props {
  id: string;
  selected: PickedMember | null;
  onSelect: (member: PickedMember) => void;
  invalid?: boolean;
  disabled?: boolean;
}

/** Searchable member selector. Results come from the backend search endpoint, so it scales past one page of members. */
export function MemberPicker({ id, selected, onSelect, invalid, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const debounced = useDebounce(query.trim(), 250);
  const wrapper = useRef<HTMLDivElement>(null);
  const listId = useId();

  const { data, loading } = useApi<Member[]>(
    (signal) => {
      if (!open) return Promise.resolve([]);
      if (debounced) return searchMembers(debounced, 6, signal);
      return listMembers({ page_size: 6, sort_by: "full_name", sort_order: "asc" }, signal).then((page) => page.items);
    },
    [open, debounced],
  );
  const results = data ?? [];

  useEffect(() => setActive(0), [debounced, open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const choose = (member: Member) => {
    onSelect({ id: member.id, full_name: member.full_name, plan_id: member.plan_id });
    setOpen(false);
    setQuery("");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open && results[active]) {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === "Escape" && open) {
      e.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div ref={wrapper} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        autoComplete="off"
        disabled={disabled}
        placeholder="Search by name, ID or phone…"
        value={open ? query : selected ? `${selected.full_name} · ${selected.id}` : ""}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setOpen(true);
          setQuery(e.target.value);
        }}
        onKeyDown={onKeyDown}
        className={cn(controlClass, "h-10 pl-9", invalid && "border-err/60")}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1.5 max-h-72 w-full overflow-y-auto rounded-xl border border-line bg-elevated p-1.5 shadow-pop"
        >
          {loading && !data ? (
            <li className="space-y-2 p-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </li>
          ) : results.length === 0 ? (
            <li className="px-3 py-4 text-center text-label text-fg2">No members found.</li>
          ) : (
            results.map((m, i) => (
              <li
                key={m.id}
                role="option"
                aria-selected={selected?.id === m.id}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(m)}
                className={cn("flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2", i === active && "bg-surface")}
              >
                <Avatar name={m.full_name} className="h-8 w-8" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{m.full_name}</p>
                  <p className="num text-meta text-muted">
                    {m.id} · {m.phone}
                  </p>
                </div>
                {selected?.id === m.id && <Check className="h-4 w-4 text-accent" aria-hidden />}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
