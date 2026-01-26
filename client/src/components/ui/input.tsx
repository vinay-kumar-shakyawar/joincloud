import * as React from "react";
import { TextInput } from "@/ui-kit";

const Input = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input">
>(({ className, type, ...props }, ref) => {
  return <TextInput ref={ref} className={className} {...props} />;
});
Input.displayName = "Input";

export { Input };
