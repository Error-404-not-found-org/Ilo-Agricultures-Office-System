import React from "react";
import {
  CalendarDays,
  CheckCircle2,
  MapPin,
  MessageSquare,
  PackageCheck,
  Pill,
  TriangleAlert,
  UserRound,
} from "lucide-react-native";

import { useTheme } from "@/lib/theme";
import { RequestDetailCard, RequestDetailRow } from "./RequestDetailPrimitives";
import {
  formatVisitSchedule,
  getRequestText,
} from "../utils/requestDetailPresentation";
import { getHealthOfficePickupPresentation } from "../utils/healthOfficePickupPresentation";

const firstText = (...values: unknown[]) => {
  for (const value of values) {
    const text = getRequestText(value);
    if (text) return text;
  }
  return null;
};

const formatDate = (value: unknown) => {
  const text = getRequestText(value);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleDateString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

export function HealthRequestResponseSections({ request }: { request: any }) {
  const { colors } = useTheme();
  const handlingMethod = getRequestText(request?.handlingMethod)?.toLowerCase();
  const status = getRequestText(request?.status)?.toLowerCase();
  const advice = firstText(request?.adviceForFarmer, request?.advice);
  const followUpDate = formatDate(request?.followUpDate);
  const officePickup = getHealthOfficePickupPresentation(request);

  const handler = request?.assignedTechnicianId || request?.handledBy;
  const technicianName =
    typeof handler === "object" ? firstText(handler?.name) : null;
  const farmer =
    request?.farmerId && typeof request.farmerId === "object"
      ? request.farmerId
      : null;
  const scheduledDate = formatVisitSchedule(
    request?.scheduledDate,
    request?.visitPeriod,
  );
  const location = firstText(
    request?.farmLocationLabel,
    request?.locationLabel,
    farmer?.farmLocation?.detectedAddress,
    [
      request?.dispatch?.location?.barangayName,
      request?.dispatch?.location?.municipalityName,
      request?.dispatch?.location?.provinceName,
    ]
      .map((value) => firstText(value))
      .filter(Boolean)
      .join(", "),
    request?.farmLocation,
    request?.location,
  );

  const hasAdvice =
    handlingMethod === "advice"
      ? Boolean(advice || followUpDate)
      : !handlingMethod
        ? Boolean(advice)
        : false;
  const hasVisit = status === "scheduled" && Boolean(scheduledDate);

  if (!hasAdvice && !officePickup && !hasVisit) return null;

  return (
    <>
      {hasAdvice ? (
        <RequestDetailCard
          title="Advice"
          description="A technician responded to your request. This is guidance, not a recorded farm treatment."
        >
          {advice ? (
            <RequestDetailRow
              icon={<MessageSquare size={17} color={colors.primary} />}
              label="Advice"
              value={advice}
              isLast={!followUpDate && !technicianName}
            />
          ) : null}
          {followUpDate ? (
            <RequestDetailRow
              icon={<CalendarDays size={17} color={colors.primary} />}
              label="Follow-up date"
              value={followUpDate}
              isLast={!technicianName}
            />
          ) : null}
          {technicianName ? (
            <RequestDetailRow
              icon={<UserRound size={17} color={colors.primary} />}
              label="Technician"
              value={technicianName}
              isLast
            />
          ) : null}
        </RequestDetailCard>
      ) : null}

      {officePickup ? (
        <RequestDetailCard
          title="Office pickup"
          description="Pickup information was sent. Availability is confirmed; collection is not recorded."
        >
          {officePickup.item ? (
            <RequestDetailRow
              icon={<PackageCheck size={17} color={colors.primary} />}
              label="Item"
              value={officePickup.item}
            />
          ) : null}
          {officePickup.availabilityConfirmed ? (
            <RequestDetailRow
              icon={<CheckCircle2 size={17} color={colors.success} />}
              label="Availability"
              value="Available for pickup"
            />
          ) : null}
          {officePickup.instructions ? (
            <RequestDetailRow
              icon={<MapPin size={17} color={colors.primary} />}
              label="Pickup instructions"
              value={officePickup.instructions}
            />
          ) : null}
          {officePickup.farmerMessage ? (
            <RequestDetailRow
              icon={<MessageSquare size={17} color={colors.primary} />}
              label="Message from technician"
              value={officePickup.farmerMessage}
            />
          ) : null}
          {officePickup.dosageOrUseInstructions ? (
            <RequestDetailRow
              icon={<Pill size={17} color={colors.primary} />}
              label="Dosage / Use"
              value={officePickup.dosageOrUseInstructions}
            />
          ) : null}
          {officePickup.withdrawalGuidance ? (
            <RequestDetailRow
              icon={<TriangleAlert size={17} color={colors.warning} />}
              label="Withdrawal guidance"
              value={officePickup.withdrawalGuidance}
            />
          ) : null}
          {officePickup.followUpDate ? (
            <RequestDetailRow
              icon={<CalendarDays size={17} color={colors.primary} />}
              label="Follow-up"
              value={officePickup.followUpDate}
              isLast={!technicianName}
            />
          ) : null}
          {technicianName ? (
            <RequestDetailRow
              icon={<UserRound size={17} color={colors.primary} />}
              label="Technician"
              value={technicianName}
              isLast
            />
          ) : null}
        </RequestDetailCard>
      ) : null}

      {hasVisit ? (
        <RequestDetailCard
          title="Farm visit scheduled"
          description="Your confirmed visit details. Please make sure someone is available to assist."
        >
          <RequestDetailRow
            icon={<CalendarDays size={17} color={colors.primary} />}
            label="Date and period"
            value={scheduledDate!}
            isLast={!technicianName && !location}
          />
          {technicianName ? (
            <RequestDetailRow
              icon={<UserRound size={17} color={colors.primary} />}
              label="Technician"
              value={technicianName}
              isLast={!location}
            />
          ) : null}
          {location ? (
            <RequestDetailRow
              icon={<MapPin size={17} color={colors.primary} />}
              label="Location"
              value={location}
              isLast
            />
          ) : null}
        </RequestDetailCard>
      ) : null}
    </>
  );
}
