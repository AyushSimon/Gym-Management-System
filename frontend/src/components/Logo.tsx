import { cn } from "@/utils/format";

/** The Forma mark: a stylised dumbbell, drawn to match public/favicon.svg. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-line bg-surface", className)}
    >
      <svg viewBox="0 0 32 32" fill="none" className="h-[22px] w-[22px]">
        <path
          d="M9 12v8M12.5 10v12M23 12v8M19.5 10v12M12.5 16h7"
          stroke="rgb(var(--c-accent))"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export function Logo({ showText = true, className }: { showText?: boolean; className?: string }) {
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <LogoMark />
      {showText && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-[1.125rem] font-bold tracking-tight">Forma</span>
          <span className="mt-1 text-[0.625rem] font-medium uppercase tracking-[0.18em] text-muted">Gym Management</span>
        </span>
      )}
    </span>
  );
}
