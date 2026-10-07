import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type ButtonVariant = "primary" | "secondary";

export function buttonStyles(variant: ButtonVariant = "primary") {
  return cn(
    "inline-flex min-h-13 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-[background-color,transform] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40",
    variant === "primary"
      ? "bg-foreground text-white hover:bg-[#3c4037]"
      : "border border-line bg-surface text-foreground hover:bg-purple-soft",
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function Button({
  className,
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonStyles(variant), className)}
      {...props}
    />
  );
}
