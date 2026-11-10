import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createEvent, snapshot } from "../lib/engine";
import {
  EVENT_TYPES,
  requireEventType,
  eventTypeFor,
} from "../lib/event-types";
test("only Bourbon Tasting is offered and unsupported formats cannot use Bourbon scoring", () => {
  assert.deepEqual(EVENT_TYPES, [
    { id: "bourbon-tasting", label: "Bourbon Tasting" },
  ]);
  for (const type of ["wine", "chili", "", null, {}, 42])
    assert.throws(() => requireEventType(type));
  const event = createEvent("host", "Example", 3, "bourbon-tasting");
  assert.equal(event.eventType, "bourbon-tasting");
  assert.equal(
    snapshot(event, { id: "host", email: "host@example.com" }).eventType,
    "bourbon-tasting",
  );
  assert.throws(() => createEvent("host", "Example", 3, "wine"));
  delete event.eventType;
  assert.equal(eventTypeFor(event), "bourbon-tasting");
  assert.equal(
    snapshot(event, { id: "host", email: "host@example.com" }).eventType,
    "bourbon-tasting",
  );
});
test("event type registry is identical in the app and authenticated backend", async () => {
  assert.equal(
    await readFile(new URL("../lib/event-types.ts", import.meta.url), "utf8"),
    await readFile(
      new URL(
        "../supabase/functions/bourbon-api/event-types.ts",
        import.meta.url,
      ),
      "utf8",
    ),
  );
});
