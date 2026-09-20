import { Link, Outlet, useLocation } from "react-router-dom";
import { NavRail, type NavLinkProps } from "@haa-nexus/ui-kit";
import type { ComponentType } from "react";
import { mayAccessReferenceMaterial } from "@haa-nexus/nexus-core";
import { useSessionStore } from "../store/sessionStore.js";
import { useEntitlementStore } from "../store/entitlementStore.js";
import { isReferenceRoute } from "./referenceRoutes.js";
import { isWebsitePreview } from "../preview/previewEntitlement.js";
import { TIER_LABELS } from "@haa-nexus/nexus-core";

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
        footer={<PreviewBadge />}
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

/**
 * Says plainly that this browser is a development preview, not a purchase.
 * Deliberately avoids "Subscribed"/"Paid": no production subscription state
 * exists, and claiming one would be a lie to whoever is looking at the screen.
 */
function PreviewBadge() {
  // The previewed tier is subscription state, not a capability: `Entitlements`
  // deliberately carries no tier, so that nothing can branch on one.
  const tier = useEntitlementStore((s) => s.subscription.tier);
  if (!isWebsitePreview()) return null;

  return (
    <div
      style={{ fontSize: "var(--nexus-font-size-xs)", color: "var(--nexus-color-ink-secondary)", lineHeight: 1.4 }}
    >
      <div style={{ fontWeight: 600, color: "var(--nexus-color-ink)" }}>
        Preview: {TIER_LABELS[tier]}
      </div>
      <div>Development preview — not a subscription.</div>
    </div>
  );
}
