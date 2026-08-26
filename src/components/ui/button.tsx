"use client";

import * as React from "react";

import { Loader2 } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { Slot } from "./slot";

const buttonBase =
  "inline-flex items-center justify-center rounded-md text-sm font-medium text-ink ring-offset-paper transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
const buttonVariantClasses = {
  default: "bg-accent text-ink hover:bg-accent-ink",
  destructive: "bg-red-600 text-paper hover:bg-red-700",
  outline: "border border-shelf-deep bg-paper hover:bg-shelf",
  bottomline: "border-b rounded-none rounded-t-md border-shelf-deep bg-paper hover:border-mute",
  "tab-selected": "border-b rounded-none rounded-t-md border-ink bg-paper",
  secondary: "border border-shelf-deep bg-shelf text-ink hover:border-mute hover:bg-shelf-deep",
  ghost: "hover:bg-shelf",
  link: "text-ink underline-offset-4 hover:underline",
} as const;
const buttonSizeClasses = {
  default: "h-11 px-4 py-2",
  sm: "h-9 px-3",
  lg: "h-11 px-8 text-base",
  icon: "h-11 w-11",
} as const;

type ButtonVariant = keyof typeof buttonVariantClasses;
type ButtonSize = keyof typeof buttonSizeClasses;

function buttonVariants({
  className,
  size,
  variant,
}: {
  className?: string;
  size?: ButtonSize | null;
  variant?: ButtonVariant | null;
} = {}) {
  return cn(
    buttonBase,
    buttonVariantClasses[variant ?? "default"],
    buttonSizeClasses[size ?? "default"],
    className,
  );
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  loading?: boolean;
  size?: ButtonSize | null;
  variant?: ButtonVariant | null;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      asChild = false,
      children,
      className,
      disabled: disabledProp,
      loading,
      onClick,
      size,
      variant,
      ...props
    },
    ref,
  ) => {
    const disabled = disabledProp || loading;

    if (asChild) {
      const child = React.Children.only(children) as React.ReactElement<{
        children?: React.ReactNode;
        onClick?: React.MouseEventHandler<HTMLElement>;
      }>;
      const childProps = disabled
        ? {
            onClick: (event: React.MouseEvent<HTMLElement>) => {
              event.preventDefault();
              event.stopPropagation();
            },
          }
        : undefined;
      const slottedChild = React.cloneElement(
        child,
        childProps,
        loading
          ? [<Loader2 key="loading" className="mr-2 h-4 w-4 animate-spin" />, child.props.children]
          : child.props.children,
      );
      return (
        <Slot
          ref={ref as React.Ref<HTMLElement>}
          className={cn(buttonVariants({ variant, size, className }))}
          {...props}
          aria-disabled={disabled || undefined}
          data-disabled={disabled ? "" : undefined}
          onClick={(event) => {
            if (disabled) {
              event.preventDefault();
              event.stopPropagation();
              return;
            }
            onClick?.(event as React.MouseEvent<HTMLButtonElement>);
          }}
          tabIndex={disabled ? -1 : props.tabIndex}
        >
          {slottedChild}
        </Slot>
      );
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
        disabled={disabled}
        onClick={onClick}
      >
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button };
