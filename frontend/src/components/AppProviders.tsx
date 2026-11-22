import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";
import { SettingsProvider } from "@/hooks/useSettings";
import { ToastProvider } from "@/components/ui/Toast";

/** Everything that must wrap the app (and the tests): settings, theme, toasts, reduced-motion handling. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <SettingsProvider>
        <ToastProvider>{children}</ToastProvider>
      </SettingsProvider>
    </MotionConfig>
  );
}