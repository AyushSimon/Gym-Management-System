import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/utils/format";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-line bg-surface shadow-card", className)} {...rest} />;
}

interface SectionCardProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function SectionCard({ title, description, action, children, className, bodyClassName }: SectionCardProps) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <div className="flex items-start justify-between gap-3 px-5 pb-1 pt-4">
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold tracking-tight text-fg">{title}</h2>
          {description && <p className="mt-0.5 text-label text-fg2">{description}</p>}
        </div>
        {action}
      </div>
      <div className={cn("flex-1 px-5 pb-4 pt-3", bodyClassName)}>{children}</div>
    </Card>
  );
}