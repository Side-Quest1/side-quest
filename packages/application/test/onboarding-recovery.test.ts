import { test } from "node:test";
import assert from "node:assert/strict";
import { finishOnboarding, onboardingKey } from "../src/onboarding-recovery";

test("setup checkpoints are isolated by account", () => {
  assert.notEqual(onboardingKey("alice"), onboardingKey("bob"));
});

test("profile becomes complete only after preferences and verification", async () => {
  const calls: string[] = [];
  const step = (name: string) => async () => { calls.push(name); };
  await finishOnboarding({ checkpoint: step("checkpoint"), preferences: step("preferences"), verification: step("verification"), profile: step("profile"), clear: step("clear") });
  assert.deepEqual(calls, ["checkpoint", "preferences", "verification", "profile", "clear"]);
});

for (const failure of ["checkpoint", "preferences", "verification", "profile", "clear"]) {
  test(`failure at ${failure} stops subsequent writes and permits retry`, async () => {
    const calls: string[] = [];
    let fail = true;
    const step = (name: string) => async () => {
      calls.push(name);
      if (fail && name === failure) throw new Error(name);
    };
    const steps = { checkpoint: step("checkpoint"), preferences: step("preferences"), verification: step("verification"), profile: step("profile"), clear: step("clear") };
    await assert.rejects(finishOnboarding(steps), new RegExp(failure));
    assert.equal(calls.at(-1), failure);
    if (failure !== "clear") assert.ok(!calls.includes("clear"));
    fail = false;
    calls.length = 0;
    await finishOnboarding(steps);
    assert.deepEqual(calls, ["checkpoint", "preferences", "verification", "profile", "clear"]);
  });
}
