import type { ButtonHTMLAttributes } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
}

export function Button({ variant = "primary", className, ...rest }: ButtonProps) {
  const variantClass = variant === "primary" ? "nexus-btn--primary" : "nexus-btn--secondary";
  return <button className={["nexus-btn", variantClass, className].filter(Boolean).join(" ")} {...rest} />;
}
