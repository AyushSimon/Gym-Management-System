import { cn, initials } from "@/utils/format";

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-full bg-accent2/15 text-meta font-semibold text-accent2",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
