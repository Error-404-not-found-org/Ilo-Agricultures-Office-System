import * as React from "react";
import { Platform, StyleSheet, View, Pressable } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import * as DialogPrimitive from "@rn-primitives/dialog";
import { cn } from "@/lib/cn";
import { X } from "lucide-react-native";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  DialogPrimitive.OverlayRef,
  DialogPrimitive.OverlayProps
>(({ className, ...props }, ref) => (
  <Animated.View
    entering={FadeIn.duration(150)}
    exiting={FadeOut.duration(150)}
    style={Platform.OS !== "web" ? StyleSheet.absoluteFill : undefined}
    className="z-50 bg-black/60 dark:bg-black/80 flex items-center justify-center p-4"
  >
    <DialogPrimitive.Overlay
      ref={ref}
      style={StyleSheet.absoluteFill}
      className={cn("z-50 bg-transparent", className)}
      {...props}
    />
  </Animated.View>
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  DialogPrimitive.ContentRef,
  DialogPrimitive.ContentProps & { portalHost?: string; hideCloseIcon?: boolean }
>(({ className, children, portalHost, hideCloseIcon = false, ...props }, ref) => {
  return (
    <DialogPrimitive.Portal hostName={portalHost}>
      <DialogOverlay>
        <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} className="w-full items-center justify-center">
          <DialogPrimitive.Content
            ref={ref}
            className={cn(
              "z-50 w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-100 dark:border-slate-800",
              className
            )}
            {...props}
          >
            {children}
            {!hideCloseIcon && (
              <DialogPrimitive.Close
                asChild
                className="absolute right-4 top-4 rounded-full p-1 opacity-70 active:opacity-100"
              >
                <Pressable>
                  <X size={18} className="text-slate-500 dark:text-slate-400" />
                </Pressable>
              </DialogPrimitive.Close>
            )}
          </DialogPrimitive.Content>
        </Animated.View>
      </DialogOverlay>
    </DialogPrimitive.Portal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof View>) => (
  <View className={cn("flex flex-col space-y-1.5 text-center sm:text-left mb-4", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof View>) => (
  <View className={cn("flex flex-row items-center justify-end space-x-2 mt-6", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  DialogPrimitive.TitleRef,
  DialogPrimitive.TitleProps
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("font-outfit-bold text-lg text-slate-900 dark:text-slate-100 tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  DialogPrimitive.DescriptionRef,
  DialogPrimitive.DescriptionProps
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("font-outfit text-sm text-slate-500 dark:text-slate-400 leading-relaxed mt-1", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
};
