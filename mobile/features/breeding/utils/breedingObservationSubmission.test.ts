import test from "node:test";
import assert from "node:assert/strict";
import {
  createBreedingObservationSubmissionFingerprint,
  invalidateBreedingObservationQueries,
  runSingleBreedingObservationSubmission,
} from "./breedingObservationSubmission.ts";
import { submitBreedingObservation } from "../services/breedingObservation.service.ts";

const payload = {
  reportType: "unsure" as const,
  signs: ["Needs technician check"],
  notes: "Please review.",
  evidencePhotos: [],
};

test("one logical observation runs once and navigates after success", async () => {
  const lock = { current: false };
  let submitCount = 0;
  let navigationCount = 0;

  const first = runSingleBreedingObservationSubmission({
    lock,
    submit: async () => {
      submitCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { saved: true };
    },
    onSuccess: () => {
      navigationCount += 1;
    },
    onError: () => assert.fail("submission should succeed"),
  });
  const second = runSingleBreedingObservationSubmission({
    lock,
    submit: async () => {
      submitCount += 1;
      return { saved: true };
    },
    onSuccess: () => {
      navigationCount += 1;
    },
    onError: () => assert.fail("locked submission should not run"),
  });

  assert.equal(await second, false);
  assert.equal(await first, true);
  assert.equal(submitCount, 1);
  assert.equal(navigationCount, 1);
  assert.equal(lock.current, false);
});

test("failed submission stays on the form and releases the lock", async () => {
  const lock = { current: false };
  let navigationCount = 0;
  let errorCount = 0;

  const completed = await runSingleBreedingObservationSubmission({
    lock,
    submit: async () => {
      throw new Error("network unavailable");
    },
    onSuccess: () => {
      navigationCount += 1;
    },
    onError: () => {
      errorCount += 1;
    },
  });

  assert.equal(completed, false);
  assert.equal(navigationCount, 0);
  assert.equal(errorCount, 1);
  assert.equal(lock.current, false);
});

test("submission fingerprint changes when the request or payload changes", () => {
  const original = createBreedingObservationSubmissionFingerprint(
    "request-1",
    payload,
  );
  assert.equal(
    createBreedingObservationSubmissionFingerprint("request-1", payload),
    original,
  );
  assert.notEqual(
    createBreedingObservationSubmissionFingerprint("request-2", payload),
    original,
  );
  assert.notEqual(
    createBreedingObservationSubmissionFingerprint("request-1", {
      ...payload,
      notes: "Updated note.",
    }),
    original,
  );
});

test(
  "success invalidates the animal, records, AI requests, and milestones without waiting",
  () => {
    const invalidated: (readonly unknown[])[] = [];
    const neverSettles = new Promise<never>(() => {});
    const queryClient = {
      invalidateQueries: ({ queryKey }: { queryKey: readonly unknown[] }) => {
        invalidated.push(queryKey);
        return neverSettles;
      },
    };

    invalidateBreedingObservationQueries(queryClient, "animal-1");

    assert.deepEqual(invalidated, [
      ["animal", "animal-1"],
      ["animals", "detail", "animal-1"],
      ["animal-records"],
      ["ai-requests"],
      ["farmer", "ai-requests"],
      ["user", "milestones"],
      ["breeding-milestones"],
    ]);
  },
);

test("observation POST carries the logical submission idempotency key", async () => {
  let capturedUrl = "";
  let capturedHeaders: Record<string, string> | undefined;
  const api = {
    post: async (
      url: string,
      _payload: unknown,
      config?: { headers?: Record<string, string> },
    ) => {
      capturedUrl = url;
      capturedHeaders = config?.headers;
      return { data: { message: "Breeding observation saved." } };
    },
  };

  await submitBreedingObservation(
    api as never,
    "insemination-1",
    payload,
    "farmer-observation-operation-1",
  );

  assert.equal(
    capturedUrl,
    "/ai-request/insemination-1/farmer-observation",
  );
  assert.equal(
    capturedHeaders?.["Idempotency-Key"],
    "farmer-observation-operation-1",
  );
});
