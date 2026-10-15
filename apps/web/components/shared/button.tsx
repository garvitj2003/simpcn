import type { ComponentPropsWithoutRef } from "react";
import "./button.css";

type Appearance = {
  variant?: "primary" | "secondary" | "washed" | "link";
  size?: "sm" | "md" | "icon";
};
type ButtonProps = Appearance & ComponentPropsWithoutRef<"button">;
type ButtonLinkProps = Appearance & ComponentPropsWithoutRef<"a">;

export function Button({ variant = "primary", size = "md", className = "", children, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={`glass-button ${className}`} data-variant={variant} data-size={size} {...props}><span className="glass-button-content">{children}</span></button>;
}

export function ButtonLink({ variant = "primary", size = "md", className = "", children, ...props }: ButtonLinkProps) {
  return <a className={`glass-button ${className}`} data-variant={variant} data-size={size} {...props}><span className="glass-button-content">{children}</span></a>;
}
