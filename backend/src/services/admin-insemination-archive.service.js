import { Calving } from "../models/calving.model.js";
import { Insemination } from "../models/insemination.model.js";
import { Pregnancy } from "../models/pregnancy.model.js";
import { AppError } from "../utils/app-error.js";
import { createAuditLog } from "./audit.service.js";

const assertAdmin = (actor) => {
  if (actor?.role === "admin") return;
  throw new AppError("Only administrators can archive AI records.", {
    status: 403,
    code: "ADMIN_ARCHIVE_REQUIRED",
  });
};

export const archiveInseminationAsAdmin = async ({ id, actor }) => {
  assertAdmin(actor);

  const insemination = await Insemination.findById(id);
  if (!insemination) {
    throw new AppError("Insemination record not found", {
      status: 404,
      code: "INSEMINATION_NOT_FOUND",
    });
  }

  if (insemination.status === "done" || insemination.completedAt) {
    throw new AppError(
      "Completed AI service records are official history and cannot be archived.",
      {
        status: 409,
        code: "INSEMINATION_ARCHIVE_COMPLETED_RECORD",
      },
    );
  }

  const laterAttemptFilter = {
    _id: { $ne: id },
    deletedAt: null,
    $or: [
      { previousAttemptId: id },
      ...(insemination.attemptSeriesId
        ? [{ attemptSeriesId: insemination.attemptSeriesId }]
        : []),
    ],
  };

  const [linkedPregnancy, linkedCalving, laterAttempt] = await Promise.all([
    Pregnancy.exists({ inseminationId: id, deletedAt: null }),
    Calving.exists({ inseminationId: id, deletedAt: null }),
    Insemination.exists(laterAttemptFilter),
  ]);
  if (linkedPregnancy || linkedCalving || laterAttempt) {
    throw new AppError(
      "This AI record has linked breeding history and cannot be archived.",
      {
        status: 409,
        code: "INSEMINATION_ARCHIVE_LINKED_HISTORY",
      },
    );
  }

  const beforeState = { deletedAt: insemination.deletedAt };
  const archivedInsemination = await Insemination.findOneAndUpdate(
    {
      _id: id,
      deletedAt: null,
      status: { $ne: "done" },
      completedAt: null,
    },
    {
      $set: { deletedAt: new Date() },
      $unset: { activeRequestKey: 1 },
    },
    { returnDocument: "after" },
  );
  if (!archivedInsemination) {
    throw new AppError(
      "This AI record changed while it was being archived. Refresh and try again.",
      {
        status: 409,
        code: "INSEMINATION_ARCHIVE_CONFLICT",
      },
    );
  }

  await createAuditLog({
    entityType: "Insemination",
    entityId: archivedInsemination._id,
    action: "delete_insemination",
    actorId: actor._id,
    before: beforeState,
    after: { deletedAt: archivedInsemination.deletedAt },
    metadata: {
      actingAdmin: actor.email || actor.name,
      timestamp: new Date().toISOString(),
    },
  });

  return archivedInsemination;
};
