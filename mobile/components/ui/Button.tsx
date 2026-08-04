import * as React from "react";
import { Pressable, Text, ActivityIndicator } from "react-native";
import { cn } from "@/lib/cn";
import { useTheme } from "@/lib/theme";

export interface ButtonProps extends React.ComponentPropsWithoutRef<typeof Pressable> {
  variant?: "default" | "outline" | "ghost" | "destructive" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  label?: string;
  loading?: boolean;
  textClassName?: string;
}

export const Button = React.forwardRef<React.ElementRef<typeof Pressable>, ButtonProps>(
  (
    {
      className,
      textClassName,
      variant = "default",
      size = "default",
      label,
      loading = false,
      disabled,
      children,
      accessibilityRole,
      accessibilityLabel,
      accessibilityState,
      ...props
    },
    ref
  ) => {
    const { colors } = useTheme();
    const isCustomChild = React.Children.count(children) > 0;

    const baseButtonClasses =
      "flex-row items-center justify-center rounded-xl active:opacity-80";

    const variantClasses = {
      default: "bg-primary dark:bg-emerald-600",
      secondary: "bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/20",
      outline: "border border-border dark:border-border-dark bg-card dark:bg-card-dark",
      ghost: "bg-transparent",
      destructive: "bg-rose-700 dark:bg-rose-500",
    };

    const sizeClasses = {
      default: "px-4 py-3 min-h-12",
      sm: "px-3 py-2 min-h-12 rounded-lg",
      lg: "px-6 py-4 min-h-14",
      icon: "h-12 w-12 p-0",
    };

    const baseTextClasses = "text-center font-outfit-semibold text-sm";

    const textVariantClasses = {
      default: "text-white",
      secondary: "text-primary dark:text-emerald-400 font-extrabold",
      outline: "text-slate-800 dark:text-slate-200",
      ghost: "text-primary dark:text-emerald-400",
      destructive: "text-white",
    };

    return (
      <Pressable
        ref={ref}
        {...props}
        disabled={disabled || loading}
        accessibilityRole={accessibilityRole || "button"}
        accessibilityLabel={accessibilityLabel || label}
        accessibilityState={{
          ...accessibilityState,
          disabled: Boolean(disabled || loading),
          busy: loading,
        }}
        className={cn(
          baseButtonClasses,
          variantClasses[variant],
          sizeClasses[size],
          (disabled || loading) && "opacity-50",
          className
        )}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={
              variant === "default" || variant === "destructive"
                ? colors.onPrimary
                : colors.primary
            }
          />
        ) : isCustomChild ? (
          children
        ) : (
          <Text className={cn(baseTextClasses, textVariantClasses[variant], textClassName)}>
            {label}
          </Text>
        )}
      </Pressable>
    );
  }
);

Button.displayName = "Button";
