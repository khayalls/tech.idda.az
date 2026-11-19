import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "light" | "glass" | "primary" | "outline";

const sizes = {
  md: "px-6 py-4", // 56px tall
  sm: "px-4 py-2", // 40px tall
} as const;

const base =
  "inline-flex items-center justify-center gap-2 rounded-full text-label-m whitespace-nowrap " +
  "transition-[background-color,color,transform,box-shadow] duration-200 ease-out " +
  "active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4";

const variants: Record<Variant, string> = {
  light: "bg-btn-light text-btn-light-fg hover:bg-blue-50",
  glass: "bg-btn-glass text-on-dark backdrop-blur-md hover:bg-white/24",
  primary: "bg-btn-primary text-btn-primary-fg hover:bg-blue-900",
  outline: "bg-btn-light text-btn-light-fg ring-1 ring-inset ring-line hover:ring-neutral-300",
};

type ButtonLinkProps = Omit<ComponentProps<typeof Link>, "className"> & {
  variant?: Variant;
  size?: keyof typeof sizes;
  className?: string;
};

export function ButtonLink({ variant = "light", size = "md", className = "", ...props }: ButtonLinkProps) {
  return <Link className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props} />;
}
