import type { HTMLAttributes, ReactNode } from "react";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  title?: string;
  children: ReactNode;
}

export function Card({ title, children, className, ...rest }: CardProps) {
  return (
    <section className={["nexus-card", className].filter(Boolean).join(" ")} {...rest}>
      {title ? <h2 className="nexus-card__title">{title}</h2> : null}
      {children}
    </section>
  );
}
