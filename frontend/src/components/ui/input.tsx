import * as React from "react";
import { cn } from "../../lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  prefixLabel?: React.ReactNode;
  trailing?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, prefixLabel, trailing, ...props }, ref) => {
    if (icon || prefixLabel || trailing) {
      return (
        <div className="flex items-center gap-2 rounded-xl border border-input bg-card px-4 py-3 shadow-soft transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
          {icon && <span className="shrink-0 text-ink-400">{icon}</span>}
          {prefixLabel && (
            <span className="shrink-0 text-sm font-medium text-ink-500">
              {prefixLabel}
            </span>
          )}
          <input
            ref={ref}
            className={cn(
              "w-full bg-transparent text-sm text-ink-900 outline-none placeholder:text-ink-300",
              className,
            )}
            {...props}
          />
          {trailing && <span className="shrink-0">{trailing}</span>}
        </div>
      );
    }

    return (
      <input
        ref={ref}
        className={cn(
          "flex h-12 w-full rounded-xl border border-input bg-card px-4 text-sm text-ink-900 shadow-soft outline-none transition placeholder:text-ink-300 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
