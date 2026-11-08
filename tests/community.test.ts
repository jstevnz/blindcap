import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  profileFields,
  checkPassword,
  publicProfile,
  historyFor,
  type Profile,
} from "../lib/community";
import {
  createEvent,
  applyCommand,
  snapshot,
  authorized,
  type Actor,
} from "../lib/engine";
const host = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "host@example.com",
};
const member = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "member@example.com",
};
function setup() {
  let e = createEvent(host.id, "Private community night", 2);
  e = applyCommand(e, host, {
    type: "setup",
    participants: [
      { name: "Member", email: member.email, accountId: member.id },
      { name: "Host", email: host.email, accountId: host.id },
    ],
    bottles: [
      { name: "Member bottle", ownerIndex: 0 },
      { name: "Host bottle", ownerIndex: 1 },
    ],
  });
  return applyCommand(e, host, { type: "start" });
}
test("profile validation normalizes usernames and rejects invalid or oversized fields", () => {
  assert.deepEqual(
    profileFields({
      username: " Bourbon_One ",
      displayName: " Alice ",
      bio: " Rye ",
    }),
    {
      username: "bourbon_one",
      display_name: "Alice",
      bio: "Rye",
      discoverable: true,
    },
  );
  for (const username of ["ab", "1alice", "alice@example.com", "a".repeat(25)])
    assert.throws(() => profileFields({ username, displayName: "Alice" }));
  assert.throws(() => profileFields({ username: "alice", displayName: " " }));
  assert.throws(() =>
    profileFields({
      username: "alice",
      displayName: "Alice",
      bio: "x".repeat(501),
    }),
  );
  assert.equal(
    profileFields({
      username: "alice",
      displayName: "Alice",
      discoverable: false,
    }).discoverable,
    false,
  );
  assert.throws(() => checkPassword("short"));
  checkPassword("a long private password");
});
test("searchable profiles never include private email, role or membership status", () => {
  const p: Profile = {
    id: member.id,
    username: "alice",
    display_name: "Alice",
    email: member.email,
    bio: "Rye fan",
    discoverable: true,
    role: "owner",
    status: "active",
  };
  assert.deepEqual(publicProfile(p), {
    id: member.id,
    username: "alice",
    displayName: "Alice",
    bio: "Rye fan",
  });
});
test("selecting a member requires accepted seat access, even when email matches", () => {
  const e = setup();
  assert.equal(authorized(e, member), false);
  const accepted = { ...member, guestParticipantId: e.participants[0].id };
  assert.equal(authorized(e, accepted), true);
  const s = snapshot(e, accepted);
  assert.equal(s.admin, false);
  assert.equal(s.participantId, e.participants[0].id);
  assert.ok(s.bottles.every((b) => !("name" in b)));
  assert.ok(
    s.participants.every((p) => !("email" in p) && !("accountId" in p)),
  );
  assert.throws(() => snapshot(e, member));
});
test("community ownership never grants administration of another member’s event", () => {
  const e = setup();
  const communityOwner = {
    ...member,
    role: "owner",
    guestParticipantId: e.participants[0].id,
  };
  assert.equal(snapshot(e, communityOwner).admin, false);
  assert.throws(
    () =>
      applyCommand(e, communityOwner, {
        type: "open",
        groupId: e.groups[0].id,
      }),
    /admin/,
  );
  assert.equal(
    snapshot(e, { ...host, guestParticipantId: e.participants[1].id }).admin,
    true,
  );
});
test("a member cannot occupy two bottle seats", () => {
  const e = createEvent(host.id, "Duplicates", 2);
  assert.throws(
    () =>
      applyCommand(e, host, {
        type: "setup",
        participants: [
          { name: "A", email: "a@example.com", accountId: member.id },
          { name: "B", email: "b@example.com", accountId: member.id },
        ],
        bottles: [
          { name: "A", ownerIndex: 0 },
          { name: "B", ownerIndex: 1 },
        ],
      }),
    /one seat/,
  );
});
test("permanent history includes only own ballots and own bottle after reveal", () => {
  let e = setup();
  const actors: Actor[] = [
    { ...member, guestParticipantId: e.participants[0].id },
    { ...host, guestParticipantId: e.participants[1].id },
  ];
  assert.equal(historyFor(e, actors[0]), null);
  const g = e.groups[0];
  e = applyCommand(e, host, { type: "open", groupId: g.id });
  for (const actor of actors)
    e = applyCommand(e, actor, {
      type: "ballot",
      groupId: g.id,
      entries: g.bottleIds.map((bottleId, i) => ({
        bottleId,
        rank: i + 1,
        aroma: 9 - i,
        flavor: 8 - i,
        smoothness: 7 - i,
        enjoyment: 9 - i,
      })),
    });
  e = applyCommand(e, host, { type: "close", groupId: g.id });
  e = applyCommand(e, host, { type: "finish" });
  assert.equal(e.phase, "complete");
  assert.equal(historyFor(e, actors[0]), null);
  e = applyCommand(e, host, { type: "reveal" });
  const h = historyFor(e, actors[0])!;
  assert.equal(h.bottle?.name, "Member bottle");
  assert.equal(h.ballots.length, 1);
  assert.equal(h.ballots[0].entries.length, 2);
  assert.deepEqual(
    h.ballots[0].entries.map((x) => x.rank),
    [1, 2],
  );
  assert.ok(h.ballots[0].entries.every((x) => x.bottleName));
  assert.equal("participantId" in h.ballots[0], false);
  assert.throws(() =>
    historyFor(e, { id: "outsider", email: "outside@example.com" }),
  );
  assert.equal(historyFor(e, actors[1])?.bottle?.name, "Host bottle");
});
test("community helpers remain identical on the server and scoring service", () => {
  const local = readFileSync(
    new URL("../lib/community.ts", import.meta.url),
    "utf8",
  );
  const edge = readFileSync(
    new URL(
      "../supabase/functions/bourbon-api/community-shared.ts",
      import.meta.url,
    ),
    "utf8",
  ).replaceAll('"./engine.ts"', '"./engine"');
  assert.equal(edge, local);
});
