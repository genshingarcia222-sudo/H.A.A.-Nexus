import { Link, Outlet, useLocation } from "react-router-dom";
import { NavRail, type NavLinkProps } from "@haa-nexus/ui-kit";
import type { ComponentType } from "react";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard" },
  { to: "/live-scribing", label: "Live Scribing" },
  { to: "/training", label: "Training" },
  { to: "/knowledge-base", label: "Knowledge Base" },
  { to: "/analytics", label: "Analytics" },
  { to: "/settings", label: "Settings" }
];

const RouterLink: ComponentType<NavLinkProps> = ({ to, children, ...rest }) => (
  <Link to={to} {...rest}>
    {children}
  </Link>
);

export function AppShell() {
  const location = useLocation();

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <NavRail
        brand="H.A.A. NEXUS"
        linkComponent={RouterLink}
        items={NAV_ITEMS.map((item) => ({
          ...item,
          isActive: location.pathname === item.to
        }))}
      />
      <main style={{ flex: 1, padding: "var(--nexus-space-5)" }}>
        <Outlet />
      </main>
    </div>
  );
}
