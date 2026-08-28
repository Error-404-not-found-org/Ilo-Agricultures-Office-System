import type { QueryClient } from "@tanstack/react-query";

import {
  aiRequestKeys,
  healthRequestKeys,
  notificationKeys,
} from "@/lib/queryKeys";

type NotificationData = Record<string, unknown> | undefined | null;

const text = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

export const getNotificationInvalidationKeys = (data: NotificationData) => {
  const metadata =
    data?.metadata && typeof data.metadata === "object"
      ? (data.metadata as Record<string, unknown>)
      : {};
  const type = String(data?.type || metadata.type || "").toLowerCase();
  const linkType = String(data?.linkType || metadata.linkType || "").toLowerCase();
  const requestId =
    text(data?.requestId) ||
    text(metadata.requestId) ||
    (linkType === "request" ? text(data?.relatedId) : null);
  const keys: (readonly unknown[])[] = [notificationKeys.all];

  if (["ai", "ai-request", "insemination"].includes(type)) {
    keys.push(aiRequestKeys.all);
    keys.push(["farmer", "ai-requests"]);
    if (requestId) keys.push(aiRequestKeys.detail(requestId));
  } else if (["health", "health-request"].includes(type)) {
    keys.push(healthRequestKeys.all);
    if (requestId) keys.push(healthRequestKeys.detail(requestId));
  }

  return keys;
};

export const invalidateNotificationLinkedQueries = (
  queryClient: QueryClient,
  data: NotificationData,
) =>
  Promise.allSettled(
    getNotificationInvalidationKeys(data).map((queryKey) =>
      queryClient.invalidateQueries({ queryKey, refetchType: "active" }),
    ),
  );
