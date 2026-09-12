import type { ComponentType, ReactNode } from "react";

export interface NavRailItem {
  to: string;
  label: string;
  isActive: boolean;
}

export interface NavLinkProps {
  to: string;
  className?: string;
  "aria-current"?: "page";
  children: ReactNode;
}

export interface NavRailProps {
  brand: string;
  items: NavRailItem[];
  /** Injected so ui-kit doesn't depend on any particular router. */
  linkComponent?: ComponentType<NavLinkProps>;
}

function DefaultLink({ to, children, ...rest }: NavLinkProps) {
  return (
    <a href={to} {...rest}>
      {children}
    </a>
  );
}

export function NavRail({ brand, items, linkComponent }: NavRailProps) {
  const Link = linkComponent ?? DefaultLink;
  return (
    <nav className="nexus-nav-rail" aria-label="Primary">
      <div className="nexus-nav-rail__brand">{brand}</div>
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className="nexus-nav-rail__item"
          aria-current={item.isActive ? "page" : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
