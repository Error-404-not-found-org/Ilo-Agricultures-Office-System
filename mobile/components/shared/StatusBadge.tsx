import React from "react";
import { Badge, type BadgeProps } from "@/components/ui/Badge";

export type StatusDomain =
  | "request"
  | "service"
  | "outcome"
  | "observation"
  | "pregnancy"
  | "task"
  | "animal"
  | "calving"
  | "health"
  | "reproduction"
  | "general";

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

export interface StatusBadgeProps {
  label: string;
  variant?: string;
  size?: number;
  domain?: StatusDomain;
  compact?: boolean;
}

function inferStatusTone(value: string): StatusTone {
  const normalized = String(value || "").toLowerCase();

  if (["emergency", "failed", "cancelled", "overdue", "rejected", "sick", "loss"].some((word) => normalized.includes(word))) {
    return "danger";
  }
  if (
    ["pending", "scheduled", "in heat", "warning", "due"].some((word) =>
      normalized.includes(word)
    )
  ) {
    return "warning";
  }
  if (
    [
      "pregnant",
      "resolved",
      "synced",
      "active",
      "available",
      "approved",
      "done",
      "completed",
      "normal",
      "continuing",
    ].some((word) => normalized.includes(word))
  ) {
    return "success";
  }
  if (
    [
      "inseminated",
      "in-progress",
      "in_progress",
      "triaged",
      "assigned",
      "review",
    ].some((word) => normalized.includes(word))
  ) {
    return "info";
  }
  return "neutral";
}

function resolveStatusTone(variant: string | undefined, label: string): StatusTone {
  if (!variant) return inferStatusTone(label);

  const normalized = variant.toLowerCase();
  if (["success", "approved", "resolved", "done", "completed", "active", "normal", "pregnant"].includes(normalized)) {
    return "success";
  }
  if (["warning", "pending", "scheduled", "in heat"].includes(normalized)) {
    return "warning";
  }
  if (["danger", "error", "rejected", "cancelled", "sick"].includes(normalized)) {
    return "danger";
  }
  if (["info", "primary", "inseminated", "assigned", "review"].includes(normalized)) {
    return "info";
  }
  if (["neutral", "secondary"].includes(normalized)) {
    return "neutral";
  }

  return inferStatusTone(`${variant} ${label}`);
}

export function StatusBadge({
  label,
  variant,
  size = 10,
  domain = "general",
  compact = false,
}: StatusBadgeProps) {
  const tone = resolveStatusTone(variant, label);
  const badgeVariant: Record<StatusTone, NonNullable<BadgeProps["variant"]>> = {
    success: "success",
    warning: "warning",
    danger: "destructive",
    info: "info",
    neutral: "secondary",
  };
  const accessibleDomain: Record<StatusDomain, string> = {
    request: "Request status",
    service: "Service status",
    outcome: "Breeding outcome",
    observation: "Observation status",
    pregnancy: "Pregnancy status",
    task: "Task status",
    animal: "Animal status",
    calving: "Calving status",
    health: "Health status",
    reproduction: "Reproductive status",
    general: "Status",
  };

  return (
    <Badge
      label={label || "Unknown"}
      variant={badgeVariant[tone]}
      compact={compact}
      textNumberOfLines={compact ? 1 : 2}
      accessibilityLabel={`${accessibleDomain[domain]}: ${label || "Unknown"}`}
      style={{
        maxWidth: 220,
        flexShrink: 1,
      }}
      textStyle={{ fontSize: size, flexShrink: 1 }}
    />
  );
}
