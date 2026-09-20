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
  /** Pinned to the bottom of the rail. Kept generic: ui-kit states no opinion about what goes here. */
  footer?: ReactNode;
}

function DefaultLink({ to, children, ...rest }: NavLinkProps) {
  return (
    <a href={to} {...rest}>
      {children}
    </a>
  );
}

export function NavRail({ brand, items, linkComponent, footer }: NavRailProps) {
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
      {footer && <div className="nexus-nav-rail__footer">{footer}</div>}
    </nav>
  );
}
