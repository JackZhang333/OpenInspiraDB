import React from "react";
import { cn } from "../../lib/utils.js";

export const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-lg border border-clay/20 bg-white px-3 py-2 text-sm",
        "placeholder:text-ink/30",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";
