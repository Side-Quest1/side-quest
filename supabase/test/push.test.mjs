import { test } from "node:test";
import assert from "node:assert/strict";
import { dispatch } from "../functions/deliver-alerts/dispatch.mjs";
test("Expo tickets, receipts, invalid tokens and delayed receipts use distinct acknowledgements", async () => {
  const acks = [];
  await dispatch(
    [
      { id: 1, token: "one" },
      { id: 2, token: "two" },
      { id: 3, ticket: "complete" },
      { id: 4, ticket: "delayed" },
    ],
    async (action) =>
      action === "send"
        ? [
            { status: "ok", id: "ticket" },
            { status: "error", details: { error: "DeviceNotRegistered" } },
          ]
        : { complete: { status: "ok" } },
    async (job, outcome, ticket) => acks.push([job.id, outcome, ticket]),
  );
  assert.deepEqual(acks, [
    [3, "delivered", null],
    [4, "retry", null],
    [1, "ticket", "ticket"],
    [2, "invalid_device", null],
  ]);
});
