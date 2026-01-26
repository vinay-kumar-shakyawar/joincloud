import * as React from "react";
import { Button as KitButton } from "@/ui-kit";

type LegacyVariant =
  | "default"
  | "destructive"
  | "outline"
  | "secondary"
  | "ghost"
  | "link";

type LegacySize = "default" | "sm" | "lg" | "icon";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: LegacyVariant;
  size?: LegacySize;
}

const variantMap: Record<LegacyVariant, "primary" | "ghost" | "icon"> = {
  default: "primary",
  destructive: "primary",
  outline: "ghost",
  secondary: "ghost",
  ghost: "ghost",
  link: "ghost",
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "default", size, className, ...props }, ref) => {
    const mappedVariant = size === "icon" ? "icon" : variantMap[variant];

    return (
      <KitButton
        ref={ref}
        variant={mappedVariant}
        className={className}
        {...props}
      >
        {props.children}
      </KitButton>
    );
  }
);

Button.displayName = "Button";
const buttonVariants = (options?: {
  variant?: LegacyVariant;
  size?: LegacySize;
  className?: string;
}) => options?.className || "";

export { Button, buttonVariants };
