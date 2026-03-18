import React from "react";
import { cn } from "../../lib/utils.js";

export const Textarea = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-lg border border-clay/20 bg-white px-3 py-2 text-sm",
        "placeholder:text-ink/30",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "resize-none",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";
