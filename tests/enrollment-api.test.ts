import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createEvent, applyCommand } from "../lib/engine";
import {
  emailEnrollment,
  enrollmentAction,
} from "../supabase/functions/bourbon-api/enrollment";
const host = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "host@example.com",
  },
  member = "22222222-2222-4222-8222-222222222222";
function fixture() {
  let e = createEvent(host.id, "Invitation example", 2);
  e.workflowVersion = 2;
  e = applyCommand(e, host, {
    type: "roster-seat",
    slot: 0,
    firstName: "Member",
    lastName: "One",
    email: "member@example.com",
    accountId: member,
  });
  e = applyCommand(e, host, {
    type: "roster-seat",
    slot: 1,
    firstName: "New",
    lastName: "Person",
    email: "new@example.com",
  });
  e = applyCommand(e, host, { type: "invite-roster" });
  const tables: Record<string, any[]> = {
    bourbon_member_invites: [
      {
        event_id: e.id,
        participant_id: e.participants[0].id,
        invitee_id: member,
        status: "pending",
        email_sent_at: null,
      },
    ],
    bourbon_reserved_participants: [
      {
        event_id: e.id,
        participant_id: e.participants[1].id,
        email: "new@example.com",
        registration_sent_at: null,
      },
    ],
    bourbon_editions: [],
    bourbon_profiles: [
      {
        id: member,
        username: "member",
        display_name: "Nickname",
        first_name: "Member",
        last_name: "One",
        email: "member@example.com",
        status: "active",
        discoverable: true,
        mailing_address: { line1: "PRIVATE ADDRESS" },
      },
    ],
  };
  class Q {
    filters: ((r: any) => boolean)[] = [];
    values: any;
    constructor(readonly table: string) {}
    select() {
      return this;
    }
    eq(k: string, v: any) {
      this.filters.push((r) => r[k] === v);
      return this;
    }
    is(k: string, v: any) {
      return this.eq(k, v);
    }
    or() {
      return this;
    }
    limit() {
      return this;
    }
    update(v: any) {
      this.values = v;
      return this;
    }
    result() {
      const rows = (tables[this.table] ?? []).filter((r) =>
        this.filters.every((f) => f(r)),
      );
      if (this.values) rows.forEach((r) => Object.assign(r, this.values));
      return { data: rows, error: null };
    }
    maybeSingle() {
      const r = this.result();
      return Promise.resolve({ data: r.data[0] ?? null, error: null });
    }
    then(a: any, b: any) {
      return Promise.resolve(this.result()).then(a, b);
    }
  }
  const db = {
    from: (table: string) => new Q(table),
  } as unknown as SupabaseClient;
  return { e, db, tables };
}
test("bulk invitations send signup versus welcome links and retry only unsent recipients", async () => {
  const { e, db, tables } = fixture(),
    sent: { to: string; text: string; key: string }[] = [];
  let fail = true;
  const deliver = async (
    to: string,
    subject: string,
    text: string,
    key: string,
  ) => {
    if (to === "new@example.com" && fail)
      throw new Error("Temporary delivery failure");
    sent.push({ to, text, key });
  };
  const first = await emailEnrollment(db, e, deliver);
  assert.equal(first.sent, 1);
  assert.equal(first.failed, 1);
  assert.ok(sent[0].text.includes(`/event/${e.id}/welcome`));
  assert.ok(!sent[0].text.includes("PRIVATE ADDRESS"));
  fail = false;
  const retry = await emailEnrollment(db, e, deliver);
  assert.equal(retry.failed, 0);
  assert.equal(sent.length, 2);
  assert.ok(sent[1].text.includes("https://blindcap.net/register"));
  assert.ok(sent[1].text.includes("verify") || sent[1].text.includes("Verify"));
  assert.ok(tables.bourbon_reserved_participants[0].registration_sent_at);
  await emailEnrollment(db, e, deliver);
  assert.equal(sent.length, 2);
});
test("welcome previews are invitation-scoped and pending invitees cannot see bottle submissions", async () => {
  const { e, db, tables } = fixture();
  e.bottles = [
    {
      id: "secret",
      number: 1,
      name: "Private bottle",
      distillery: "Private",
      proof: 100,
      ownerId: e.participants[0].id,
    },
  ];
  const actor = { id: member, email: "member@example.com" };
  const pending: any = await enrollmentAction(
    { operation: "welcome" },
    db,
    e,
    actor,
    async () => {},
  );
  assert.equal(pending.accepted, false);
  assert.equal(pending.ownBottle, null);
  assert.ok(!JSON.stringify(pending).includes("Private bottle"));
  tables.bourbon_member_invites[0].status = "accepted";
  const accepted: any = await enrollmentAction(
    { operation: "welcome" },
    db,
    e,
    actor,
    async () => {},
  );
  assert.equal(accepted.ownBottle?.name, "Private bottle");
  assert.ok(!JSON.stringify(accepted).includes("secret"));
  await assert.rejects(
    enrollmentAction(
      { operation: "welcome" },
      db,
      e,
      { id: "other", email: "other@example.com" },
      async () => {},
    ),
    /invited/,
  );
  await assert.rejects(
    enrollmentAction(
      { operation: "profile", profileId: member },
      db,
      e,
      actor,
      async () => {},
    ),
    /Only event admins/,
  );
});
test("profile search returns names without email until host selects the profile; addresses never appear", async () => {
  const { e, db } = fixture();
  const search: any = await enrollmentAction(
    { operation: "search", query: "Member" },
    db,
    e,
    host,
    async () => {},
  );
  assert.equal(search.profiles[0].firstName, "Member");
  assert.ok(!JSON.stringify(search).includes("member@example.com"));
  assert.ok(!JSON.stringify(search).includes("PRIVATE ADDRESS"));
  const chosen: any = await enrollmentAction(
    { operation: "profile", profileId: member },
    db,
    e,
    host,
    async () => {},
  );
  assert.equal(chosen.profile.email, "member@example.com");
  assert.ok(!JSON.stringify(chosen).includes("PRIVATE ADDRESS"));
});
