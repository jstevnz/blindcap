import test from "node:test";
import assert from "node:assert/strict";
import {
  applyCommand,
  createEvent,
  metrics,
  results,
  snapshot,
  type Event,
  type Group,
} from "../lib/engine";
import { tournamentPlan } from "../lib/tournament";
const host = { id: "host", email: "host@example.com" };
function setup(n: number) {
  let e = createEvent(host.id, `Test ${n}`, n);
  e = applyCommand(e, host, {
    type: "setup",
    participants: Array.from({ length: n }, (_, i) => ({
      name: `Taster ${i + 1}`,
      email: `t${i}@example.com`,
    })),
    bottles: Array.from({ length: n }, (_, i) => ({
      name: `Bourbon ${i + 1}`,
      ownerIndex: i,
    })),
  });
  return applyCommand(e, host, { type: "start" });
}
function flight(e: Event, g: Group, tie = false) {
  e = applyCommand(e, host, { type: "open", groupId: g.id });
  const n = e.participants.length;
  for (let i = 0; i < n; i++) {
    if (i === n - 1)
      assert.throws(
        () => applyCommand(e, host, { type: "close", groupId: g.id }),
        new RegExp(`All ${n} tasters`),
      );
    e = applyCommand(
      e,
      { id: `user${i}`, email: e.participants[i].email },
      {
        type: "ballot",
        groupId: g.id,
        entries: g.bottleIds.map((id, j) => ({
          bottleId: id,
          rank: tie ? ((j + i) % g.bottleIds.length) + 1 : j + 1,
          aroma: tie ? 5 : 10 - j,
          flavor: tie ? 5 : 10 - j,
          smoothness: tie ? 5 : 10 - j,
          enjoyment: tie ? 5 : 10 - j,
        })),
      },
    );
  }
  return applyCommand(e, host, { type: "close", groupId: g.id });
}
const expected: Record<
  number,
  { opening: number[]; semis: number[]; final: number }
> = {
  2: { opening: [], semis: [], final: 2 },
  3: { opening: [], semis: [], final: 3 },
  4: { opening: [], semis: [], final: 4 },
  5: { opening: [5], semis: [], final: 4 },
  6: { opening: [3, 3], semis: [], final: 4 },
  7: { opening: [4, 3], semis: [], final: 4 },
  8: { opening: [4, 4], semis: [], final: 4 },
  9: { opening: [3, 3, 3], semis: [3, 3], final: 4 },
  10: { opening: [4, 3, 3], semis: [3, 3], final: 4 },
  11: { opening: [4, 4, 3], semis: [3, 3], final: 4 },
  12: { opening: [3, 3, 3, 3], semis: [4, 4], final: 4 },
  13: { opening: [4, 3, 3, 3], semis: [4, 4], final: 4 },
  14: { opening: [4, 4, 3, 3], semis: [4, 4], final: 4 },
  15: { opening: [4, 4, 4, 3], semis: [4, 4], final: 4 },
  16: { opening: [4, 4, 4, 4], semis: [4, 4], final: 4 },
};
for (let n = 2; n <= 16; n++)
  test(`${n} tasters: full tournament, exact bracket, no duplicated placements and correct weights`, () => {
    let e = setup(n);
    const format = expected[n];
    assert.deepEqual(
      e.groups
        .filter((g) => g.stage === "opening")
        .map((g) => g.bottleIds.length),
      format.opening,
    );
    for (let transitions = 0; e.phase !== "complete"; transitions++) {
      assert.ok(transitions < 12, "Tournament must finish");
      const active = e.groups.filter(
        (g) => g.status === "waiting" && (g.stage === e.phase || g.runoffKey),
      );
      for (const g of active) e = flight(e, g);
      e = applyCommand(e, host, {
        type: e.phase === "final" ? "finish" : "advance",
      });
    }
    assert.deepEqual(
      e.groups
        .filter((g) => g.stage === "semifinal" && !g.runoffKey)
        .map((g) => g.bottleIds.length),
      format.semis,
    );
    assert.equal(
      e.groups.find((g) => g.stage === "final" && !g.runoffKey)!.bottleIds
        .length,
      format.final,
    );
    const r = results(e);
    assert.equal(r.length, n);
    assert.equal(new Set(r.map((x) => x.bottleId)).size, n);
    assert.equal(r[0].place, 1);
    assert.equal(r.at(-1)!.place, n);
    for (const x of r) {
      assert.ok(x.score >= 0 && x.score <= 100);
      let expectedScore: number;
      if (x.tier === "opening") expectedScore = x.stages.opening!;
      else if (x.tier === "semifinal")
        expectedScore = 0.4 * x.stages.opening! + 0.6 * x.stages.semifinal!;
      else if (n <= 4) expectedScore = x.stages.final!;
      else if (n <= 8)
        expectedScore = (2 * x.stages.opening! + 5 * x.stages.final!) / 7;
      else
        expectedScore =
          0.2 * x.stages.opening! +
          0.3 * x.stages.semifinal! +
          0.5 * x.stages.final!;
      assert.ok(
        Math.abs(x.score - expectedScore) < 1e-8,
        `Incorrect weight for ${x.tier} at ${n}`,
      );
    }
    e = applyCommand(e, host, { type: "reveal" });
    assert.equal(
      snapshot(e, { id: "u", email: e.participants[0].email }).results!.length,
      n,
    );
  });
test("head-to-head exact tie has one runoff for both winner and Swill, repeating if tied", () => {
  let e = setup(2);
  e = flight(e, e.groups[0], true);
  e = applyCommand(e, host, { type: "finish" });
  assert.equal(e.phase, "final");
  assert.equal(
    e.groups.filter((g) => g.runoffKey && g.status === "waiting").length,
    1,
  );
  e = flight(
    e,
    e.groups.find((g) => g.runoffKey && g.status === "waiting")!,
    true,
  );
  e = applyCommand(e, host, { type: "finish" });
  assert.equal(
    e.groups.filter((g) => g.runoffKey && g.status === "waiting").length,
    1,
  );
  e = flight(e, e.groups.find((g) => g.runoffKey && g.status === "waiting")!);
  e = applyCommand(e, host, { type: "finish" });
  assert.equal(e.phase, "complete");
  assert.deepEqual(
    results(e).map((r) => r.place),
    [1, 2],
  );
});
test("final-only lower award tie is resolved independently of the winner", () => {
  let e = setup(4);
  e = applyCommand(e, host, { type: "open", groupId: e.groups[0].id });
  for (let i = 0; i < 4; i++) {
    const ranks = i % 2 ? [1, 2, 4, 3] : [1, 2, 3, 4];
    e = applyCommand(
      e,
      { id: `u${i}`, email: e.participants[i].email },
      {
        type: "ballot",
        groupId: e.groups[0].id,
        entries: e.groups[0].bottleIds.map((id, j) => ({
          bottleId: id,
          rank: ranks[j],
          aroma: 5,
          flavor: 5,
          smoothness: 5,
          enjoyment: 5,
        })),
      },
    );
  }
  e = applyCommand(e, host, { type: "close", groupId: e.groups[0].id });
  e = applyCommand(e, host, { type: "finish" });
  const runoff = e.groups.find((g) => g.runoffKey)!;
  assert.equal(runoff.runoffKey, "award:bottom");
  e = flight(e, runoff);
  e = applyCommand(e, host, { type: "finish" });
  assert.equal(e.phase, "complete");
  assert.equal(results(e).at(-1)!.place, 4);
});
test("invalid counts, wrong roster size, and count-change commands are rejected", () => {
  for (const n of [0, 1, 17, 2.5, NaN])
    assert.throws(() => createEvent(host.id, "Invalid", n), /2 to 16/);
  const e = createEvent(host.id, "Two", 2);
  assert.throws(
    () =>
      applyCommand(e, host, { type: "setup", participants: [], bottles: [] }),
    /exactly 2/,
  );
  assert.throws(
    () => applyCommand(e, host, { type: "change-count", tasterCount: 3 }),
    /Unknown/,
  );
});
test("existing events without a stored count keep their twelve-seat format", () => {
  let e = setup(12);
  delete e.tasterCount;
  assert.equal(snapshot(e, host).tasterCount, 12);
  for (const g of e.groups) e = flight(e, g);
  e = applyCommand(e, host, { type: "advance" });
  assert.equal(e.phase, "semifinal");
  assert.equal(e.tasterCount, 12);
});
test("two- and five-bottle preference scales retain the 80 percent contribution", () => {
  for (const size of [2, 5]) {
    const g: Group = {
      id: "x",
      name: "x",
      stage: "final",
      status: "closed",
      bottleIds: Array.from({ length: size }, (_, i) => String(i)),
      ballots: [
        {
          participantId: "p",
          entries: Array.from({ length: size }, (_, i) => ({
            bottleId: String(i),
            rank: i + 1,
            aroma: 1,
            flavor: 1,
            smoothness: 1,
            enjoyment: 1,
          })),
        },
      ],
    };
    for (let i = 0; i < size; i++)
      assert.equal(
        metrics(g, String(i)).score,
        (80 * (size - i - 1)) / (size - 1),
      );
  }
});
test("deployment plan matches the client and tested server plan", async () => {
  const { readFile } = await import("node:fs/promises");
  assert.equal(
    await readFile(new URL("../lib/tournament.ts", import.meta.url), "utf8"),
    await readFile(
      new URL(
        "../supabase/functions/bourbon-api/tournament.ts",
        import.meta.url,
      ),
      "utf8",
    ),
  );
});
