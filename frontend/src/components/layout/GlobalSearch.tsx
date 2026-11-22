import { Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar } from "@/components/ui/Avatar";
import { MemberStatusBadge } from "@/components/ui/Badge";
import { controlClass } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { useApi } from "@/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";
import { searchMembers } from "@/services/members";
import type { Member } from "@/types";
import { cn } from "@/utils/format";

interface Props {
  className?: string;
  autoFocus?: boolean;
  /** Called after the user picks a result or submits, e.g. to close a mobile search bar. */
  onDone?: () => void;
}

/** Header search. Looks members up on the server by ID, name or phone number. */
export function GlobalSearch({ className, autoFocus, onDone }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const debounced = useDebounce(query.trim(), 250);
  const input = useRef<HTMLInputElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const listId = useId();

  const { data, loading } = useApi<Member[]>(
    (signal) => (open && debounced ? searchMembers(debounced, 6, signal) : Promise.resolve([])),
    [open, debounced],
  );
  const results = debounced ? (data ?? []) : [];

  useEffect(() => setActive(-1), [debounced]);

  // "/" or Ctrl/Cmd+K focuses the search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
      if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const finish = () => {
    setOpen(false);
    setQuery("");
    input.current?.blur();
    onDone?.();
  };

  const openMember = (member: Member) => {
    navigate(`/members?view=${encodeURIComponent(member.id)}`);
    finish();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[active]) openMember(results[active]);
      else if (query.trim()) {
        navigate(`/members?q=${encodeURIComponent(query.trim())}`);
        finish();
      }
    } else if (e.key === "Escape") {
      if (open) {
        setOpen(false);
      } else {
        input.current?.blur();
        onDone?.();
      }
    }
  };

  const showPanel = open && debounced.length > 0;

  return (
    <div ref={wrapper} className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        ref={input}
        type="text"
        role="combobox"
        aria-label="Search members"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder="Search members by name, ID or phone…"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        className={cn(controlClass, "h-10 pl-9 pr-12")}
      />
      <kbd
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-line px-1.5 py-0.5 font-mono text-[0.6875rem] text-muted lg:block"
      >
        /
      </kbd>

      {showPanel && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 z-40 mt-1.5 max-h-80 overflow-y-auto rounded-xl border border-line bg-elevated p-1.5 shadow-pop">
          {loading && !data ? (
            <li className="space-y-2 p-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </li>
          ) : results.length === 0 ? (
            <li className="px-3 py-5 text-center text-label text-fg2">No members match “{debounced}”.</li>
          ) : (
            results.map((m, i) => (
              <li
                key={m.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => openMember(m)}
                className={cn("flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2", i === active && "bg-surface")}
              >
                <Avatar name={m.full_name} className="h-8 w-8" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{m.full_name}</p>
                  <p className="num truncate text-meta text-muted">
                    {m.id} · {m.phone}
                  </p>
                </div>
                <MemberStatusBadge status={m.status} expiringSoon={m.expiring_soon} />
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
