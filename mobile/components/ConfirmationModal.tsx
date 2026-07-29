import React from "react";
import { View } from "react-native";
import { AlertTriangle, Trash2 } from "lucide-react-native";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

interface ConfirmationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onCancel?: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string | null;
  isDestructive?: boolean;
  icon?: React.ReactNode;
}

export function ConfirmationModal({
  visible,
  onClose,
  onConfirm,
  onCancel,
  title,
  message,
  confirmText = "Yes, Cancel",
  cancelText = "No, Keep it",
  isDestructive = true,
  icon,
}: ConfirmationModalProps) {
  const [confirming, setConfirming] = React.useState(false);
  const confirmLockRef = React.useRef(false);

  React.useEffect(() => {
    if (!visible) {
      confirmLockRef.current = false;
      setConfirming(false);
    }
  }, [visible]);

  const handleConfirm = async () => {
    if (confirmLockRef.current) return;
    confirmLockRef.current = true;
    setConfirming(true);
    try {
      await onConfirm();
    } catch (err) {
      console.error(err);
    } finally {
      setConfirming(false);
      onClose();
    }
  };

  const showCancel = cancelText !== null && cancelText !== "";
  const handleCancel = () => {
    if (confirmLockRef.current) return;
    if (onCancel) {
      onCancel();
      return;
    }
    onClose();
  };

  return (
    <Dialog
      open={visible}
      onOpenChange={(open) => {
        if (!open && !confirming) onClose();
      }}
    >
      <DialogContent
        hideCloseIcon
        className="items-center text-center p-6 rounded-3xl"
      >
        {/* Icon Header */}
        <View
          className={`w-14 h-14 rounded-2xl items-center justify-center mb-4 ${
            isDestructive
              ? "bg-rose-500/10 dark:bg-rose-500/20"
              : "bg-amber-500/10 dark:bg-amber-500/20"
          }`}
        >
          {icon ? (
            icon
          ) : isDestructive ? (
            <Trash2 size={26} className="text-rose-600 dark:text-rose-400" />
          ) : (
            <AlertTriangle
              size={26}
              className="text-amber-600 dark:text-amber-400"
            />
          )}
        </View>

        {/* Header & Body */}
        <DialogHeader className="items-center text-center mb-2">
          <DialogTitle className="text-center text-xl font-outfit-bold">
            {title}
          </DialogTitle>
          <DialogDescription className="text-center font-outfit-medium leading-relaxed px-2">
            {message}
          </DialogDescription>
        </DialogHeader>

        {/* Footer Actions */}
        <DialogFooter className="w-full flex-row gap-3 mt-4">
          {showCancel && (
            <Button
              variant="outline"
              label={cancelText || "Cancel"}
              disabled={confirming}
              onPress={handleCancel}
              className="flex-1"
            />
          )}
          <Button
            variant={isDestructive ? "destructive" : "default"}
            label={confirmText}
            loading={confirming}
            disabled={confirming}
            onPress={handleConfirm}
            className="flex-1"
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
