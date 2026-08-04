import React, { useMemo, useState } from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { CalendarDays, ChevronDown, ChevronUp } from "lucide-react-native";
import { format } from "date-fns";
import { useTheme } from "@/lib/theme";
import type { AnimalTimelineEvent } from "@/features/animal-records/types/animalTimeline.types";

const FILTERS = [
  "All",
  "Breeding",
  "Pregnancy",
  "Calving",
  "Health",
  "Medication",
  "Photos",
] as const;

const getCategory = (item: AnimalTimelineEvent) => {
  const evType = (item.eventType || "").toLowerCase();
  const srcType = (item.sourceType || "").toLowerCase();

  if (
    evType.includes("insemin") ||
    srcType.includes("insemin") ||
    evType.includes("ai_") ||
    srcType.includes("ai_") ||
    evType.includes("breed") ||
    srcType.includes("breed")
  ) {
    return "Breeding";
  }
  if (evType.includes("pregnan") || srcType.includes("pregnan")) {
    return "Pregnancy";
  }
  if (
    evType.includes("calv") ||
    srcType.includes("calv") ||
    evType.includes("offspring") ||
    srcType.includes("offspring")
  ) {
    return "Calving";
  }
  if (
    evType.includes("vaccin") ||
    srcType.includes("vaccin") ||
    evType.includes("treat") ||
    srcType.includes("treat") ||
    evType.includes("med") ||
    srcType.includes("med")
  ) {
    return "Medication";
  }
  // Fallback health for other medical checks
  if (
    evType.includes("health") ||
    srcType.includes("health") ||
    evType.includes("check") ||
    srcType.includes("check") ||
    srcType.includes("deworm") ||
    srcType.includes("weight")
  ) {
    return "Health";
  }
  return "All";
};

interface TimelineListProps {
  events: AnimalTimelineEvent[];
  filter?: string;
  onFilterChange?: (filter: any) => void;
}

export function TimelineList({ events, filter: controlledFilter, onFilterChange }: TimelineListProps) {
  const { colors } = useTheme();
  const [internalFilter, setInternalFilter] = useState<(typeof FILTERS)[number]>("All");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const filter = controlledFilter !== undefined ? controlledFilter : internalFilter;
  const setFilter = onFilterChange !== undefined ? onFilterChange : setInternalFilter;

  const visible = useMemo(() => {
    if (controlledFilter !== undefined) {
      return events;
    }
    return events.filter((item) => {
      if (filter === "All") return true;
      if (filter === "Photos") return Boolean(item.attachments?.length);
      return getCategory(item) === filter;
    });
  }, [events, filter, controlledFilter]);

  return (
    <View style={{ zIndex: 10 }}>
      {/* Dropdown Filter Selector */}
      <View style={{ position: "relative", zIndex: 50, marginBottom: 16 }}>
        <TouchableOpacity
          onPress={() => setDropdownOpen(!dropdownOpen)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 14,
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text
              style={{
                color: colors.textMuted,
                fontFamily: "Outfit_500Medium",
                fontSize: 12,
              }}
            >
              Filter Timeline:
            </Text>
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: "Outfit_700Bold",
                fontSize: 14,
              }}
            >
              {filter}
            </Text>
          </View>
          {dropdownOpen ? (
            <ChevronUp size={18} color={colors.textSecondary} />
          ) : (
            <ChevronDown size={18} color={colors.textSecondary} />
          )}
        </TouchableOpacity>

        {dropdownOpen && (
          <View
            style={{
              position: "absolute",
              top: 52,
              left: 0,
              right: 0,
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 14,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 10,
              elevation: 4,
              overflow: "hidden",
              zIndex: 200,
            }}
          >
            {FILTERS.map((item) => (
              <TouchableOpacity
                key={item}
                onPress={() => {
                  setFilter(item);
                  setDropdownOpen(false);
                }}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  backgroundColor:
                    filter === item ? colors.border : "transparent",
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <Text
                  style={{
                    color: filter === item ? colors.primary : colors.textPrimary,
                    fontFamily:
                      filter === item ? "Outfit_700Bold" : "Outfit_500Medium",
                    fontSize: 13,
                  }}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {visible.map((item, index) => {
        const key = item._id || `${item.eventType}-${item.occurredAt}-${index}`;
        const open = expanded === key;
        return (
          <TouchableOpacity
            key={key}
            onPress={() => setExpanded(open ? null : key)}
            className="flex-row"
            activeOpacity={0.8}
          >
            <View className="items-center w-8">
              <View
                className="w-7 h-7 rounded-full items-center justify-center"
                style={{ backgroundColor: colors.tint }}
              >
                <CalendarDays size={14} color={colors.primary} />
              </View>
              {index < visible.length - 1 ? (
                <View
                  className="flex-1 w-0.5"
                  style={{ backgroundColor: colors.border }}
                />
              ) : null}
            </View>
            <View
              className="flex-1 ml-2 mb-3 p-3 border"
              style={{
                borderRadius: 8,
                backgroundColor: colors.card,
                borderColor: colors.border,
              }}
            >
              <View className="flex-row justify-between gap-2">
                <View className="flex-1">
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: "Outfit_700Bold",
                      fontSize: 13,
                    }}
                  >
                    {item.title}
                  </Text>
                  <Text
                    style={{
                      color: colors.textMuted,
                      fontFamily: "Outfit_500Medium",
                      fontSize: 10,
                    }}
                  >
                    {format(new Date(item.occurredAt), "MMM d, yyyy - h:mm a")}
                  </Text>
                </View>
                {open ? (
                  <ChevronUp size={16} color={colors.textMuted} />
                ) : (
                  <ChevronDown size={16} color={colors.textMuted} />
                )}
              </View>
              {item.summary ? (
                <Text
                  numberOfLines={open ? undefined : 2}
                  className="mt-2"
                  style={{
                    color: colors.textSecondary,
                    fontFamily: "Outfit_500Medium",
                    fontSize: 11,
                    lineHeight: 16,
                  }}
                >
                  {item.summary}
                </Text>
              ) : null}
              {open && item.attachments?.length ? (
                <View className="flex-row gap-2 mt-3">
                  {item.attachments.slice(0, 3).map((uri) => (
                    <Image
                      key={uri}
                      source={{ uri }}
                      className="w-16 h-16"
                      style={{ borderRadius: 8 }}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
