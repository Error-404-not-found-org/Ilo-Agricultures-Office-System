import assert from "node:assert/strict";
import test from "node:test";

import {
  TECHNICIAN_MY_WORK_COMPLETED_TARGET,
  runConfirmedHealthResponseSubmission,
} from "./healthResponseSubmission.ts";

test("targets the canonical Technician My Work completed view", () => {
  assert.deepEqual(TECHNICIAN_MY_WORK_COMPLETED_TARGET, {
    pathname: "/(technician)/(tabs)/technician.requests",
    params: { section: "myWork", workState: "completed" },
  });
});

test("acknowledges and navigates only after submit and refresh complete", async () => {
  const order: string[] = [];
  let releaseSubmit!: () => void;
  let releaseRefresh!: () => void;
  const submitGate = new Promise<void>((resolve) => {
    releaseSubmit = resolve;
  });
  const refreshGate = new Promise<void>((resolve) => {
    releaseRefresh = resolve;
  });

  const pending = runConfirmedHealthResponseSubmission({
    submit: async () => {
      order.push("submit:start");
      await submitGate;
      order.push("submit:done");
      return { ok: true };
    },
    refresh: async () => {
      order.push("refresh:start");
      await refreshGate;
      order.push("refresh:done");
    },
    acknowledge: () => order.push("acknowledge"),
    navigate: () => order.push("navigate"),
  });

  await Promise.resolve();
  assert.deepEqual(order, ["submit:start"]);
  releaseSubmit();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(order, ["submit:start", "submit:done", "refresh:start"]);
  releaseRefresh();

  assert.deepEqual(await pending, { ok: true });
  assert.deepEqual(order, [
    "submit:start",
    "submit:done",
    "refresh:start",
    "refresh:done",
    "acknowledge",
    "navigate",
  ]);
});

test("does not refresh, acknowledge, or navigate when submit fails", async () => {
  const calls: string[] = [];

  await assert.rejects(
    runConfirmedHealthResponseSubmission({
      submit: async () => {
        throw new Error("network unavailable");
      },
      refresh: async () => {
        calls.push("refresh");
      },
      acknowledge: () => calls.push("acknowledge"),
      navigate: () => calls.push("navigate"),
    }),
    /network unavailable/,
  );

  assert.deepEqual(calls, []);
});

test("does not acknowledge or navigate before refresh succeeds", async () => {
  const calls: string[] = [];

  await assert.rejects(
    runConfirmedHealthResponseSubmission({
      submit: async () => ({ ok: true }),
      refresh: async () => {
        calls.push("refresh");
        throw new Error("refresh failed");
      },
      acknowledge: () => calls.push("acknowledge"),
      navigate: () => calls.push("navigate"),
    }),
    /refresh failed/,
  );

  assert.deepEqual(calls, ["refresh"]);
});
