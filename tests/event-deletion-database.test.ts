import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222",
  c = "33333333-3333-4333-8333-333333333333",
  g = "44444444-4444-4444-8444-444444444444";
const ea = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  eb = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  ec = "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  seat = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
test("confirmed event deletion enforces ownership, prevents stale deletes and removes dependent access", async (t) => {
  const db = new PGlite();
  const scalar = async (sql: string, params: unknown[] = []) =>
    Object.values(
      (await db.query<Record<string, unknown>>(sql, params)).rows[0],
    )[0];
  const remove = (event: string, actor: string, revision = 0, title = "A") =>
    scalar("select public.delete_bourbon_event($1,$2,$3,$4)", [
      event,
      actor,
      revision,
      title,
    ]);
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');",
    );
    for (const name of [
      "202611070001_events.sql",
      "202611070002_guest_invites.sql",
      "20261108201018_community_accounts.sql",
      "20261108211509_confirmed_event_deletion.sql",
    ])
      await db.exec(
        await readFile(
          new URL("../supabase/migrations/" + name, import.meta.url),
          "utf8",
        ),
      );
    for (const [id, name, role] of [
      [a, "host_a", "member"],
      [b, "host_b", "member"],
      [c, "community_owner", "owner"],
      [g, "guest", ""],
    ]) {
      await db.query("insert into auth.users(id,email) values($1,$2)", [
        id,
        name + "@example.com",
      ]);
      if (role)
        await db.query(
          "insert into bourbon_profiles(id,email,username,display_name,role,status) values($1,$2,$3,$3,$4,'active')",
          [id, name + "@example.com", name, role],
        );
    }
    for (const [id, host, title] of [
      [ea, a, "A"],
      [eb, b, "B"],
      [ec, a, "C"],
    ])
      await db.query(
        "insert into bourbon_events(id,owner_id,state) values($1,$2,$3)",
        [id, host, JSON.stringify({ id, ownerId: host, revision: 0, title })],
      );
    await db.query(
      "insert into bourbon_invites values('hash',$1,$2,now()+interval '1 hour',null)",
      [ea, seat],
    );
    await db.query("insert into bourbon_guest_access values($1,$2,$3)", [
      ea,
      seat,
      g,
    ]);
    await db.query(
      "insert into bourbon_member_invites(event_id,participant_id,invitee_id,invited_by) values($1,$2,$3,$4)",
      [ea, seat, b, a],
    );
    await t.test(
      "browser roles cannot delete rows or call the deletion function",
      async () => {
        for (const role of ["anon", "authenticated"]) {
          await db.exec("set role " + role);
          await assert.rejects(remove(ea, a), /permission denied/);
          await assert.rejects(
            db.query("delete from bourbon_events where id=$1", [ea]),
            /permission denied/,
          );
          await db.exec("reset role");
        }
      },
    );
    await db.exec("set role service_role");
    await t.test(
      "another host, a guest and stale confirmation cannot delete the event",
      async () => {
        assert.equal(await remove(ea, b), false);
        assert.equal(await remove(ea, g), false);
        assert.equal(await remove(ea, a, 1), false);
        assert.equal(await remove(ea, a, 0, "Wrong title"), false);
        assert.equal(
          await scalar("select count(*)::int from bourbon_events"),
          3,
        );
      },
    );
    await t.test(
      "suspended host and suspended community owner lose deletion rights immediately",
      async () => {
        await db.query(
          "update bourbon_profiles set status='suspended' where id in ($1,$2)",
          [a, c],
        );
        assert.equal(await remove(ea, a), false);
        assert.equal(await remove(ea, c), false);
        await db.query(
          "update bourbon_profiles set status='active' where id in ($1,$2)",
          [a, c],
        );
      },
    );
    await t.test(
      "host deletion removes scores and invitations for exactly that event, without deleting accounts",
      async () => {
        assert.equal(await remove(ea, a), true);
        assert.equal(await remove(ea, a), false);
        for (const table of [
          "bourbon_events",
          "bourbon_invites",
          "bourbon_guest_access",
          "bourbon_member_invites",
        ])
          assert.equal(
            await scalar(
              `select count(*)::int from ${table} where ${table === "bourbon_events" ? "id" : "event_id"}=$1`,
              [ea],
            ),
            0,
          );
        assert.equal(
          await scalar("select count(*)::int from bourbon_profiles"),
          3,
        );
        assert.equal(
          await scalar("select count(*)::int from bourbon_events"),
          2,
        );
      },
    );
    await t.test(
      "community owner can delete another host’s event while other events remain",
      async () => {
        assert.equal(await remove(eb, c, 0, "B"), true);
        assert.equal(await scalar("select id from bourbon_events"), ec);
      },
    );
  } finally {
    await db.close();
  }
});
