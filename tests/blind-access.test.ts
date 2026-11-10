import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createEvent,
  applyCommand,
  snapshot,
  isEventAdmin,
} from "../lib/engine";
import { blindAccessChange, isBlindLocked } from "../lib/blind-access";
import { eventSummary } from "../lib/event-management";
import {
  canManageTeam,
  setCoAdmins,
  mailingList,
  eventTeam,
} from "../supabase/functions/bourbon-api/event-team";
import type { Profile } from "../lib/community";
import type { SupabaseClient } from "@supabase/supabase-js";
const owner = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "owner@example.com",
  },
  kim = {
    id: "22222222-2222-4222-8222-222222222222",
    email: "kim@example.com",
  },
  other = {
    id: "33333333-3333-4333-8333-333333333333",
    email: "other@example.com",
  };
const membership = { id: owner.id, status: "active", role: "owner" } as Profile;
const at = "2026-11-10T04:00:00Z";
function lock() {
  const e = createEvent(owner.id, "Blind night", 2);
  return blindAccessChange(
    e,
    owner,
    membership,
    {
      operation: "lock",
      revision: 0,
      title: e.title,
      confirmed: true,
      coordinatorId: kim.id,
    },
    at,
  );
}
test("blind primary host has only taster access while the appointed coordinator can run the event", async () => {
  let e = lock();
  assert.equal(isBlindLocked(e, owner.id), true);
  assert.equal(isEventAdmin(e, owner), false);
  assert.equal(isEventAdmin(e, kim), true);
  e = applyCommand(e, kim, {
    type: "setup",
    participants: [
      { name: "Host taster", email: owner.email },
      { name: "Other", email: other.email },
    ],
    bottles: [
      { name: "SECRET ONE", ownerIndex: 0 },
      { name: "SECRET TWO", ownerIndex: 1 },
    ],
  });
  const s = snapshot(e, owner);
  assert.equal(s.admin, false);
  assert.equal(s.blindParticipation, "blind");
  assert.equal(s.participantId, e.participants[0].id);
  assert.ok(!JSON.stringify(s.bottles).includes("SECRET"));
  assert.ok(s.participants.every((p) => !("email" in p)));
  assert.equal(s.results, null);
  assert.throws(() => applyCommand(e, owner, { type: "start" }), /admin/);
  assert.equal(canManageTeam(e, owner, membership), false);
  assert.throws(
    () => setCoAdmins(e, owner, membership, [], e.revision),
    /primary host/,
  );
  await assert.rejects(
    mailingList({} as SupabaseClient, e, owner),
    /Only this event/,
  );
  await assert.rejects(
    eventTeam({} as SupabaseClient, e, owner, membership),
    /Only event admins/,
  );
  e=applyCommand(e,kim,{type:"start"});
  const group=e.groups[0];e=applyCommand(e,kim,{type:"open",groupId:group.id});
  e=applyCommand(e,owner,{type:"ballot",groupId:group.id,entries:group.bottleIds.map((bottleId,i)=>({bottleId,rank:i+1,aroma:7,flavor:7,smoothness:7,enjoyment:7}))});
  assert.equal(e.groups[0].ballots.length,1);
  const recovered=blindAccessChange(e,owner,membership,{operation:"unlock",revision:e.revision,title:e.title,confirmed:true},at);
  assert.deepEqual(recovered.groups,e.groups);
  const card = eventSummary(e, at, "Host", owner, membership);
  assert.equal(card.canDelete, false);
  assert.equal(card.canUnlockBlind, true);
  assert.equal(card.canOpen, true);
  assert.ok(!JSON.stringify(card).includes("SECRET"));
});
test("emergency unlock is explicit, revision-checked, audited and cannot be disguised as blind again", () => {
  const e = lock();
  assert.throws(() =>
    blindAccessChange(
      e,
      owner,
      membership,
      {
        operation: "unlock",
        title: e.title,
        revision: e.revision,
        confirmed: false,
      },
      at,
    ),
  );
  assert.throws(() =>
    blindAccessChange(
      e,
      owner,
      membership,
      { operation: "unlock", title: e.title, revision: 0, confirmed: true },
      at,
    ),
  );
  const recovered = blindAccessChange(
    e,
    owner,
    membership,
    {
      operation: "unlock",
      title: e.title,
      revision: e.revision,
      confirmed: true,
    },
    at,
  );
  assert.equal(isEventAdmin(recovered, owner), true);
  assert.equal(isEventAdmin(recovered, kim), true);
  assert.equal(recovered.blindAccessLog?.at(-1)?.action, "unlock");
  assert.equal(recovered.blindAccessLog?.at(-1)?.actorId, owner.id);
  assert.equal(recovered.blindAccessLog?.at(-1)?.at, at);
  assert.deepEqual(recovered.groups, e.groups);
  assert.throws(
    () =>
      blindAccessChange(
        recovered,
        owner,
        membership,
        {
          operation: "lock",
          revision: recovered.revision,
          title: e.title,
          confirmed: true,
          coordinatorId: kim.id,
        },
        at,
      ),
    /cannot be marked blind/,
  );
  const card = eventSummary(recovered, at, "Host", owner, membership);
  assert.equal(card.canLockBlind, false);
  assert.equal(card.blindParticipation, "unlocked");
});
test("site owner can recover an event coordinated by someone else, ordinary tasters cannot unlock", () => {
  const e = createEvent(kim.id, "Kim coordinates", 2);
  const locked = blindAccessChange(
    e,
    owner,
    membership,
    {
      operation: "lock",
      revision: 0,
      title: e.title,
      confirmed: true,
      coordinatorId: kim.id,
    },
    at,
  );
  assert.equal(isEventAdmin(locked, owner), false);
  assert.throws(
    () =>
      blindAccessChange(
        locked,
        other,
        { status: "active", role: "member" },
        { operation: "unlock", title: e.title, revision: 1, confirmed: true },
        at,
      ),
    /primary host or site owner/,
  );
  const unlocked = blindAccessChange(
    locked,
    owner,
    membership,
    { operation: "unlock", title: e.title, revision: 1, confirmed: true },
    at,
  );
  assert.equal(unlocked.ownerId, kim.id);
  assert.equal(isEventAdmin(unlocked, owner), true);
  assert.equal(canManageTeam(unlocked, owner, membership), true);
});
test("blind lock cannot start after bottle entry or without another coordinator", () => {
  const e = createEvent(owner.id, "Test", 2);
  const input = {
    operation: "lock",
    revision: 0,
    title: e.title,
    confirmed: true,
    coordinatorId: owner.id,
  };
  assert.throws(
    () => blindAccessChange(e, owner, membership, input, at),
    /another approved/,
  );
  e.bottles = [
    { id: "one", number: 1, name: "Already entered", ownerId: "seat" },
  ];
  assert.throws(
    () =>
      blindAccessChange(
        e,
        owner,
        membership,
        { ...input, coordinatorId: kim.id },
        at,
      ),
    /before any bottles/,
  );
  const locked = lock();
  assert.throws(
    () =>
      setCoAdmins(
        locked,
        kim,
        { ...membership, id: kim.id, role: "owner" },
        [owner.id],
        1,
      ),
    /blind participant/,
  );
});
test("blind access policy is identical in the tested app and deployed backend", async () => {
  assert.equal(
    await readFile(new URL("../lib/blind-access.ts", import.meta.url), "utf8"),
    await readFile(
      new URL(
        "../supabase/functions/bourbon-api/blind-access.ts",
        import.meta.url,
      ),
      "utf8",
    ),
  );
});
