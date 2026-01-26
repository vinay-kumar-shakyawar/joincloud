import * as React from "react";
import { Badge as KitBadge } from "@/ui-kit";

type LegacyVariant = "default" | "secondary" | "destructive" | "outline";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: LegacyVariant;
}

const variantMap: Record<LegacyVariant, "neutral" | "error"> = {
  default: "neutral",
  secondary: "neutral",
  outline: "neutral",
  destructive: "error",
};

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const mappedVariant = variantMap[variant];
  return (
    <KitBadge variant={mappedVariant} className={className}>
      {props.children}
    </KitBadge>
  );
}

const badgeVariants = () => "";

export { Badge, badgeVariants };
