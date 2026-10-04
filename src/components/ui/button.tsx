import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
export function Button({
  className,
  variant = "primary",
  asChild,
  ...props
}: React.ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  asChild?: boolean;
}) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      className={twMerge(clsx("btn", `btn-${variant}`, className))}
      {...props}
    />
  );
}
