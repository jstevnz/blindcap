import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const owner = "002ee828-fbc2-4df6-ae69-40271a38020d",
  host = "11111111-1111-4111-8111-111111111111",
  applicant = "22222222-2222-4222-8222-222222222222",
  rejected = "33333333-3333-4333-8333-333333333333",
  guest = "44444444-4444-4444-8444-444444444444",
  event = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  seat = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
test("signup approval migration preserves members and requires owner approval before activation", async (t) => {
  const db = new PGlite();
  const scalar = async (sql: string, params: unknown[] = []) =>
    Object.values(
      (await db.query<Record<string, unknown>>(sql, params)).rows[0],
    )[0];
  const migrate = async (name: string) =>
    db.exec(
      await readFile(
        new URL("../supabase/migrations/" + name, import.meta.url),
        "utf8",
      ),
    );
  const review = (
    actor: string,
    target = applicant,
    decision = "approve",
    username = "applicant",
  ) =>
    scalar("select public.review_bourbon_member($1,$2,$3,$4)", [
      actor,
      target,
      decision,
      username,
    ]);
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade);",
    );
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at) values($1,'owner@example.com',now()),($2,'host@example.com',now()),($3,'applicant@example.com',null),($4,'rejected@example.com',now()),($5,'guest@guests.blindcap.invalid',now())",
      [owner, host, applicant, rejected, guest],
    );
    await migrate("202611070001_events.sql");
    await migrate("202611070002_guest_invites.sql");
    await db.query(
      "insert into bourbon_events(id,owner_id,state) values($1,$2,$3)",
      [
        event,
        owner,
        JSON.stringify({
          id: event,
          ownerId: owner,
          revision: 0,
          title: "Existing event",
        }),
      ],
    );
    await migrate("20261108201018_community_accounts.sql");
    await db.query(
      "insert into bourbon_profiles(id,email,username,display_name,status) values($1,'host@example.com','host_one','Host','active'),($2,'applicant@example.com','applicant','Applicant','pending'),($3,'rejected@example.com','rejected','Rejected','pending')",
      [host, applicant, rejected],
    );
    const digest = await scalar("select md5(state::text) from bourbon_events");
    await migrate("20261108214337_membership_applications.sql");
    await t.test(
      "existing event and active memberships remain intact; applicants have no approval",
      async () => {
        assert.equal(
          await scalar("select md5(state::text) from bourbon_events"),
          digest,
        );
        assert.equal(
          await scalar(
            "select count(*)::int from bourbon_profiles where status='active' and approved_at is not null",
          ),
          2,
        );
        assert.equal(
          await scalar("select approved_at from bourbon_profiles where id=$1", [
            applicant,
          ]),
          null,
        );
      },
    );
    await t.test(
      "browser roles cannot read applications or execute review functions",
      async () => {
        for (const role of ["anon", "authenticated"]) {
          await db.exec("set role " + role);
          await assert.rejects(review(owner), /permission denied/);
          await assert.rejects(
            db.query("select pending_bourbon_members($1)", [owner]),
            /permission denied/,
          );
          await db.exec("reset role");
        }
      },
    );
    await db.exec("set role service_role");
    await t.test(
      "only owner sees private pending profiles; ordinary host cannot approve or delete",
      async () => {
        const pending = (await scalar("select pending_bourbon_members($1)", [
          owner,
        ])) as { id: string; verified: boolean; email: string }[];
        assert.equal(pending.length, 2);
        assert.equal(pending.find((p) => p.id === applicant)?.verified, false);
        assert.equal(pending.find((p) => p.id === rejected)?.verified, true);
        assert.deepEqual(
          await scalar("select pending_bourbon_members($1)", [host]),
          [],
        );
        assert.equal(await review(host), false);
        assert.equal(await review(host, rejected, "delete", "rejected"), false);
      },
    );
    await t.test(
      "email verification and legacy invitation activation alone never approve a signup",
      async () => {
        await assert.rejects(review(owner), /verify their email/);
        await db.exec("reset role");
        await db.query(
          "update auth.users set email_confirmed_at=now() where id=$1",
          [applicant],
        );
        await db.exec("set role service_role");
        await db.query(
          "insert into bourbon_community_invites(token_hash,email,invited_by,expires_at,reserved_user_id) values('unused','applicant@example.com',$1,now()+interval '1 day',$2)",
          [owner, applicant],
        );
        assert.equal(
          await scalar("select bourbon_activate_member($1,$2)", [
            applicant,
            "applicant@example.com",
          ]),
          false,
        );
        assert.equal(
          await scalar("select status from bourbon_profiles where id=$1", [
            applicant,
          ]),
          "pending",
        );
      },
    );
    await t.test(
      "owner approval records the decision, makes profile active and safely transfers proven guest history",
      async () => {
        await db.query("insert into bourbon_guest_access values($1,$2,$3)", [
          event,
          seat,
          guest,
        ]);
        await db.query(
          "update bourbon_profiles set claim_guest_id=$1 where id=$2",
          [guest, applicant],
        );
        assert.equal(
          await review(owner, applicant, "approve", "Wrong username"),
          false,
        );
        assert.equal(await review(owner), true);
        assert.equal(
          await scalar("select status from bourbon_profiles where id=$1", [
            applicant,
          ]),
          "active",
        );
        assert.equal(
          await scalar("select approved_by from bourbon_profiles where id=$1", [
            applicant,
          ]),
          owner,
        );
        assert.equal(
          await scalar(
            "select auth_user_id from bourbon_guest_access where event_id=$1",
            [event],
          ),
          applicant,
        );
        assert.equal(await review(owner), false);
        assert.equal(
          await review(owner, applicant, "delete", "applicant"),
          false,
        );
      },
    );
    await t.test(
      "deleting a pending signup removes that profile and identity, not members or events",
      async () => {
        await db.exec("reset role");
        await db.query(
          "insert into auth.sessions values(gen_random_uuid(),$1)",
          [rejected],
        );
        await db.exec("set role service_role");
        await db.query(
          "insert into bourbon_community_invites(token_hash,email,invited_by,expires_at,reserved_user_id) values('reject','rejected@example.com',$1,now()+interval '1 day',$2)",
          [owner, rejected],
        );
        assert.equal(await review(owner, rejected, "delete", "rejected"), true);
        assert.equal(
          await scalar(
            "select count(*)::int from bourbon_profiles where id=$1",
            [rejected],
          ),
          0,
        );
        assert.equal(
          await scalar("select count(*)::int from auth.users where id=$1", [
            rejected,
          ]),
          0,
        );
        assert.equal(
          await scalar("select count(*)::int from bourbon_events"),
          1,
        );
        assert.equal(
          await scalar("select status from bourbon_profiles where id=$1", [
            applicant,
          ]),
          "active",
        );
        await db.exec("reset role");
        assert.equal(
          await scalar(
            "select count(*)::int from auth.sessions where user_id=$1",
            [rejected],
          ),
          0,
        );
      },
    );
    await t.test("email usernames preserve existing identities, approvals and linked event access", async () => {
      await migrate("20261112191925_email_usernames.sql");
      assert.equal(await scalar("select count(*)::int from bourbon_profiles where username <> email"), 0);
      assert.equal(await scalar("select username from bourbon_profiles where id=$1", [host]), "host@example.com");
      assert.equal(await scalar("select status from bourbon_profiles where id=$1", [applicant]), "active");
      assert.equal(await scalar("select auth_user_id from bourbon_guest_access where event_id=$1", [event]), applicant);
      assert.equal(await scalar("select md5(state::text) from bourbon_events where id=$1", [event]), digest);
      await assert.rejects(db.query("update bourbon_profiles set username='separate_name' where id=$1", [host]), /username_matches_email/);
    });
  } finally {
    await db.close();
  }
});
