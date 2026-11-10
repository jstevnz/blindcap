import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createEvent, applyCommand, snapshot, authorized } from "../lib/engine";
import {
  setCoAdmins,
  confirmedProfileIds,
  mailingList,
} from "../supabase/functions/bourbon-api/event-team";
import {
  privateProfileFields,
  publicProfile,
  type Profile,
} from "../lib/community";
import { mailingCsv } from "../app/components/EventTeam";
const owner = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "owner@example.com",
  },
  co = { id: "22222222-2222-4222-8222-222222222222", email: "co@example.com" },
  outsider = {
    id: "33333333-3333-4333-8333-333333333333",
    email: "other@example.com",
  };
const profile = { ...owner, role: "member", status: "active" } as Profile;
test("optional addresses validate and remain absent from public profile data", () => {
  const old = privateProfileFields({ fullName: "User" });
  assert.equal("mailing_address" in old, false);
  const fields = privateProfileFields({
    mailingAddress: {
      line1: " 123 Main ",
      city: " Yorktown ",
      region: "VA",
      postalCode: "23690",
      country: "US",
    },
  });
  assert.equal(fields.mailing_address?.line1, "123 Main");
  assert.throws(() =>
    privateProfileFields({ mailingAddress: { line1: "x".repeat(151) } }),
  );
  assert.throws(() => privateProfileFields({ mailingAddress: { city: {} } }));
  assert.ok(
    !JSON.stringify(
      publicProfile({ ...profile, mailing_address: fields.mailing_address }),
    ).includes("123 Main"),
  );
});
test("co-admins get event controls but cannot delegate or delete ownership; removal revokes access", () => {
  const original = createEvent(owner.id, "Team event", 2),
    event = setCoAdmins(original, owner, profile, [co.id], 0);
  assert.equal(original.adminIds, undefined);
  assert.equal(event.ownerId, owner.id);
  assert.equal(event.revision, 1);
  assert.equal(authorized(event, co), true);
  assert.equal(snapshot(event, co).admin, true);
  assert.equal(snapshot(event, co).results, null);
  const setup = applyCommand(event, co, {
    type: "setup",
    participants: [
      { name: "A", email: "a@example.com" },
      { name: "B", email: "b@example.com" },
    ],
    bottles: [
      { name: "A", ownerIndex: 0 },
      { name: "B", ownerIndex: 1 },
    ],
  });
  assert.equal(setup.bottles.length, 2);
  assert.throws(
    () => setCoAdmins(event, co, { ...profile, id: co.id }, [outsider.id], 1),
    /primary host/,
  );
  assert.throws(() => setCoAdmins(event, owner, profile, [owner.id], 1));
  assert.throws(() => setCoAdmins(event, owner, profile, [co.id, co.id], 1));
  assert.throws(() => setCoAdmins(event, owner, profile, [], 0), /changed/);
  const removed = setCoAdmins(event, owner, profile, [], 1);
  assert.equal(authorized(removed, co), false);
  assert.equal(authorized(removed, owner), true);
});
test("mailing lists exclude pending addresses, uninvited profiles and non-admin readers", async () => {
  const e = {
    ...createEvent(owner.id, "Mail", 2),
    adminIds: [co.id],
    participants: [
      { id: "a", name: "Confirmed", email: "", accountId: owner.id },
      { id: "b", name: "Pending", email: "", accountId: outsider.id },
    ],
  };
  const invites = [
    { participant_id: "a", invitee_id: owner.id, status: "accepted" },
    { participant_id: "b", invitee_id: outsider.id, status: "pending" },
  ];
  assert.deepEqual(confirmedProfileIds(e, invites), [owner.id]);
  const tables: Record<string, any[]> = {
    bourbon_member_invites: invites.map((i) => ({ ...i, event_id: e.id })),
    bourbon_guest_access: [],
    bourbon_profiles: [
      {
        id: owner.id,
        display_name: "Owner",
        full_name: "Owner Name",
        status: "active",
        mailing_address: { line1: "123 Main" },
      },
      {
        id: outsider.id,
        status: "active",
        mailing_address: { line1: "SECRET" },
      },
    ],
  };
  class Q {
    filters: ((r: any) => boolean)[] = [];
    constructor(readonly t: string) {}
    select() {
      return this;
    }
    eq(k: string, v: any) {
      this.filters.push((r) => r[k] === v);
      return this;
    }
    in(k: string, v: any[]) {
      this.filters.push((r) => v.includes(r[k]));
      return this;
    }
    then(a: any, b: any) {
      return Promise.resolve({
        data: tables[this.t].filter((r) => this.filters.every((f) => f(r))),
        error: null,
      }).then(a, b);
    }
  }
  const db = { from: (t: string) => new Q(t) } as unknown as SupabaseClient;
  const result = await mailingList(db, e, co);
  assert.equal(result.participants[0].address?.line1, "123 Main");
  assert.equal(result.participants[1].address, null);
  assert.ok(!JSON.stringify(result).includes("SECRET"));
  await assert.rejects(mailingList(db, e, outsider), /Only this event/);
});
test("CSV exports confirmed participants only and neutralizes spreadsheet formulas", () => {
  const csv = mailingCsv([
    {
      participantId: "a",
      name: "A",
      fullName: "=formula",
      confirmed: true,
      address: { line1: "123 Main", postalCode: "00123" },
    },
    {
      participantId: "b",
      name: "B",
      fullName: "PENDING SECRET",
      confirmed: false,
      address: { line1: "SECRET" },
    },
  ]);
  assert.ok(csv.includes("'=formula"));
  assert.ok(!csv.includes("SECRET"));
  assert.ok(csv.includes("00123"));
});

test("separate first and last names preserve compound names and the combined mailing name", () => {
  const fields = privateProfileFields(
    { firstName: " Mary Ann ", lastName: " van Buren " },
    true,
  );
  assert.equal(fields.first_name, "Mary Ann");
  assert.equal(fields.last_name, "van Buren");
  assert.equal(fields.full_name, "Mary Ann van Buren");
  assert.throws(
    () => privateProfileFields({ firstName: "First", lastName: "" }, true),
    /first name and last name/,
  );
  assert.throws(
    () => privateProfileFields({ firstName: {}, lastName: "Last" }),
    /text/,
  );
  assert.throws(
    () =>
      privateProfileFields({ firstName: "x".repeat(101), lastName: "Last" }),
    /100 characters/,
  );
  assert.equal(
    privateProfileFields({ fullName: "Legacy Name" }).full_name,
    "Legacy Name",
  );
  const p = {
    ...profile,
    first_name: "Private First",
    last_name: "Private Last",
    full_name: "Private First Private Last",
  };
  const visible = JSON.stringify(publicProfile(p));
  assert.ok(!visible.includes("Private"));
});
