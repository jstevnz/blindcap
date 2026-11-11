import test from "node:test";
import assert from "node:assert/strict";
import {
  createEvent,
  applyCommand,
  snapshot,
  authorized,
  type Event,
  type Actor,
} from "../lib/engine";
const host = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "host@example.com",
};
function setup(count = 3) {
  let e = createEvent(host.id, "Invite first", count);
  e.workflowVersion = 2;
  for (let slot = 0; slot < count; slot++)
    e = applyCommand(e, host, {
      type: "roster-seat",
      slot,
      firstName: "Taster",
      lastName: String(slot),
      email: `t${slot}@example.com`,
      accountId: `22222222-2222-4222-8222-${String(slot).padStart(12, "0")}`,
    });
  return e;
}
function participant(e: Event, i: number): Actor {
  return {
    id: e.participants[i].accountId!,
    email: e.participants[i].email,
    guestParticipantId: e.participants[i].id,
  };
}
function bottles(e: Event) {
  for (let i = 0; i < e.participants.length; i++)
    e = applyCommand(e, participant(e, i), {
      type: "bottle-entry",
      name: `Private bottle ${i}`,
      distillery: "Private distillery",
      proof: 100 + i,
    });
  return e;
}
test("roster saves are separate from bottle entry and preserve existing seats and submissions", () => {
  let e = setup();
  assert.equal(e.bottles.length, 0);
  const seat = e.participants[0].id;
  e = applyCommand(e, host, { type: "invite-roster" });
  e = bottles(e);
  const bottle = e.bottles.find((b) => b.ownerId === seat)!;
  const p = e.participants[0];
  e = applyCommand(e, host, {
    type: "roster-seat",
    slot: 0,
    firstName: p.firstName,
    lastName: p.lastName,
    email: p.email,
    accountId: p.accountId,
  });
  assert.equal(e.participants[0].id, seat);
  assert.equal(e.bottles.find((b) => b.ownerId === seat)?.id, bottle.id);
  assert.throws(
    () =>
      applyCommand(e, participant(e, 0), {
        type: "bottle-entry",
        participantId: e.participants[1].id,
        name: "Wrong",
        distillery: "Wrong",
        proof: 100,
      }),
    /own bottle/,
  );
  assert.equal(authorized(e, { id: "unknown", email: p.email }), false);
  e = applyCommand(e, host, {
    type: "roster-seat",
    slot: 0,
    firstName: "Replacement",
    lastName: "Person",
    email: "new@example.com",
  });
  assert.notEqual(e.participants[0].id, seat);
  assert.ok(!e.bottles.some((b) => b.ownerId === seat));
});
test("participants must provide complete bottle details; host can correct before the first flight", () => {
  let e = setup(2);
  assert.throws(
    () =>
      applyCommand(e, participant(e, 0), {
        type: "bottle-entry",
        name: "A",
        distillery: "",
        proof: 100,
      }),
    /bottle name/,
  );
  assert.throws(() => applyCommand(e, host, { type: "start" }));
  e = applyCommand(e, host, { type: "invite-roster" });
  e = bottles(e);
  e = applyCommand(e, host, { type: "start" });
  const p = participant(e, 0);
  assert.throws(
    () =>
      applyCommand(e, p, {
        type: "bottle-entry",
        name: "Late",
        distillery: "D",
        proof: 100,
      }),
    /lock/,
  );
  e = applyCommand(e, host, {
    type: "bottle-entry",
    participantId: e.participants[0].id,
    name: "Last minute correction",
    distillery: "D",
    proof: 110,
  });
  assert.equal(
    e.bottles.find((b) => b.ownerId === e.participants[0].id)?.proof,
    110,
  );
  e = applyCommand(e, host, { type: "open", groupId: e.groups[0].id });
  assert.throws(
    () =>
      applyCommand(e, host, {
        type: "bottle-entry",
        participantId: e.participants[0].id,
        name: "Too late",
        distillery: "D",
        proof: 100,
      }),
    /lock/,
  );
});
test("blind cups are flight-local, aliases cannot be forged, and every taster judges the same cups", () => {
  let e = setup();
  e = applyCommand(e, host, { type: "invite-roster" });
  e = bottles(e);
  e = applyCommand(e, host, { type: "start" });
  e = applyCommand(e, host, { type: "open", groupId: e.groups[0].id });
  const g = e.groups[0],
    p = participant(e, 0),
    s = snapshot(e, p),
    other = snapshot(e, participant(e, 1));
  assert.deepEqual(s.groups[0].cupNumbers, other.groups[0].cupNumbers);
  assert.deepEqual(Object.values(g.cupNumbers!).sort(), [1, 2, 3]);
  assert.equal(s.groups[0].pourGuide, undefined);
  assert.equal(snapshot(e, host).groups[0].pourGuide?.length, 3);
  for (const b of e.bottles) assert.ok(!JSON.stringify(s).includes(b.id));
  assert.ok(!JSON.stringify(s).includes("Private bottle 1"));
  assert.equal(s.ownBottle?.name, "Private bottle 0");
  const entries = s.groups[0].bottleIds.map((bottleId, i) => ({
    bottleId,
    rank: i + 1,
    aroma: 7,
    flavor: 7,
    smoothness: 7,
    enjoyment: 7,
  }));
  assert.throws(
    () =>
      applyCommand(e, p, {
        type: "ballot",
        groupId: g.id,
        entries: entries.map((x, i) => ({ ...x, bottleId: g.bottleIds[i] })),
      }),
    /cup/,
  );
  e = applyCommand(e, p, { type: "ballot", groupId: g.id, entries });
  assert.ok(
    e.groups[0].ballots[0].entries.every((x) =>
      g.bottleIds.includes(x.bottleId),
    ),
  );
  assert.deepEqual(snapshot(e, p).groups[0].myBallot?.entries, entries);
});
test("semifinals and finals get fresh alias maps and every eligible bottle appears exactly once per stage", () => {
  let e = setup(12);
  e = applyCommand(e, host, { type: "invite-roster" });
  e = bottles(e);
  e = applyCommand(e, host, { type: "start" });
  const aliases = new Set<string>();
  for (const stage of ["opening", "semifinal", "final"] as const) {
    for (const group of e.groups.filter(
      (g) => g.stage === stage && !g.runoffKey,
    )) {
      e = applyCommand(e, host, { type: "open", groupId: group.id });
      for (let i = 0; i < 12; i++) {
        const actor = participant(e, i),
          view = snapshot(e, actor).groups.find((g) => g.id === group.id)!;
        if (i === 0)
          for (const id of view.bottleIds) {
            assert.ok(!aliases.has(id));
            aliases.add(id);
          }
        const sorted = [...group.bottleIds].sort();
        const entries = view.bottleIds.map((alias) => {
          const real = Object.entries(group.publicIds!).find(
            ([, v]) => v === alias,
          )![0];
          return {
            bottleId: alias,
            rank: sorted.indexOf(real) + 1,
            aroma: 7,
            flavor: 7,
            smoothness: 7,
            enjoyment: 7,
          };
        });
        e = applyCommand(e, actor, {
          type: "ballot",
          groupId: group.id,
          entries,
        });
      }
      e = applyCommand(e, host, { type: "close", groupId: group.id });
    }
    const ids = e.groups
      .filter((g) => g.stage === stage && !g.runoffKey)
      .flatMap((g) => g.bottleIds);
    assert.equal(
      new Set(ids).size,
      stage === "opening" ? 12 : stage === "semifinal" ? 8 : 4,
    );
    if (stage !== "final") e = applyCommand(e, host, { type: "advance" });
  }
});

test("a saved profile cannot occupy another slot even with a different email", () => {
  const event = setup();
  const participant = event.participants[0];
  assert.throws(
    () => applyCommand(event, host, {
      type: "roster-seat",
      slot: 1,
      firstName: participant.firstName,
      lastName: participant.lastName,
      email: "different@example.com",
      accountId: participant.accountId,
    }),
    /already has a seat/,
  );
});
