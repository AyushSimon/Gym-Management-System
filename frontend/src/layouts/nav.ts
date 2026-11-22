import { CreditCard, LayoutDashboard, Settings, Tags, Users, type LucideIcon } from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the browser tab and the breadcrumb. */
  title: string;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, title: "Dashboard" },
  { to: "/members", label: "Members", icon: Users, title: "Members" },
  { to: "/plans", label: "Membership Plans", icon: Tags, title: "Membership Plans" },
  { to: "/payments", label: "Payments", icon: CreditCard, title: "Payments" },
  { to: "/settings", label: "Settings", icon: Settings, title: "Settings" },
];

export function findNav(pathname: string): NavItem | undefined {
  if (pathname === "/") return NAV_ITEMS[0];
  return NAV_ITEMS.slice(1).find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`));
}
