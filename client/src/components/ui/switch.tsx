import * as React from "react";
import { Toggle } from "@/ui-kit";

interface SwitchProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked = false, onCheckedChange, disabled, className }, _ref) => {
    return (
      <Toggle
        checked={checked}
        onChange={(value) => onCheckedChange?.(value)}
        disabled={disabled}
        className={className}
      />
    );
  }
);

Switch.displayName = "Switch";

export { Switch };
