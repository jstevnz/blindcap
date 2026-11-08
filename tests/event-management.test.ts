import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createEvent, applyCommand } from "../lib/engine";
import { canDeleteEvent, eventSummary } from "../lib/event-management";
import DeleteEventDialog from "../app/components/DeleteEventDialog";
const host = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "host@example.com",
  },
  other = {
    id: "22222222-2222-4222-8222-222222222222",
    email: "other@example.com",
  },
  owner = {
    id: "33333333-3333-4333-8333-333333333333",
    email: "owner@example.com",
  };
const active = { status: "active", role: "member" },
  communityOwner = { status: "active", role: "owner" };
test("only active hosts or the community owner can delete events", () => {
  assert.equal(canDeleteEvent(host.id, host.id, active), true);
  assert.equal(canDeleteEvent(host.id, other.id, active), false);
  assert.equal(canDeleteEvent(host.id, owner.id, communityOwner), true);
  for (const profile of [
    null,
    { status: "pending", role: "member" },
    { status: "suspended", role: "owner" },
  ])
    assert.equal(canDeleteEvent(host.id, host.id, profile), false);
});
test("global event summaries reveal no bottles, ballots, emails or round controls", () => {
  let e = createEvent(host.id, "A private night", 2);
  e = applyCommand(e, host, {
    type: "setup",
    participants: [
      { name: "A", email: host.email },
      { name: "B", email: other.email },
    ],
    bottles: [
      { name: "Secret bourbon", ownerIndex: 0 },
      { name: "Another secret bourbon", ownerIndex: 1 },
    ],
  });
  const row = eventSummary(
    e,
    "2026-11-08T00:00:00Z",
    "Host",
    owner,
    communityOwner,
  );
  assert.equal(row.canDelete, true);
  assert.equal(row.canOpen, false);
  assert.equal(row.hostedByMe, false);
  assert.equal(row.tasterCount, 2);
  for (const forbidden of [
    "Secret bourbon",
    "Another secret bourbon",
    host.email,
    other.email,
    "bottles",
    "ballots",
    "participants",
  ])
    assert.equal(JSON.stringify(row).includes(forbidden), false);
  const participant = eventSummary(
    e,
    "2026-11-08T00:00:00Z",
    "Host",
    other,
    active,
  );
  assert.equal(participant.canOpen, true);
  assert.equal(participant.canDelete, false);
});
test("confirmation names the event, warns about permanent history removal and defaults to keeping it", () => {
  const e = createEvent(host.id, "Delete this exact night", 2);
  const row = eventSummary(e, "2026-11-08T00:00:00Z", "Host", host, active);
  const html = renderToStaticMarkup(
    createElement(DeleteEventDialog, {
      event: row,
      busy: false,
      error: "",
      onCancel: () => {},
      onConfirm: () => {},
    }),
  );
  assert.ok(html.includes("<dialog"));
  assert.ok(html.includes("Delete this exact night"));
  assert.ok(html.includes("tasting history for everyone"));
  assert.ok(html.includes("This cannot be undone"));
  assert.ok(html.includes('autofocus=""'));
  assert.ok(html.indexOf("Keep event") < html.indexOf("Delete permanently"));
});
test("event management permissions match the deployed service source", () => {
  assert.equal(
    readFileSync(
      new URL(
        "../supabase/functions/bourbon-api/event-management.ts",
        import.meta.url,
      ),
      "utf8",
    ).replaceAll('"./engine.ts"', '"./engine"'),
    readFileSync(
      new URL("../lib/event-management.ts", import.meta.url),
      "utf8",
    ),
  );
});
