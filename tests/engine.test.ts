import test from "node:test";
import assert from "node:assert/strict";
import {
  applyCommand,
  createEvent,
  metrics,
  results,
  snapshot,
  type Event,
  type Actor,
  type Group,
} from "../lib/engine";
const host: Actor = { id: "host", email: "host@example.com" };
function setup() {
  let e = createEvent(host.id, "Test night");
  e = applyCommand(e, host, {
    type: "setup",
    participants: Array.from({ length: 12 }, (_, i) => ({
      name: `Taster ${i}`,
      email: `t${i}@example.com`,
    })),
    bottles: Array.from({ length: 12 }, (_, i) => ({
      name: `Bourbon ${i}`,
      ownerIndex: i,
    })),
  });
  return applyCommand(e, host, { type: "start" });
}
function cast(e: Event, g: Group, ties = false) {
  e = applyCommand(e, host, { type: "open", groupId: g.id });
  for (let i = 0; i < 12; i++) {
    const p = e.participants[i];
    e = applyCommand(
      e,
      { id: `user${i}`, email: p.email },
      {
        type: "ballot",
        groupId: g.id,
        entries: g.bottleIds.map((id, j) => ({
          bottleId: id,
          rank: ties ? ((j + i) % g.bottleIds.length) + 1 : j + 1,
          aroma: ties ? 5 : 10 - j,
          flavor: ties ? 5 : 10 - j,
          smoothness: ties ? 5 : 10 - j,
          enjoyment: ties ? 5 : 10 - j,
        })),
      },
    );
  }
  return applyCommand(e, host, { type: "close", groupId: g.id });
}
function runStage(e: Event) {
  for (const g of e.groups.filter((g) => g.stage === e.phase && !g.runoffKey))
    e = cast(e, g);
  return e;
}
test("80/5/5/5/5 normalization matches independent hand calculations", () => {
  const g: Group = {
    id: "x",
    name: "x",
    stage: "opening",
    status: "closed",
    bottleIds: ["a", "b", "c"],
    ballots: [
      {
        participantId: "p",
        entries: [
          {
            bottleId: "a",
            rank: 1,
            aroma: 10,
            flavor: 10,
            smoothness: 10,
            enjoyment: 10,
          },
          {
            bottleId: "b",
            rank: 2,
            aroma: 1,
            flavor: 1,
            smoothness: 1,
            enjoyment: 1,
          },
          {
            bottleId: "c",
            rank: 3,
            aroma: 10,
            flavor: 1,
            smoothness: 1,
            enjoyment: 1,
          },
        ],
      },
    ],
  };
  assert.equal(metrics(g, "a").score, 100);
  assert.equal(metrics(g, "b").score, 40);
  assert.equal(metrics(g, "c").score, 5);
});
test("complete 12 → 8 → 4 rehearsal, tier placement, reveal and private history", () => {
  let e = setup();
  assert.equal(e.groups.length, 4);
  e = runStage(e);
  e = applyCommand(e, host, { type: "advance" });
  const semis = e.groups.filter((g) => g.stage === "semifinal");
  assert.equal(semis.length, 2);
  for (const g of semis)
    for (const opening of e.groups.filter((g) => g.stage === "opening"))
      assert.equal(
        g.bottleIds.filter((id) => opening.bottleIds.includes(id)).length,
        1,
      );
  e = runStage(e);
  e = applyCommand(e, host, { type: "advance" });
  e = runStage(e);
  e = applyCommand(e, host, { type: "finish" });
  while (e.phase !== "complete") {
    for (const g of e.groups.filter(
      (g) => g.runoffKey && g.status === "waiting",
    ))
      e = cast(e, g);
    e = applyCommand(e, host, { type: "finish" });
  }
  const r = results(e);
  assert.equal(r.length, 12);
  assert.equal(r.filter((x) => x.tier === "final").length, 4);
  assert.equal(r.filter((x) => x.tier === "semifinal").length, 4);
  assert.equal(r.filter((x) => x.tier === "opening").length, 4);
  assert.equal(r[0].place, 1);
  assert.equal(r[11].place, 12);
  const finalist = r[0];
  assert.ok(
    Math.abs(
      finalist.score -
        (finalist.stages.opening! * 0.2 +
          finalist.stages.semifinal! * 0.3 +
          finalist.stages.final! * 0.5),
    ) < 1e-8,
  );
  const semi = r[4];
  assert.ok(
    Math.abs(
      semi.score - (semi.stages.opening! * 0.4 + semi.stages.semifinal! * 0.6),
    ) < 1e-8,
  );
  const taster = { id: "taster", email: e.participants[0].email };
  assert.equal(snapshot(e, taster).results, null);
  e = applyCommand(e, host, { type: "reveal" });
  const s = snapshot(e, taster);
  assert.equal(s.results?.length, 12);
  assert.ok(s.bottles.every((b) => "name" in b));
  assert.ok(
    s.groups.every(
      (g) => !g.myBallot || g.myBallot.participantId === e.participants[0].id,
    ),
  );
});
test("all blind projections exclude identities, owners, other ballots, scores and emails", () => {
  let e = setup();
  e = cast(e, e.groups[0]);
  const s = snapshot(e, { id: "t", email: e.participants[0].email });
  const raw = JSON.stringify(s);
  assert.ok(!raw.includes("Bourbon"));
  assert.ok(!raw.includes("ownerId"));
  assert.ok(!raw.includes("@example.com"));
  assert.ok(!raw.includes("submittedIds"));
  assert.ok(!raw.includes("scores"));
  assert.equal(s.groups[0].myBallot?.participantId, e.participants[0].id);
  assert.throws(
    () => snapshot(e, { id: "intruder", email: "no@example.com" }),
    /not invited/,
  );
});
test("rejects missing ballots, early reveal, unauthorized host actions and malformed ballots", () => {
  let e = setup();
  const t = { id: "t", email: e.participants[0].email };
  assert.throws(
    () => applyCommand(e, t, { type: "open", groupId: e.groups[0].id }),
    /admin/,
  );
  assert.throws(() => applyCommand(e, host, { type: "reveal" }), /Finish/);
  e = applyCommand(e, host, { type: "open", groupId: e.groups[0].id });
  assert.throws(
    () => applyCommand(e, host, { type: "close", groupId: e.groups[0].id }),
    /All 12/,
  );
  assert.throws(
    () =>
      applyCommand(e, t, {
        type: "ballot",
        groupId: e.groups[0].id,
        entries: [],
      }),
    /every bottle/,
  );
  const entries = e.groups[0].bottleIds.map((id) => ({
    bottleId: id,
    rank: 1,
    aroma: 11,
    flavor: 5,
    smoothness: 5,
    enjoyment: 5,
  }));
  assert.throws(
    () =>
      applyCommand(e, t, { type: "ballot", groupId: e.groups[0].id, entries }),
    /unique/,
  );
  entries.forEach((x, i) => (x.rank = i + 1));
  assert.throws(
    () =>
      applyCommand(e, t, { type: "ballot", groupId: e.groups[0].id, entries }),
    /1 to 10/,
  );
});
test("a taster can score their own bottle; edits replace rather than duplicate ballots", () => {
  let e = setup();
  const b = e.bottles[0],
    p = e.participants.find((p) => p.id === b.ownerId)!;
  const g = e.groups.find((g) => g.bottleIds.includes(b.id))!;
  e = applyCommand(e, host, { type: "open", groupId: g.id });
  const c = {
    type: "ballot",
    groupId: g.id,
    entries: g.bottleIds.map((id, i) => ({
      bottleId: id,
      rank: i + 1,
      aroma: 5,
      flavor: 5,
      smoothness: 5,
      enjoyment: 5,
    })),
  };
  e = applyCommand(e, { id: "x", email: p.email }, c);
  e = applyCommand(e, { id: "x", email: p.email }, c);
  assert.equal(e.groups.find((x) => x.id === g.id)!.ballots.length, 1);
});
test("boundary tie creates a blind runoff; repeated ties require another runoff", () => {
  let e = setup();
  for (const g of e.groups) e = cast(e, g, true);
  e = applyCommand(e, host, { type: "advance" });
  assert.equal(e.phase, "opening");
  const runoffs = e.groups.filter((g) => g.runoffKey);
  assert.equal(runoffs.length, 4);
  const first = runoffs[0];
  e = cast(e, first, true);
  assert.equal(
    e.groups.filter(
      (g) => g.runoffKey === first.runoffKey && g.status === "waiting",
    ).length,
    1,
  );
  for (const g of e.groups.filter((g) => g.runoffKey && g.status === "waiting"))
    e = cast(e, g);
  e = applyCommand(e, host, { type: "advance" });
  assert.equal(e.phase, "semifinal");
});
test("setup requires twelve unique owners and emails and locks after the draw", () => {
  const e = setup();
  assert.throws(
    () =>
      applyCommand(e, host, { type: "setup", participants: [], bottles: [] }),
    /locked/,
  );
  assert.equal(new Set(e.groups.flatMap((g) => g.bottleIds)).size, 12);
});

test("deployed scoring source matches the tested canonical engine", async () => {
  const { readFile } = await import("node:fs/promises");
  assert.equal(
    await readFile(new URL("../lib/engine.ts", import.meta.url), "utf8"),
    await readFile(
      new URL("../supabase/functions/bourbon-api/engine.ts", import.meta.url),
      "utf8",
    ),
  );
});

test("guest identity maps only to its assigned seat without exposing participant emails", () => {
  let e = createEvent(host.id, "Guest night");
  e = applyCommand(e, host, {
    type: "setup",
    participants: Array.from({ length: 12 }, (_, i) => ({
      name: `Guest ${i}`,
      email: "",
    })),
    bottles: Array.from({ length: 12 }, (_, i) => ({
      name: `Bottle ${i}`,
      ownerIndex: i,
    })),
  });
  e = applyCommand(e, host, { type: "start" });
  const guest = {
    id: "guest-auth",
    email: "guest@guests.blindcap.invalid",
    guestParticipantId: e.participants[0].id,
  };
  assert.equal(snapshot(e, guest).participantId, e.participants[0].id);
  assert.throws(
    () => snapshot(e, { id: "guest-auth", email: guest.email }),
    /not invited/,
  );
  const other = structuredClone(e);
  other.participants = other.participants.map((p) => ({
    ...p,
    id: p.id + "other",
  }));
  assert.throws(() => snapshot(other, guest), /not invited/);
});
