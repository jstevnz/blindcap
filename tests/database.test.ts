import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const owner = "002ee828-fbc2-4df6-ae69-40271a38020d",
  other = "22222222-2222-4222-8222-222222222222",
  guest = "33333333-3333-4333-8333-333333333333",
  pending = "44444444-4444-4444-8444-444444444444";
const event = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  seat = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  hostSeat = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const migration = (name: string) =>
  readFile(new URL("../supabase/migrations/" + name, import.meta.url), "utf8");
test("community migrations preserve legacy data and enforce private membership", async (t) => {
  const db = new PGlite();
  const scalar = async (sql: string, params: unknown[] = []) =>
    Object.values(
      (await db.query<Record<string, unknown>>(sql, params)).rows[0],
    )[0];
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create role supabase_auth_admin;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}');`,
    );
    await db.query(
      `insert into auth.users(id,email,email_confirmed_at) values($1,'owner@example.com',now()),($2,'other@example.com',now()),($3,'guest-one@guests.blindcap.invalid',now()),($4,'pending@example.com',null)`,
      [owner, other, guest, pending],
    );
    await db.exec(await migration("202611070001_events.sql"));
    await db.exec(await migration("202611070002_guest_invites.sql"));
    const state = {
      id: event,
      ownerId: owner,
      revision: 0,
      phase: "setup",
      participants: [
        { id: seat, accountId: other },
        { id: hostSeat, accountId: owner },
      ],
    };
    await db.query(
      `insert into bourbon_events(id,owner_id,state) values($1,$2,$3)`,
      [event, owner, JSON.stringify(state)],
    );
    const oldState = await scalar(
      "select state from bourbon_events where id=$1",
      [event],
    );
    const oldFunction = await scalar(
      "select prosrc from pg_proc where proname='save_bourbon_event'",
    );
    await db.exec(await migration("20261108201018_community_accounts.sql"));
    await t.test(
      "existing event and save function remain unchanged; verified host is enrolled",
      async () => {
        assert.deepEqual(
          await scalar("select state from bourbon_events where id=$1", [event]),
          oldState,
        );
        assert.equal(
          await scalar(
            "select prosrc from pg_proc where proname='save_bourbon_event'",
          ),
          oldFunction,
        );
        assert.equal(
          await scalar("select role from bourbon_profiles where id=$1", [
            owner,
          ]),
          "owner",
        );
        assert.equal(
          await scalar("select count(*)::int from bourbon_profiles"),
          1,
        );
      },
    );
    await db.query(
      `insert into bourbon_profiles(id,username,display_name,email,status) values($1,'other_host','Other','other@example.com','active'),($2,'new_member','Pending','pending@example.com','pending')`,
      [other, pending],
    );
    await t.test(
      "browser roles cannot read profiles or execute privileged membership functions",
      async () => {
        for (const role of ["anon", "authenticated"]) {
          await db.exec("set role " + role);
          await assert.rejects(
            db.query("select * from public.bourbon_profiles"),
            /permission denied/,
          );
          await assert.rejects(
            db.query("select public.bourbon_accept_member_invite($1,$2,$3)", [
              event,
              seat,
              other,
            ]),
            /permission denied/,
          );
          await db.exec("reset role");
        }
        assert.equal(
          await scalar(
            "select bool_and(relrowsecurity) from pg_class where relname in ('bourbon_profiles','bourbon_member_invites','bourbon_community_invites','bourbon_rate_limits')",
          ),
          true,
        );
      },
    );
    await t.test(
      "drawing atomically creates member invitations and the host’s own tasting seat",
      async () => {
        await db.exec("set role service_role");
        assert.equal(
          await scalar("select save_bourbon_community_event($1,0,$2,$3)", [
            event,
            JSON.stringify({ ...state, revision: 1, phase: "final" }),
            [],
          ]),
          true,
        );
        assert.equal(
          await scalar("select save_bourbon_community_event($1,0,$2,$3)", [
            event,
            JSON.stringify({ ...state, revision: 1, phase: "final" }),
            [],
          ]),
          false,
        );
        assert.equal(
          await scalar(
            "select status from bourbon_member_invites where event_id=$1 and participant_id=$2",
            [event, seat],
          ),
          "pending",
        );
        assert.equal(
          await scalar(
            "select auth_user_id from bourbon_guest_access where event_id=$1 and participant_id=$2",
            [event, hostSeat],
          ),
          owner,
        );
        await db.exec("reset role");
      },
    );
    await t.test(
      "only the invited active account can accept and acceptance is repeat-safe",
      async () => {
        assert.equal(
          await scalar("select bourbon_accept_member_invite($1,$2,$3)", [
            event,
            seat,
            owner,
          ]),
          false,
        );
        assert.equal(
          await scalar("select bourbon_accept_member_invite($1,$2,$3)", [
            event,
            seat,
            other,
          ]),
          true,
        );
        assert.equal(
          await scalar("select bourbon_accept_member_invite($1,$2,$3)", [
            event,
            seat,
            other,
          ]),
          true,
        );
        assert.equal(
          await scalar(
            "select auth_user_id from bourbon_guest_access where event_id=$1 and participant_id=$2",
            [event, seat],
          ),
          other,
        );
      },
    );
    await t.test(
      "email-bound activation is single-use and transfers a proven guest seat",
      async () => {
        const oldEvent = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
        await db.query(
          `insert into bourbon_events(id,owner_id,state) values($1,$2,$3)`,
          [
            oldEvent,
            owner,
            JSON.stringify({ id: oldEvent, ownerId: owner, revision: 0 }),
          ],
        );
        await db.query("insert into bourbon_guest_access values($1,$2,$3)", [
          oldEvent,
          seat,
          guest,
        ]);
        await db.query(
          `insert into bourbon_community_invites(token_hash,email,invited_by,expires_at,reserved_user_id,claim_guest_id) values('token','pending@example.com',$1,now()+interval '1 day',$2,$3)`,
          [owner, pending, guest],
        );
        assert.equal(
          await scalar("select bourbon_activate_member($1,$2)", [
            pending,
            "wrong@example.com",
          ]),
          false,
        );
        await db.query(
          "update bourbon_community_invites set expires_at=now()-interval '1 hour' where reserved_user_id=$1",
          [pending],
        );
        assert.equal(
          await scalar("select bourbon_activate_member($1,$2)", [
            pending,
            "pending@example.com",
          ]),
          false,
        );
        await db.query(
          "update bourbon_community_invites set expires_at=now()+interval '1 day' where reserved_user_id=$1",
          [pending],
        );
        await db.query("insert into bourbon_guest_access values($1,$2,$3)", [
          oldEvent,
          hostSeat,
          pending,
        ]);
        await assert.rejects(
          db.query("select bourbon_activate_member($1,$2)", [
            pending,
            "pending@example.com",
          ]),
          /another seat/,
        );
        assert.equal(
          await scalar("select status from bourbon_profiles where id=$1", [
            pending,
          ]),
          "pending",
        );
        assert.equal(
          await scalar(
            "select auth_user_id from bourbon_guest_access where event_id=$1 and participant_id=$2",
            [oldEvent, seat],
          ),
          guest,
        );
        await db.query(
          "delete from bourbon_guest_access where event_id=$1 and participant_id=$2",
          [oldEvent, hostSeat],
        );
        assert.equal(
          await scalar("select bourbon_activate_member($1,$2)", [
            pending,
            "pending@example.com",
          ]),
          true,
        );
        assert.equal(
          await scalar(
            "select auth_user_id from bourbon_guest_access where event_id=$1",
            [oldEvent],
          ),
          pending,
        );
        assert.equal(
          await scalar("select bourbon_activate_member($1,$2)", [
            pending,
            "pending@example.com",
          ]),
          false,
        );
        assert.equal(
          await scalar("select status from bourbon_profiles where id=$1", [
            pending,
          ]),
          "active",
        );
      },
    );
    await t.test(
      "request limits reject attempts above the configured allowance",
      async () => {
        assert.equal(
          await scalar("select bourbon_take_rate('test',3600,2)"),
          true,
        );
        assert.equal(
          await scalar("select bourbon_take_rate('test',3600,2)"),
          true,
        );
        assert.equal(
          await scalar("select bourbon_take_rate('test',3600,2)"),
          false,
        );
      },
    );
    await db.exec(await migration("20261108202247_invite_only_auth.sql"));
    await db.exec(await migration("20261108205122_defer_invitation_guard.sql"));
    await t.test(
      "direct account creation and user-metadata spoofing fail; service-managed invites work",
      async () => {
        await db.exec(
          "grant usage on schema auth to supabase_auth_admin;grant select,insert,update on auth.users to supabase_auth_admin;set role supabase_auth_admin",
        );
        await assert.rejects(
          db.query(
            `insert into auth.users(id,email) values(gen_random_uuid(),'public@example.com')`,
          ),
          /private invitation/,
        );
        await assert.rejects(
          db.query(
            `insert into auth.users(id,email,raw_user_meta_data) values(gen_random_uuid(),'spoof@example.com','{"blindcap_managed":true}')`,
          ),
          /private invitation/,
        );
        await db.query(
          `insert into auth.users(id,email,raw_app_meta_data) values(gen_random_uuid(),'invited@example.com','{"blindcap_managed":true}')`,
        );
        await db.exec("begin");
        await db.query("insert into auth.users(id,email) values('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','gotrue-order@example.com')");
        await db.query("update auth.users set raw_app_meta_data='{\"blindcap_managed\":true}' where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'");
        await db.exec("commit");
        await db.exec("reset role");
        assert.equal(await scalar("select count(*)::int from auth.users where email='gotrue-order@example.com'"),1);
        assert.equal(
          await scalar(
            "select count(*)::int from auth.users where email='invited@example.com'",
          ),
          1,
        );
        assert.equal(
          await scalar("select count(*)::int from bourbon_events"),
          2,
        );
      },
    );
  } finally {
    await db.close();
  }
});
