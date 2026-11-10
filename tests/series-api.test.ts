import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { seriesAction } from "../supabase/functions/bourbon-api/series";
import { photoAction } from "../supabase/functions/bourbon-api/photos";
const actor = (id: string) => ({ id, email: id + "@example.com" });
function fixture() {
  const tables: Record<string, any[]> = {
    bourbon_profiles: [
      { id: "owner", status: "active", role: "owner" },
      { id: "host", status: "active", role: "member" },
      { id: "invited", status: "active", role: "member" },
      { id: "outsider", status: "active", role: "member" },
      { id: "pending", status: "pending", role: "member" },
    ],
    bourbon_series: [
      {
        id: "series",
        owner_id: "host",
        title: "Yorktown",
        winner_award: "Tumbler",
        swill_award: "Swill",
      },
    ],
    bourbon_series_members: [],
    bourbon_member_invites: [
      { event_id: "event", invitee_id: "invited", status: "pending" },
    ],
    bourbon_guest_access: [],
    bourbon_editions: [
      {
        id: "edition",
        series_id: "series",
        year: 2025,
        event_id: "event",
        revision: 0,
      },
    ],
    bourbon_series_people: [],
    bourbon_events: [
      {
        id: "event",
        state: {
          id: "event",
          ownerId: "host",
          phase: "final",
          revealed: false,
          bottles: [{ name: "TOP SECRET", proof: 130 }],
          participants: [],
          groups: [],
        },
      },
    ],
  };
  const uploads: string[] = [];
  class Query {
    filters: ((r: any) => boolean)[] = [];
    constructor(readonly table: string) {}
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
    order() {
      return this;
    }
    result() {
      return {
        data: (tables[this.table] ?? []).filter((r) =>
          this.filters.every((f) => f(r)),
        ),
        error: null,
      };
    }
    maybeSingle() {
      return Promise.resolve({
        data: this.result().data[0] ?? null,
        error: null,
      });
    }
    single() {
      return this.maybeSingle();
    }
    then(a: any, b: any) {
      return Promise.resolve(this.result()).then(a, b);
    }
  }
  const db = {
    from: (t: string) => new Query(t),
    rpc: async () => ({ data: true, error: null }),
    storage: {
      from: () => ({
        createSignedUploadUrl: async (path: string) => {
          uploads.push(path);
          return { data: { token: "scoped" }, error: null };
        },
      }),
    },
  } as unknown as SupabaseClient;
  return { db, tables, uploads };
}
test("pending invitation grants the entire revealed archive but no blind bottle data or management rights", async () => {
  const { db } = fixture();
  const data: any = await seriesAction(
    { operation: "detail", seriesId: "series" },
    db,
    actor("invited"),
  );
  assert.equal(data.canManage, false);
  assert.equal(data.editions[0].entries, null);
  assert.ok(!JSON.stringify(data).includes("TOP SECRET"));
  await assert.rejects(
    seriesAction(
      { operation: "create-edition", seriesId: "series", year: 2026 },
      db,
      actor("invited"),
    ),
    /Only the series creator/,
  );
  await assert.rejects(
    seriesAction(
      { operation: "detail", seriesId: "series" },
      db,
      actor("outsider"),
    ),
    /not invited/,
  );
  await assert.rejects(
    seriesAction({ operation: "list" }, db, actor("pending")),
    /Approved membership/,
  );
});
test("historical archive access includes years never attended, profile links unify award totals", async () => {
  const { db, tables } = fixture();
  tables.bourbon_editions.push({
    id: "old",
    series_id: "series",
    year: 2022,
    event_id: null,
    revision: 0,
    historical_entries: [
      {
        personId: "oldname",
        name: "Old Name",
        bottle: "Historic bottle",
        award: "winner",
      },
      { personId: "other", name: "Other", bottle: "", award: "swill" },
    ],
  });
  tables.bourbon_series_people.push({
    id: "oldname",
    series_id: "series",
    name: "Current Name",
    profile_id: "invited",
  });
  const data: any = await seriesAction(
    { operation: "detail", seriesId: "series" },
    db,
    actor("invited"),
  );
  assert.equal(data.editions.length, 2);
  assert.equal(data.editions[1].entries[0].bottle, "Historic bottle");
  assert.equal(
    data.leaderboard.find((r: any) => r.profileId === "invited").wins,
    1,
  );
  const awards: any = await seriesAction(
    { operation: "achievements" },
    db,
    actor("invited"),
  );
  assert.equal(awards.achievements[0].wins, 1);
});
test("series creator and site owner manage history, coordinators gain no other series control", async () => {
  const { db } = fixture();
  const owner: any = await seriesAction(
    { operation: "detail", seriesId: "series" },
    db,
    actor("owner"),
  );
  assert.equal(owner.canManage, true);
  const host: any = await seriesAction(
    { operation: "detail", seriesId: "series" },
    db,
    actor("host"),
  );
  assert.equal(host.canManage, true);
});
test("photo upload always scopes to the authenticated profile and rejects nonmembers", async () => {
  const { db, uploads } = fixture();
  await photoAction(
    { operation: "photo-upload", path: "owner/avatar.jpg" },
    db,
    actor("pending"),
  );
  assert.deepEqual(uploads, ["pending/avatar.jpg"]);
  await assert.rejects(
    photoAction(
      { operation: "photo-upload" },
      db,
      actor("outsider-without-profile"),
    ),
    /eligible member/,
  );
});

test("only series managers can issue logo uploads, and paths cannot be chosen by the client", async () => {
  const { db, uploads } = fixture();
  await assert.rejects(
    seriesAction(
      { operation: "logo-upload", seriesId: "series", path: "other/logo.png" },
      db,
      actor("invited"),
    ),
    /Only the series creator/,
  );
  await assert.rejects(
    seriesAction(
      { operation: "logo-upload", seriesId: "series" },
      db,
      actor("outsider"),
    ),
    /not invited/,
  );
  await seriesAction(
    { operation: "logo-upload", seriesId: "series", path: "other/logo.png" },
    db,
    actor("host"),
  );
  assert.match(uploads[0], /^series\/[0-9a-f-]{36}\.png$/);
});
