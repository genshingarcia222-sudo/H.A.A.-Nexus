import { Link, Outlet, useLocation } from "react-router-dom";
import { NavRail, type NavLinkProps } from "@haa-nexus/ui-kit";
import type { ComponentType } from "react";
import { mayAccessReferenceMaterial } from "@haa-nexus/nexus-core";
import { useSessionStore } from "../store/sessionStore.js";
import { isReferenceRoute } from "./referenceRoutes.js";

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
  const session = useSessionStore((s) => s.session);
  // D4: an assessment runs closed-book. Hiding these links is a courtesy so a
  // learner is not offered something that would refuse them; `ReferenceGate` on
  // the route itself is what actually enforces it.
  const referenceAllowed = mayAccessReferenceMaterial(session);
  const items = NAV_ITEMS.filter((item) => referenceAllowed || !isReferenceRoute(item.to));

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <NavRail
        brand="H.A.A. NEXUS"
        linkComponent={RouterLink}
        items={items.map((item) => ({
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
