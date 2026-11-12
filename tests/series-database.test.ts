import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
test("series migration preserves event state, rejects public access, and atomically creates coordinator editions", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table public.bourbon_profiles(id uuid primary key references auth.users(id),status text,role text);`,
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/202611070001_events.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const owner = "11111111-1111-4111-8111-111111111111",
      coord = "22222222-2222-4222-8222-222222222222",
      member = "33333333-3333-4333-8333-333333333333";
    await db.query(`insert into auth.users values($1),($2),($3)`, [
      owner,
      coord,
      member,
    ]);
    await db.query(
      `insert into bourbon_profiles values($1,'active','owner'),($2,'active','member'),($3,'pending','member')`,
      [owner, coord, member],
    );
    const old = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      ownerId: owner,
      revision: 0,
      phase: "setup",
      participants: [],
    };
    await db.query(
      "insert into bourbon_events(id,owner_id,state) values($1,$2,$3)",
      [old.id, owner, JSON.stringify(old)],
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20261110014929_event_series_and_photos.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20261110022410_series_logos.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20261110024409_mailing_addresses_and_coadmins.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(await readFile(new URL('../supabase/migrations/20261110030659_profile_first_and_last_names.sql',import.meta.url),'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/20261110035943_event_types.sql',import.meta.url),'utf8'));
    assert.deepEqual(
      (await db.query<{ state: unknown }>("select state from bourbon_events"))
        .rows[0].state,
      old,
    );
    const series = (
      await db.query<{ id: string }>(
        "insert into bourbon_series(owner_id,title) values($1,$2) returning id",
        [owner, "Yorktown"],
      )
    ).rows[0].id;
    const event = {
      ...old,
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      ownerId: coord,
    };
    await db.query("select bourbon_create_edition($1,2026,$2,$3)", [
      series,
      JSON.stringify(event),
      owner,
    ]);
    assert.equal(
      (
        await db.query<{ owner_id: string }>(
          "select owner_id from bourbon_events where id=$1",
          [event.id],
        )
      ).rows[0].owner_id,
      coord,
    );
    const otherSeries=(await db.query<{id:string}>("insert into bourbon_series(owner_id,title) values($1,'Another series') returning id",[owner])).rows[0].id;
    await assert.rejects(db.query("insert into bourbon_editions(series_id,year,event_id) values($1,2027,$2)",[otherSeries,event.id]),/unique constraint/);
    await assert.rejects(
      db.query("select bourbon_create_edition($1,2027,$2,$3)", [
        series,
        JSON.stringify({
          ...event,
          id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        }),
        coord,
      ]),
    );
    await assert.rejects(
      db.query("select bourbon_create_edition($1,2026,$2,$3)", [
        series,
        JSON.stringify({
          ...event,
          id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        }),
        owner,
      ]),
    );
    assert.equal(
      (await db.query("select id from bourbon_events")).rows.length,
      2,
    );
    await db.query(
      "update bourbon_events set state=$2,revision=1 where id=$1",
      [
        event.id,
        JSON.stringify({
          ...event,
          revision: 1,
          phase: "final",
          participants: [{ accountId: member }],
        }),
      ],
    );
    assert.equal(
      (
        await db.query(
          "select * from bourbon_series_members where user_id=$1",
          [member],
        )
      ).rows.length,
      1,
    );
    const prior = (
      await db.query<{ state: Record<string, unknown> }>(
        "select state from bourbon_events where id=$1",
        [event.id],
      )
    ).rows[0].state;
    await db.query(
      "update bourbon_events set state=$2,revision=2 where id=$1",
      [event.id, JSON.stringify({ ...prior, revision: 2, adminIds: [coord] })],
    );
    assert.deepEqual(
      (
        await db.query<{ admin_ids: string[] }>(
          "select admin_ids from bourbon_events where id=$1",
          [event.id],
        )
      ).rows[0].admin_ids,
      [coord],
    );
    assert.deepEqual(
      (
        await db.query<{ mailing_address: unknown }>(
          "select mailing_address from bourbon_profiles where id=$1",
          [owner],
        )
      ).rows[0].mailing_address,
      {},
    );
    await db.exec("set role anon");
    await assert.rejects(db.query("select * from bourbon_series"));
    await assert.rejects(db.query("select * from bourbon_editions"));
    await assert.rejects(
      db.query("select bourbon_create_edition($1,2028,$2,$3)", [
        series,
        JSON.stringify(event),
        owner,
      ]),
    );
    await assert.rejects(db.query("delete from bourbon_series where id=$1", [series]));
    await db.exec("reset role");
    await db.exec("set role service_role");
    await db.query("delete from bourbon_series where id=$1", [series]);
    await db.exec("reset role");
    assert.equal((await db.query("select id from bourbon_editions where series_id=$1", [series])).rows.length, 0);
    assert.equal((await db.query("select id from bourbon_events where id=$1", [event.id])).rows.length, 1);
    assert.equal((await db.query("select id from bourbon_series where id=$1", [otherSeries])).rows.length, 1);
    assert.equal(
      (
        await db.query<{ public: boolean }>(
          "select public from storage.buckets",
        )
      ).rows[0].public,
      false,
    );
  } finally {
    await db.close();
  }
});
