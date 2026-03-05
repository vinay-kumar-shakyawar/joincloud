import * as React from "react";

type BadgeVariant = "neutral" | "success" | "warning" | "error";
type ButtonVariant = "primary" | "ghost" | "icon";

const badgeVariantClass: Record<BadgeVariant, string> = {
  neutral: "bg-muted text-foreground",
  success: "bg-green-600/20 text-green-400",
  warning: "bg-yellow-600/20 text-yellow-300",
  error: "bg-red-600/20 text-red-300",
};

const buttonVariantClass: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  ghost: "border border-border bg-transparent hover:bg-muted/30",
  icon: "h-9 w-9 border border-border bg-transparent hover:bg-muted/30",
};

export const Badge = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }
>(({ className = "", variant = "neutral", ...props }, ref) => (
  <span
    ref={ref}
    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeVariantClass[variant]} ${className}`}
    {...props}
  />
));
Badge.displayName = "Badge";

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }
>(({ className = "", variant = "primary", type = "button", ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    className={`inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${buttonVariantClass[variant]} ${className}`}
    {...props}
  />
));
Button.displayName = "Button";

export const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className = "", ...props }, ref) => (
  <div ref={ref} className={`rounded-xl border border-border bg-card p-4 ${className}`} {...props} />
));
Card.displayName = "Card";

export const TextInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className = "", ...props }, ref) => (
  <input
    ref={ref}
    className={`h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ${className}`}
    {...props}
  />
));
TextInput.displayName = "TextInput";

export function Toggle({
  checked = false,
  onChange,
  disabled,
  className = "",
}: {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`h-6 w-11 rounded-full border border-border transition-colors ${
        checked ? "bg-primary" : "bg-muted"
      } ${className}`}
    />
  );
}

export function PageContainer({
  className = "",
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`p-6 ${className}`}>{children}</div>;
}

export function SectionHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-8 text-center">
      {icon ? <div className="mb-2 text-muted-foreground">{icon}</div> : null}
      <p className="text-base font-medium">{title}</p>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}
