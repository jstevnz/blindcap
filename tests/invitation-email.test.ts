import test from "node:test";
import assert from "node:assert/strict";
import {
  invitationMessage,
  deliverInvitation,
  type InvitationDetails,
} from "../lib/invitation-email";
import { applyCommand, createEvent, snapshot, member } from "../lib/engine";
const details: InvitationDetails = {
  eventId: "event",
  participantId: "seat",
  eventTitle: "Yorktown Bourbon Night",
  name: "Guest",
  email: "guest@example.com",
  expiresAt: "2026-11-10T12:00:00Z",
};
const token = "a".repeat(64);
test("email uses the saved recipient, verified sender and canonical private link", () => {
  const m = invitationMessage(details, token);
  assert.deepEqual(m.payload.to, [details.email]);
  assert.equal(m.payload.from, "Blindcap <invitations@blindcap.net>");
  assert.ok(
    m.payload.text.includes(`https://blindcap.net/join#invite=${token}`),
  );
  assert.ok(m.payload.text.includes("works once"));
  assert.ok(m.payload.text.includes("Tue, 10 Nov 2026 12:00:00 GMT"));
  assert.ok(!m.idempotencyKey.includes(token));
});
test("same invitation retries use a stable key; replacement links and recipients differ", () => {
  assert.equal(
    invitationMessage(details, token).idempotencyKey,
    invitationMessage(details, token).idempotencyKey,
  );
  assert.notEqual(
    invitationMessage(details, token).idempotencyKey,
    invitationMessage(details, "b".repeat(64)).idempotencyKey,
  );
  assert.notEqual(
    invitationMessage(details, token).idempotencyKey,
    invitationMessage({ ...details, email: "other@example.com" }, token)
      .idempotencyKey,
  );
});
test("malformed tokens and recipients are rejected before provider access", () => {
  assert.throws(
    () => invitationMessage(details, "bad"),
    /valid private invitation/,
  );
  assert.throws(
    () => invitationMessage({ ...details, email: "bad" }, token),
    /valid email/,
  );
});
test("provider submission is server-authenticated and idempotent; accepted response is checked", async () => {
  let calls = 0;
  const transport: typeof fetch = async (url, options) => {
    calls++;
    assert.equal(url, "https://api.resend.com/emails");
    const headers = options!.headers as Record<string, string>;
    assert.equal(headers.Authorization, "Bearer test-only-key");
    assert.ok(headers["Idempotency-Key"]);
    const payload = JSON.parse(options!.body as string);
    assert.equal(payload.to[0], details.email);
    return Response.json({ id: "test-message" });
  };
  assert.deepEqual(
    await deliverInvitation(details, token, "test-only-key", transport),
    { messageId: "test-message", email: details.email },
  );
  assert.equal(calls, 1);
});
test("missing configuration, send limits and network uncertainty report useful errors", async () => {
  await assert.rejects(
    () => deliverInvitation(details, token, ""),
    /not configured/,
  );
  await assert.rejects(
    () =>
      deliverInvitation(
        details,
        token,
        "test",
        async () => new Response("", { status: 429 }),
      ),
    /sending limit/,
  );
  await assert.rejects(
    () =>
      deliverInvitation(
        details,
        token,
        "test",
        async () => new Response("secret provider debug", { status: 403 }),
      ),
    /could not accept/,
  );
  await assert.rejects(
    () =>
      deliverInvitation(details, token, "test", async () => {
        throw Error("private debug");
      }),
    /did not confirm/,
  );
});
test("delivery address changes do not reassign a seat or expose contact details to guests", () => {
  const host = { id: "host", email: "host@example.com" };
  let e = createEvent(host.id, "Test", 2);
  e = applyCommand(e, host, {
    type: "setup",
    participants: [
      { name: "A", email: "a@example.com" },
      { name: "B", email: "b@example.com" },
    ],
    bottles: [
      { name: "A bottle", ownerIndex: 0 },
      { name: "B bottle", ownerIndex: 1 },
    ],
  });
  e = applyCommand(e, host, { type: "start" });
  e = applyCommand(e, host, {
    type: "delivery-email",
    participantId: e.participants[0].id,
    email: "  Delivery@Example.com ",
  });
  assert.equal(e.participants[0].invitationEmail, "delivery@example.com");
  assert.equal(e.participants[0].email, "a@example.com");
  assert.ok(member(e, { id: "u", email: "a@example.com" }));
  assert.equal(
    member(e, { id: "u", email: "delivery@example.com" }),
    undefined,
  );
  assert.ok(
    !JSON.stringify(snapshot(e, { id: "u", email: "b@example.com" })).includes(
      "delivery@example.com",
    ),
  );
  assert.throws(
    () =>
      applyCommand(
        e,
        { id: "u", email: "b@example.com" },
        {
          type: "delivery-email",
          participantId: e.participants[0].id,
          email: "bad@example.com",
        },
      ),
    /admin/,
  );
});
