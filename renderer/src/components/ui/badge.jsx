import React from "react";
import { cn } from "../../lib/utils.js";

export function Badge({ className, variant = "default", children, ...props }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variant === "default" && "bg-clay/20 text-ink/70",
        variant === "secondary" && "bg-moss/10 text-moss",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
