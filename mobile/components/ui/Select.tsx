import * as React from "react";
import { Platform, StyleSheet, View, ScrollView } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import * as SelectPrimitive from "@rn-primitives/select";
import { cn } from "@/lib/cn";
import { Check, ChevronDown } from "lucide-react-native";

export type Option = {
  value: string;
  label: string;
} | undefined;

const Select = SelectPrimitive.Root;

const SelectGroup = SelectPrimitive.Group;

const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
  SelectPrimitive.TriggerRef,
  SelectPrimitive.TriggerProps
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex flex-row h-12 w-full items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-3 text-sm font-outfit text-slate-900 dark:text-slate-100 active:opacity-80",
      props.disabled && "opacity-50",
      className
    )}
    {...props}
  >
    <View className="flex-1 flex-row items-center min-w-0">
      <>{children}</>
    </View>
    <ChevronDown size={16} className="text-slate-400 dark:text-slate-500 ml-2 shrink-0" />
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectContent = React.forwardRef<
  SelectPrimitive.ContentRef,
  SelectPrimitive.ContentProps & {
    portalHost?: string;
    insets?: { top?: number; bottom?: number; left?: number; right?: number };
  }
>(({ className, children, position = "popper", portalHost, insets, ...props }, ref) => {
  return (
    <SelectPrimitive.Portal hostName={portalHost}>
      <SelectPrimitive.Overlay style={Platform.OS !== "web" ? StyleSheet.absoluteFill : undefined} className="z-50 bg-black/40">
        <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(100)} className="w-full items-center justify-center">
          <SelectPrimitive.Content
            ref={ref}
            className={cn(
              "relative z-50 max-h-80 min-w-[10rem] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-1.5 my-auto self-center w-11/12",
              className
            )}
            position={position}
            {...props}
          >
            <ScrollView className="p-1">
              <SelectPrimitive.Viewport className="p-1">
                {children}
              </SelectPrimitive.Viewport>
            </ScrollView>
          </SelectPrimitive.Content>
        </Animated.View>
      </SelectPrimitive.Overlay>
    </SelectPrimitive.Portal>
  );
});
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef<
  SelectPrimitive.LabelRef,
  SelectPrimitive.LabelProps
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("py-1.5 pl-8 pr-2 font-outfit-bold text-xs text-slate-400 uppercase tracking-wider", className)}
    {...props}
  />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectItem = React.forwardRef<
  SelectPrimitive.ItemRef,
  SelectPrimitive.ItemProps
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex-row w-full items-center rounded-xl py-3 pl-9 pr-3 font-outfit text-sm text-slate-900 dark:text-slate-100 active:bg-slate-100 dark:active:bg-slate-800",
      props.disabled && "opacity-50",
      className
    )}
    {...props}
  >
    <SelectPrimitive.ItemIndicator className="absolute left-2.5 flex items-center justify-center">
      <Check size={16} className="text-primary dark:text-emerald-400 font-extrabold" />
    </SelectPrimitive.ItemIndicator>
    <SelectPrimitive.ItemText className="font-outfit font-medium text-sm text-slate-800 dark:text-slate-200" />
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef<
  SelectPrimitive.SeparatorRef,
  SelectPrimitive.SeparatorProps
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-slate-200 dark:bg-slate-800", className)}
    {...props}
  />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
