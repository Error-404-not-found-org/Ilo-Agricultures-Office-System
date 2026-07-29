import React from "react";
import { View, TouchableOpacity } from "react-native";
import { Calendar } from "lucide-react-native";
import { useTheme } from "@/lib/theme";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import DateTimePicker from "@react-native-community/datetimepicker";

interface DateRangeSelectorProps {
  visible: boolean;
  startDate: Date | null;
  endDate: Date | null;
  onClose: () => void;
  onSelectStart: (date: Date) => void;
  onSelectEnd: (date: Date) => void;
  onClear: () => void;
  showStartPicker: boolean;
  showEndPicker: boolean;
  setShowStartPicker: (val: boolean) => void;
  setShowEndPicker: (val: boolean) => void;
}

export function DateRangeSelector({
  visible,
  startDate,
  endDate,
  onClose,
  onSelectStart,
  onSelectEnd,
  onClear,
  showStartPicker,
  showEndPicker,
  setShowStartPicker,
  setShowEndPicker,
}: DateRangeSelectorProps) {
  const { colors, isDark } = useTheme();

  return (
    <Dialog open={visible} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle>Filter by Date Range</DialogTitle>
        </DialogHeader>

        <View className="space-y-4 my-4">
          {/* Start Date */}
          <View>
            <Text className="text-[10px] font-outfit-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 ml-1">
              Start Date
            </Text>
            <TouchableOpacity
              onPress={() => setShowStartPicker(true)}
              className="flex-row items-center justify-between p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900"
            >
              <Text className="text-sm font-outfit-medium text-slate-900 dark:text-slate-100">
                {startDate ? startDate.toLocaleDateString() : "Select start date"}
              </Text>
              <Calendar size={18} color={isDark ? "#34d399" : "#00643B"} />
            </TouchableOpacity>
          </View>

          {/* End Date */}
          <View>
            <Text className="text-[10px] font-outfit-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 ml-1">
              End Date
            </Text>
            <TouchableOpacity
              onPress={() => setShowEndPicker(true)}
              className="flex-row items-center justify-between p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900"
            >
              <Text className="text-sm font-outfit-medium text-slate-900 dark:text-slate-100">
                {endDate ? endDate.toLocaleDateString() : "Select end date"}
              </Text>
              <Calendar size={18} color={isDark ? "#34d399" : "#00643B"} />
            </TouchableOpacity>
          </View>
        </View>

        {showStartPicker && (
          <DateTimePicker
            value={startDate || new Date()}
            mode="date"
            display="default"
            onChange={(e, date) => {
              setShowStartPicker(false);
              if (date) onSelectStart(date);
            }}
          />
        )}

        {showEndPicker && (
          <DateTimePicker
            value={endDate || new Date()}
            mode="date"
            display="default"
            onChange={(e, date) => {
              setShowEndPicker(false);
              if (date) onSelectEnd(date);
            }}
          />
        )}

        <View className="flex-row gap-3 mt-4">
          <Button
            variant="outline"
            className="flex-1"
            label="Clear Filters"
            onPress={() => {
              onClear();
              onClose();
            }}
          />
          <Button
            variant="default"
            className="flex-1"
            label="Apply Range"
            onPress={onClose}
          />
        </View>
      </DialogContent>
    </Dialog>
  );
}
