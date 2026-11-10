import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { createEvent, applyCommand, type Event } from "../lib/engine";
const migration = (name: string) =>
  readFile(new URL("../supabase/migrations/" + name, import.meta.url), "utf8");
test("reserved signup seats link only approved matching emails, preserve bottle data, and remain inaccessible to browser roles", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');`,
    );
    await db.exec(await migration("202611070001_events.sql"));
    await db.exec(await migration("202611070002_guest_invites.sql"));
    await db.exec(await migration("20261108201018_community_accounts.sql"));
    await db.exec(
      `alter table bourbon_profiles add column first_name text,add column last_name text,add column full_name text;`,
    );
    await db.exec(await migration("20261110045257_participant_enrollment.sql"));
    const host = {
        id: "11111111-1111-4111-8111-111111111111",
        email: "host@example.com",
      },
      member = "22222222-2222-4222-8222-222222222222",
      pending = "33333333-3333-4333-8333-333333333333";
    for (const [id, email, username, status] of [
      [host.id, host.email, "host", "active"],
      [member, "member@example.com", "member", "active"],
      [pending, "new@example.com", "newmember", "pending"],
    ]) {
      await db.query(
        "insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",
        [id, email],
      );
      await db.query(
        "insert into bourbon_profiles(id,username,display_name,email,status,first_name,last_name) values($1,$2,$2,$3,$4,'First','Last')",
        [id, username, email, status],
      );
    }
    let e = createEvent(host.id, "Invite first DB", 2);
    e.workflowVersion = 2;
    await db.query(
      "insert into bourbon_events(id,owner_id,state) values($1,$2,$3)",
      [e.id, host.id, JSON.stringify(e)],
    );
    async function save(next: Event) {
      const result = await db.query<{ saved: boolean }>(
        "select save_bourbon_enrollment_event($1,$2,$3,$4) as saved",
        [
          next.id,
          next.revision - 1,
          JSON.stringify(next),
          next.participants.map((p) => p.email),
        ],
      );
      assert.equal(result.rows[0].saved, true);
      e = next;
    }
    await save(
      applyCommand(e, host, {
        type: "roster-seat",
        slot: 0,
        firstName: "First",
        lastName: "Last",
        email: "member@example.com",
        accountId: member,
      }),
    );
    await save(
      applyCommand(e, host, {
        type: "roster-seat",
        slot: 1,
        firstName: "New",
        lastName: "Member",
        email: "new@example.com",
      }),
    );
    assert.equal(
      (await db.query("select * from bourbon_member_invites")).rows.length,
      0,
    );
    await save(applyCommand(e, host, { type: "invite-roster" }));
    assert.equal(
      (await db.query("select * from bourbon_member_invites")).rows.length,
      1,
    );
    const reserved = e.participants[1].id;
    await save(
      applyCommand(e, host, {
        type: "bottle-entry",
        participantId: reserved,
        name: "Reserved bottle",
        distillery: "Example",
        proof: 110,
      }),
    );
    const before = structuredClone(e.bottles);
    assert.equal(
      (
        await db.query<{ n: number }>(
          "select link_bourbon_reserved_participants($1) as n",
          [pending],
        )
      ).rows[0].n,
      0,
    );
    await db.query("update bourbon_profiles set status='active' where id=$1", [
      pending,
    ]);
    assert.equal(
      (
        await db.query<{ n: number }>(
          "select link_bourbon_reserved_participants($1) as n",
          [pending],
        )
      ).rows[0].n,
      1,
    );
    const linked = (
      await db.query<{ state: Event }>(
        "select state from bourbon_events where id=$1",
        [e.id],
      )
    ).rows[0].state;
    assert.equal(linked.participants[1].id, reserved);
    assert.equal(linked.participants[1].accountId, pending);
    assert.deepEqual(linked.bottles, before);
    assert.equal(
      (
        await db.query<{ n: number }>(
          "select link_bourbon_reserved_participants($1) as n",
          [pending],
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (await db.query("select * from bourbon_member_invites")).rows.length,
      2,
    );
    assert.equal(
      (
        await db.query<{ accepted: boolean }>(
          "select bourbon_accept_member_invite($1,$2,$3) as accepted",
          [e.id, reserved, pending],
        )
      ).rows[0].accepted,
      true,
    );
    assert.equal(
      (
        await db.query<{ accepted: boolean }>(
          "select bourbon_accept_member_invite($1,$2,$3) as accepted",
          [e.id, reserved, member],
        )
      ).rows[0].accepted,
      false,
    );
    e = linked;
    await save(
      applyCommand(e, host, {
        type: "roster-seat",
        slot: 1,
        firstName: "Different",
        lastName: "Guest",
        email: "different@example.com",
      }),
    );
    assert.equal(
      (
        await db.query(
          "select * from bourbon_guest_access where participant_id=$1",
          [reserved],
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (
        await db.query(
          "select * from bourbon_member_invites where participant_id=$1",
          [reserved],
        )
      ).rows.length,
      0,
    );
    await db.exec("set role anon");
    await assert.rejects(
      db.query("select * from bourbon_reserved_participants"),
    );
    await assert.rejects(
      db.query("select link_bourbon_reserved_participants($1)", [pending]),
    );
    await db.exec("reset role");
  } finally {
    await db.close();
  }
});
