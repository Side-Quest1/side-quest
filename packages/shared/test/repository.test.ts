import assert from "node:assert/strict";
import test from "node:test";
import { MockQuestRepository } from "../src/repository.ts";
import type { SideQuest } from "../src/types.ts";
import { validateQuestCreation, validateQuestFilter } from "../src/validation.ts";

const makeQuest = (overrides: Partial<SideQuest> = {}): SideQuest => ({
  id: "quest-test",
  title: "Test quest",
  description: "A test activity",
  category: "social",
  hostId: "host",
  date: "2026-11-20",
  startTime: "10:00",
  endTime: "12:00",
  locationLabel: "Test location",
  capacity: 2,
  participantIds: ["host"],
  visibility: "public",
  joinMode: "instant",
  minimumAge: 16,
  status: "open",
  featured: false,
  createdAt: "2026-10-30T00:00:00Z",
  ...overrides,
});

test("instant joins enforce capacity and reject duplicate members", async () => {
  const repository = new MockQuestRepository([makeQuest()]);

  await repository.joinQuest("quest-test", "member");
  await assert.rejects(() => repository.joinQuest("quest-test", "member"), /already part/);
  await assert.rejects(() => repository.joinQuest("quest-test", "another"), /full/);

  const quest = await repository.getQuestById("quest-test");
  assert.equal(quest?.status, "full");
  assert.deepEqual(quest?.participantIds, ["host", "member"]);
});

test("approval joins create pending participants and host approval fills capacity", async () => {
  const repository = new MockQuestRepository([
    makeQuest({ joinMode: "approval", capacity: 2 }),
  ]);

  await assert.rejects(() => repository.joinQuest("quest-test", "member"), /approval request/);
  const request = await repository.requestToJoin("quest-test", "member");
  assert.equal(request.status, "pending");

  await assert.rejects(() => repository.approveRequest("quest-test", request.id, "member"), /Only the host/);
  const approved = await repository.approveRequest("quest-test", request.id, "host");
  assert.equal(approved.status, "accepted");
  assert.equal((await repository.getQuestById("quest-test"))?.status, "full");
});

test("leaving removes membership and preserves host permissions", async () => {
  const repository = new MockQuestRepository([
    makeQuest({ capacity: 3, participantIds: ["host", "member"] }),
  ]);

  await repository.leaveQuest("quest-test", "member");
  assert.deepEqual((await repository.getQuestById("quest-test"))?.participantIds, ["host"]);
  await assert.rejects(() => repository.leaveQuest("quest-test", "host"), /host cannot leave/);
});

test("only the host can complete an active quest", async () => {
  const repository = new MockQuestRepository([makeQuest()]);

  await assert.rejects(() => repository.completeQuest("quest-test", "member"), /Only the host/);
  const completed = await repository.completeQuest("quest-test", "host");
  assert.equal(completed.status, "completed");
  await assert.rejects(() => repository.joinQuest("quest-test", "late-member"), /no longer active/);
});

test("host management supports cancel, hosted/joined views, and recaps", async () => {
  const repository = new MockQuestRepository([
    makeQuest({ hostId: "host", participantIds: ["host", "member"] }),
  ]);
  await assert.rejects(() => repository.cancelQuest("quest-test", "member"), /Only the host/);
  await repository.cancelQuest("quest-test", "host");
  assert.equal((await repository.getHostedQuests("host")).length, 1);
  assert.equal((await repository.getJoinedQuests("member")).length, 1);

  const completedRepository = new MockQuestRepository([makeQuest()]);
  await completedRepository.completeQuest("quest-test", "host");
  const recap = await completedRepository.getActivityRecap("quest-test");
  assert.equal(recap?.participantCount, 1);
});

test("coordination supports local chat, participant status, reports, and blocks", async () => {
  const repository = new MockQuestRepository([
    makeQuest({ participantIds: ["host", "member"] }),
  ]);
  const message = await repository.sendMessage("quest-test", "member", "Meet at the main gate");
  assert.equal((await repository.getMessages("quest-test", "host"))[0]?.body, message.body);
  const participants = await repository.getParticipants("quest-test");
  const member = participants.find((item) => item.userId === "member");
  assert.ok(member);
  const updated = await repository.updateParticipantStatus("quest-test", member.id, "left", "host");
  assert.equal(updated.status, "left");
  const report = await repository.reportUser({ reportedUserId: "member", questId: "quest-test", reason: "Test report" }, "host");
  assert.equal(report.reporterId, "host");
  await repository.blockUser("host", "member");
  assert.deepEqual(await repository.getMessages("quest-test", "host"), []);
  await assert.rejects(() => repository.sendMessage("quest-test", "host", "   "), /cannot be empty/);
});

test("profile, settings, blocked users, and report history remain locally editable", async () => {
  const repository = new MockQuestRepository([
    makeQuest({ hostId: "user-me", participantIds: ["user-me", "member"], status: "completed" }),
  ]);
  const profile = await repository.updateProfile("user-me", { displayName: "Updated Host", city: "Mysuru" });
  assert.equal(profile.displayName, "Updated Host");
  assert.equal((await repository.getProfile("user-me"))?.city, "Mysuru");
  const settings = await repository.updateAccountSettings("user-me", {
    theme: "dark",
    notifications: { chatMessages: false, questUpdates: true, reminders: false },
  });
  assert.equal(settings.theme, "dark");
  assert.equal(settings.notifications.chatMessages, false);
  await repository.blockUser("user-me", "member");
  assert.equal((await repository.getBlockedUsers("user-me")).length, 1);
  await repository.unblockUser("user-me", "member");
  assert.equal((await repository.getBlockedUsers("user-me")).length, 0);
  await repository.reportUser({ reportedUserId: "member", reason: "Test report" }, "user-me");
  assert.equal((await repository.getReports("user-me"))[0]?.status, "submitted");
});

test("validation rejects unsafe quest inputs and invalid filters", () => {
  const invalid = validateQuestCreation({
    title: " ",
    description: "",
    category: "social",
    hostId: "user-me",
    date: "2026-11-20",
    startTime: "12:00",
    endTime: "10:00",
    locationLabel: "",
    capacity: 1,
    visibility: "public",
    joinMode: "instant",
    minimumAge: 15,
    featured: false,
  });
  assert.equal(invalid.success, false);
  assert.equal(validateQuestFilter({ maxCost: -1 }).success, false);
});
