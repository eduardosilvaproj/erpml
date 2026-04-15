import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onFocus, onBlur, ...props }, ref) => {
    const isNumeric = type === "number";

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      if (isNumeric) {
        e.target.select();
      }
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      if (isNumeric && e.target.value === "") {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        )?.set;
        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(e.target, "0");
          e.target.dispatchEvent(new Event("input", { bubbles: true }));
          e.target.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
      onBlur?.(e);
    };

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-xl border border-border bg-input px-4 py-2 text-base text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/50 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-0 focus-visible:border-primary/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
