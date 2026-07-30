import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith("farmerDashboard.transforms")) {
      return {
        url: pathToFileURL(
          path.join(root, "mobile/features/farmer-dashboard/utils/farmerDashboard.transforms.ts"),
        ).href,
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});

const calendar = await import(
  "../../mobile/features/technician-dashboard/utils/calendarPresentation.ts"
);
const notifications = await import(
  "../../mobile/features/notifications/utils/notificationPresentation.ts"
);
const { getQuickActionGridMetrics } = await import(
  "../../mobile/features/technician-dashboard/utils/responsiveActionGrid.ts"
);
const source = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

test("linked request and operational task become one canonical calendar visit", () => {
  const request = { id: "request-1", type: "insemination", serviceType: "Artificial Insemination", status: "scheduled", animalTag: "RC26-01" };
  const task = { id: "task-1", type: "task", status: "Pending", raw: { sourceType: "Insemination", sourceId: "request-1" } };
  const standalone = { id: "task-2", type: "task", raw: { sourceType: "manual" } };
  const result = calendar.deduplicateCalendarVisits([request, task, standalone]);
  assert.equal(result.length, 2);
  assert.equal(result[0].id, "task-1");
  assert.equal(result[0].linkedRequestId, "request-1");
  assert.equal(result[1].id, "task-2");
});

test("calendar deduplication preserves separate appointments and never matches title text", () => {
  const result = calendar.deduplicateCalendarVisits([
    { id: "request-1", type: "health", animalTag: "RC26-01", task: "Same title" },
    { id: "request-2", type: "health", animalTag: "RC26-01", task: "Same title" },
    { id: "task-1", type: "task", task: "Same title", raw: { sourceType: "manual" } },
  ]);
  assert.equal(result.length, 3);
});

test("calendar targets tasks first and formats a compact accessible animal identity", () => {
  assert.equal(calendar.getCalendarVisitTarget({ id: "task-1", type: "task" }).pathname, "/(technician)/task-details");
  assert.equal(calendar.getCalendarVisitTarget({ id: "request-1", type: "health" }).pathname, "/(technician)/request-details");
  const identity = calendar.getCalendarAnimalIdentity({ id: "1", type: "task", animalTag: "SEED-repro-manual-20260717-RC26-260717-05-AI-DAY21" });
  assert.equal(identity.compact, "RC26-05");
  assert.match(identity.full, /^SEED-repro-manual/);
});

test("structured notification events produce human-readable templates and categories", () => {
  const cases = [
    ["technician_review_required", "Observation needs review"],
    ["pregnancy_confirmed", "Pregnancy confirmed for RC26-05"],
    ["pregnancy_not_confirmed", "Pregnancy not confirmed for RC26-05"],
    ["continuation_recheck_due", "Pregnancy follow-up due"],
    ["pregnancy_continuing", "Pregnancy continuing"],
    ["pregnancy_loss", "Pregnancy loss recorded"],
    ["ai_attempt_unsuccessful", "AI attempt unsuccessful"],
    ["reinsemination_available", "Re-insemination available"],
    ["calving_recorded", "Calving recorded for RC26-05"],
  ];
  cases.forEach(([eventType, expectedTitle]) => {
    const result = notifications.presentNotification({ _id: "n", eventType, category: eventType.includes("calving") ? "calving" : "pregnancy", metadata: { animalTag: "RC26-05", attemptNumber: 1 } });
    assert.equal(result.title, expectedTitle);
    assert.doesNotMatch(`${result.title} ${result.body}`, /PREGNANCY_CONFIRMED|SEED-repro-manual/);
  });
});

test("notification deep links use structured identifiers and safely fall back", () => {
  assert.equal(notifications.getNotificationTarget({ _id: "n", taskId: "t" }, "technician").pathname, "/(technician)/task-details");
  assert.equal(notifications.getNotificationTarget({ _id: "n", requestId: "r", type: "ai-request" }, "farmer").pathname, "/(farmer)/ai-request-detail");
  assert.equal(notifications.getNotificationTarget({ _id: "n", pregnancyId: "p", animalId: "a" }, "farmer").pathname, "/(farmer)/pregnancy-tracker");
  assert.equal(notifications.getNotificationTarget({ _id: "n" }, "farmer").pathname, "/notification-details");
});

test("legacy notification fallback removes seed prefixes and raw lifecycle enums", () => {
  const result = notifications.presentNotification({
    _id: "legacy",
    title: "SEED-repro-manual-20260717-Pregnancy update",
    message: "Result: NEEDS_RECHECK",
  });
  assert.equal(result.title, "Pregnancy update");
  assert.equal(result.body, "Result: Follow-up required");
});

test("notification open behavior preserves mark-read and handles missing identifiers", () => {
  const listSource = source("mobile/app/notifications.tsx");
  const controllerSource = source("backend/src/controllers/notification.controllers.js");
  assert.match(listSource, /mark-read[\s\S]*openNotification\(item\)/);
  assert.match(controllerSource, /notificationId, recipientId: req\.user\._id/);
  assert.match(listSource, /getNotificationTarget\(item, role\)/);
});

test("Technician dashboard padding remains responsive while Quick Actions scroll horizontally", () => {
  const expected = [[320, 2, 16, 12], [360, 2, 16, 12], [390, 2, 16, 12], [768, 3, 24, 16], [1024, 4, 24, 16]];
  expected.forEach(([width, columns, padding, gap]) => {
    const metrics = getQuickActionGridMetrics(width);
    assert.equal(metrics.columns, columns);
    assert.equal(metrics.screenPadding, padding);
    assert.equal(metrics.gap, gap);
    assert.ok(metrics.itemWidth > 0);
  });
  const quickActions = source("mobile/features/technician-dashboard/components/TechnicianQuickActions.tsx");
  assert.doesNotMatch(quickActions, /width:\s*["']30%["']/);
  assert.match(quickActions, /<ScrollView[\s\S]*?horizontal/);
  assert.match(quickActions, /width:\s*136/);
  assert.match(quickActions, /minHeight:\s*112/);
});

test("Batch C screens preserve touch targets, safe-area padding, flexible text, and theme-aware details", () => {
  const calendarSource = source("mobile/features/technician-dashboard/screens/TechnicianScheduleScreen.tsx");
  const listSource = source("mobile/app/notifications.tsx");
  const detailSource = source("mobile/app/notification-details.tsx");
  assert.match(calendarSource, /insets\.bottom \+ 92/);
  assert.match(calendarSource, /insets\.bottom \+ 24/);
  assert.match(listSource, /insets\.bottom \+ 96/);
  assert.match(detailSource, /isDark \? "light-content" : "dark-content"/);
  assert.match(detailSource, /accessibilityLabel="Go back"/);
  assert.match(listSource, /minWidth:\s*0/);
});

test("semantic badges retain distinct dark-mode surfaces instead of the page background", () => {
  const badgeSource = source("mobile/components/ui/Badge.tsx");
  const themeSource = source("mobile/lib/theme.ts");
  assert.match(badgeSource, /colors\.errorContainer/);
  assert.match(badgeSource, /colors\.warningContainer/);
  assert.match(badgeSource, /colors\.successContainer/);
  assert.match(themeSource, /errorContainer: "#ef44442e"/);
  assert.match(themeSource, /warningContainer: "#f59e0b2e"/);
  assert.match(themeSource, /successContainer: "#10b9812e"/);
  assert.doesNotMatch(badgeSource, /backgroundColor:\s*colors\.background/);
});
