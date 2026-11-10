import test from "node:test";
import assert from "node:assert/strict";
import {
  bottleDetails,
  annualYear,
  historyEntries,
  leaderboard,
  revealedEntries,
} from "../supabase/functions/bourbon-api/series-shared";
import { createEvent, applyCommand, snapshot } from "../lib/engine";
const actor = { id: "host", email: "host@example.com" };
test("proof is optional, bounded, and ABV is derived without accepting arbitrary objects", () => {
  assert.deepEqual(bottleDetails({ proof: "130", distillery: " Example " }), {
    proof: 130,
    abv: 65,
    distillery: "Example",
  });
  assert.deepEqual(bottleDetails({ proof: "" }), {});
  for (const proof of [0, 201, -1, "bad", true, {}])
    assert.throws(() => bottleDetails({ proof }));
});
test("historical editions require distinct participants and a single winner and swill; no scores invented", () => {
  const entries = historyEntries([
    { name: "Ada", bottle: "", award: "winner" },
    { name: "Ben", bottle: "Old bottle", award: "swill" },
  ]);
  assert.equal(entries[0].place, undefined);
  assert.equal(entries[0].bottle, "");
  assert.equal("score" in entries[0], false);
  assert.throws(() =>
    historyEntries([
      { name: "Ada", award: "winner" },
      { name: "ada", award: "swill" },
    ]),
  );
  assert.throws(() =>
    historyEntries([
      { name: "Ada", award: "winner" },
      { name: "Ben", award: "winner" },
    ]),
  );
  assert.throws(() =>
    historyEntries([
      { name: "Ada", award: "winner", place: 2 },
      { name: "Ben", award: "swill", place: 1 },
    ]),
  );
  assert.throws(() => annualYear(2025.5));
  assert.equal(annualYear("2025"), 2025);
});
test("leaderboard merges linked accounts across names and years and ignores unrevealed editions", () => {
  const rows = leaderboard([
    {
      year: 2024,
      entries: [
        {
          personId: "old",
          profileId: "member",
          name: "Ada",
          bottle: "A",
          award: "winner",
        },
      ],
    },
    {
      year: 2025,
      entries: [
        {
          personId: "new",
          profileId: "member",
          name: "Ada Smith",
          bottle: "B",
          award: "winner",
        },
      ],
    },
    { year: 2026, entries: null },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].wins, 2);
  assert.deepEqual(rows[0].years, [2024, 2025]);
});
test("bottle details survive setup, but blind snapshots and series histories hide them", () => {
  let e = createEvent(actor.id, "Test", 2);
  e = applyCommand(e, actor, {
    type: "setup",
    revision: 0,
    participants: [
      { name: "Ada", email: "ada@example.com" },
      { name: "Ben", email: "ben@example.com" },
    ],
    bottles: [
      {
        name: "Secret A",
        ownerIndex: 0,
        proof: 100,
        distillery: "Secret Distillery",
      },
      { name: "Secret B", ownerIndex: 1 },
    ],
  });
  assert.equal(e.bottles[0].abv, 50);
  assert.equal(e.bottles[1].proof, undefined);
  const hidden = JSON.stringify(
    snapshot(e, { id: "ada", email: "ada@example.com" }).bottles,
  );
  assert.ok(!hidden.includes("Secret"));
  assert.ok(!hidden.includes("proof"));
  assert.equal(revealedEntries(e), null);
});
