import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentPropsWithoutRef<"input">>(
  ({ className, ...props }, ref) => {
    return (
      <input
        className={cn(
          "flex h-10 w-full rounded-btn border border-cream-dark bg-cream px-3 py-2 font-sans text-sm text-text outline-none transition placeholder:text-text-muted focus:border-green-light focus:ring-2 focus:ring-green/10",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
