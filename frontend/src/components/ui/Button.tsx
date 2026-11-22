import { motion, type HTMLMotionProps } from "framer-motion";
import { Loader2 } from "lucide-react";
import { forwardRef, type ReactNode } from "react";
import { cn } from "@/utils/format";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "icon";

const base =
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50";
const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-[rgb(var(--c-on-accent))] hover:bg-accent/90",
  secondary: "border border-line bg-surface text-fg hover:bg-elevated",
  ghost: "text-fg2 hover:bg-elevated hover:text-fg",
  danger: "border border-err/30 bg-err/10 text-err hover:bg-err/20",
};
const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-label",
  md: "h-10 px-4 text-sm",
  icon: "h-9 w-9",
};

/** Class string for non-button elements (e.g. router links) that should look like a button. */
export const buttonClasses = (variant: ButtonVariant = "secondary", size: ButtonSize = "md", extra?: string) =>
  cn(base, variants[variant], sizes[size], extra);

type Props = Omit<HTMLMotionProps<"button">, "children"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "secondary", size = "md", loading = false, disabled, className, children, type = "button", ...rest },
  ref,
) {
  const inactive = disabled || loading;
  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={inactive}
      aria-busy={loading || undefined}
      whileTap={inactive ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.12 }}
      className={buttonClasses(variant, size, className)}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />}
      {children}
    </motion.button>
  );
});