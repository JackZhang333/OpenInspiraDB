import React from "react";
import { cn } from "../../lib/utils.js";

export const Button = React.forwardRef(
  ({ className, variant = "default", size = "default", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss/30",
          "disabled:pointer-events-none disabled:opacity-50",
          variant === "default" && "bg-moss text-white hover:bg-moss/90",
          variant === "secondary" && "bg-clay/20 text-ink hover:bg-clay/30",
          variant === "ghost" && "hover:bg-clay/10 text-ink/70",
          variant === "danger" && "bg-rose-500 text-white hover:bg-rose-600",
          size === "default" && "h-10 px-4 py-2",
          size === "sm" && "h-8 px-3 text-xs",
          size === "lg" && "h-12 px-6",
          size === "icon" && "h-10 w-10",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
