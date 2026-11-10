import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createEvent, applyCommand } from "../lib/engine";
const a = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "a@example.com",
  },
  b = { id: "22222222-2222-4222-8222-222222222222", email: "b@example.com" },
  c = { id: "33333333-3333-4333-8333-333333333333", email: "c@example.com" };
const profiles = [
  { ...a, display_name: "Host A", status: "active", role: "member" },
  { ...b, display_name: "Host B", status: "active", role: "member" },
  { ...c, display_name: "Community owner", status: "active", role: "owner" },
];
let ea = createEvent(a.id, "Host A event", 2),
  eb = createEvent(b.id, "Host B event", 2);
eb = applyCommand(eb, b, {
  type: "setup",
  participants: [
    { name: "Pending A", email: a.email, accountId: a.id },
    { name: "Host B", email: b.email, accountId: b.id },
  ],
  bottles: [
    { name: "Secret A", ownerIndex: 0 },
    { name: "Secret B", ownerIndex: 1 },
  ],
});
const events = [
  {
    id: ea.id,
    state: ea,
    owner_id: a.id,
    member_emails: [],
    created_at: "2026-11-08T00:00:00Z",
  },
  {
    id: eb.id,
    state: eb,
    owner_id: b.id,
    member_emails: [a.email, b.email],
    created_at: "2026-11-09T00:00:00Z",
  },
];
let actor = a;
let managed = false;
const rpcs: { name: string; args: Record<string, unknown> }[] = [];
let rpcResult = true;
let handler: (req: Request) => Promise<Response>;
const previous = globalThis.fetch,
  oldDeno = Object.getOwnPropertyDescriptor(globalThis, "Deno");
Object.defineProperty(globalThis, "Deno", {
  configurable: true,
  value: {
    env: {
      get: (key: string) =>
        key === "SUPABASE_URL"
          ? "https://unit.supabase.test"
          : "test-public-key",
    },
    serve: (h: typeof handler) => {
      handler = h;
    },
  },
});
globalThis.fetch = async (input, init) => {
  const u = new URL(String(input));
  if (u.pathname === "/auth/v1/user")
    return Response.json({
      ...actor,
      aud: "authenticated",
      role: "authenticated",
      email_confirmed_at: "2026-11-08T00:00:00Z",
      user_metadata: { role: "owner" },
      app_metadata: { blindcap_managed: managed },
    });
  if (u.pathname.startsWith("/rest/v1/rpc/")) {
    rpcs.push({
      name: u.pathname.split("/").at(-1)!,
      args: JSON.parse(String(init?.body)),
    });
    return Response.json(rpcResult);
  }
  const table = u.pathname.split("/").at(-1);
  let rows: Record<string, unknown>[] =
    table === "bourbon_profiles"
      ? profiles
      : table === "bourbon_events"
        ? events
        : [];
  const or = u.searchParams.get("or");
  if (or) {
    const own = or.match(/owner_id\.eq\.([^,)]+)/)?.[1];
    const admin = or.match(/admin_ids\.cs\.\{([^}]+)\}/)?.[1];
    rows = rows.filter(
      (r) =>
        r.owner_id === own ||
        (r.admin_ids as string[] | undefined)?.includes(admin ?? ""),
    );
  }
  for (const [key, value] of u.searchParams) {
    if (value.startsWith("eq."))
      rows = rows.filter((row) => row[key] === value.slice(3));
    if (value.startsWith("in."))
      rows = rows.filter((row) =>
        value.slice(4, -1).split(",").includes(String(row[key])),
      );
    if (value.startsWith("cs."))
      rows = rows.filter((row) =>
        (row[key] as string[]).includes(value.slice(4, -1)),
      );
  }
  return Response.json(rows);
};
before(async () => {
  await import("../supabase/functions/bourbon-api/index.ts");
});
after(() => {
  globalThis.fetch = previous;
  if (oldDeno) Object.defineProperty(globalThis, "Deno", oldDeno);
  else Reflect.deleteProperty(globalThis, "Deno");
});
async function call(
  as: typeof a,
  payload: Record<string, unknown>,
  signed = true,
) {
  actor = as;
  rpcs.length = 0;
  rpcResult = true;
  const response = await handler(
    new Request("https://unit.supabase.test/functions/v1/bourbon-api", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(signed ? { Authorization: "Bearer test-user-token" } : {}),
      },
      body: JSON.stringify(payload),
    }),
  );
  return { status: response.status, data: await response.json() };
}
test("the verified community owner sees all event summaries without receiving bottle identities", async () => {
  const r = await call(c, { action: "catalog" });
  assert.equal(r.status, 200);
  assert.equal(r.data.communityOwner, true);
  assert.equal(r.data.events.length, 2);
  assert.ok(
    r.data.events.every(
      (e: { canDelete: boolean; canOpen: boolean }) =>
        e.canDelete && !e.canOpen,
    ),
  );
  assert.equal(JSON.stringify(r.data).includes("Secret A"), false);
  assert.equal(JSON.stringify(r.data).includes(a.email), false);
});
test("ordinary hosts see their own events, not other hosts’ pending invitations or forged owner metadata", async () => {
  const r = await call(a, { action: "catalog", role: "owner" });
  assert.equal(r.status, 200);
  assert.equal(r.data.communityOwner, false);
  assert.equal(r.data.events.length, 1);
  assert.equal(r.data.events[0].id, ea.id);
  assert.equal(r.data.events[0].canDelete, true);
});
test("deletion requires confirmation of the exact current event revision and title", async () => {
  for (const extra of [
    {},
    { confirmed: true, title: "Wrong title", revision: ea.revision },
    { confirmed: true, title: ea.title, revision: ea.revision + 1 },
  ]) {
    const r = await call(a, { action: "delete", id: ea.id, ...extra });
    assert.ok([400, 409].includes(r.status));
    assert.equal(rpcs.length, 0);
  }
});
test("other hosts cannot delete an event by supplying the owner’s identity", async () => {
  const r = await call(b, {
    action: "delete",
    id: ea.id,
    confirmed: true,
    title: ea.title,
    revision: ea.revision,
    actorId: c.id,
    role: "owner",
  });
  assert.equal(r.status, 403);
  assert.equal(rpcs.length, 0);
});
test("host and community-owner deletion use the verified actor ID and the restricted database function", async () => {
  for (const as of [a, c]) {
    const r = await call(as, {
      action: "delete",
      id: ea.id,
      confirmed: true,
      title: ea.title,
      revision: ea.revision,
      actorId: b.id,
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.deleted, true);
    assert.deepEqual(rpcs, [
      {
        name: "delete_bourbon_event",
        args: {
          p_id: ea.id,
          p_actor: as.id,
          p_revision: ea.revision,
          p_title: ea.title,
        },
      },
    ]);
  }
});
test("anonymous catalog and deletion requests are rejected", async () => {
  for (const action of ["catalog", "delete"])
    assert.equal((await call(a, { action, id: ea.id }, false)).status, 401);
});

test("pending profiles cannot access event APIs even when they have an old email seat or event ID", async () => {
  const profile = profiles.find((p) => p.id === a.id)!;
  profile.status = "pending";
  try {
    for (const action of [
      "create",
      "list",
      "catalog",
      "history",
      "get",
      "delete",
    ])
      assert.equal(
        (
          await call(a, {
            action,
            id: ea.id,
            title: ea.title,
            tasterCount: 2,
            confirmed: true,
            revision: ea.revision,
          })
        ).status,
        403,
      );
  } finally {
    profile.status = "active";
  }
});

test("managed non-guest identities without a profile cannot gain event access during cleanup", async () => {
  const index = profiles.findIndex((p) => p.id === a.id),
    [saved] = profiles.splice(index, 1);
  managed = true;
  try {
    for (const action of ["list", "catalog", "get", "create"])
      assert.equal(
        (
          await call(a, {
            action,
            id: ea.id,
            title: "Not allowed",
            tasterCount: 2,
          })
        ).status,
        403,
      );
  } finally {
    profiles.splice(index, 0, saved);
    managed = false;
  }
});

test("co-admin event discovery and host controls work without allowing team delegation", async () => {
  ea.adminIds = [b.id];
  Object.assign(events[0], { admin_ids: [b.id] });
  try {
    const catalog = await call(b, { action: "catalog" });
    assert.equal(catalog.status, 200);
    assert.ok(
      catalog.data.events.some(
        (e: { id: string; canOpen: boolean }) => e.id === ea.id && e.canOpen,
      ),
    );
    const view = await call(b, { action: "get", id: ea.id });
    assert.equal(view.status, 200);
    assert.equal(view.data.admin, true);
    const team = await call(b, { action: "team", id: ea.id });
    assert.equal(team.status, 200);
    assert.equal(team.data.canManage, false);
    const denied = await call(b, {
      action: "team-set",
      id: ea.id,
      revision: ea.revision,
      adminIds: [c.id],
    });
    assert.notEqual(denied.status, 200);
    assert.match(denied.data.error, /primary host/);
    const owner = await call(a, {
      action: "team-set",
      id: ea.id,
      revision: ea.revision,
      adminIds: [c.id],
    });
    assert.equal(owner.status, 200);
    assert.deepEqual(
      rpcs.find((x) => x.name === "save_bourbon_community_event")?.args
        .p_state && (rpcs[0].args.p_state as { adminIds: string[] }).adminIds,
      [c.id],
    );
    const mailing = await call(c, { action: "mailing-list", id: ea.id });
    assert.notEqual(mailing.status, 200);
    assert.match(mailing.data.error, /Only this event/);
  } finally {
    delete ea.adminIds;
    Object.assign(events[0], { admin_ids: [] });
  }
});

test('event-scoped rules metadata is available to authorized hosts, not unaccepted invitees',async()=>{
 const host=await call(b,{action:'get',id:eb.id});assert.equal(host.status,200);assert.equal(host.data.eventType,'bourbon-tasting');
 const pending=await call(a,{action:'get',id:eb.id});assert.equal(pending.status,403);assert.equal(pending.data.eventType,undefined);
 const invalid=await call(a,{action:'create',title:'Unsupported',eventType:'wine'});assert.notEqual(invalid.status,200);assert.match(invalid.data.error,/event type/);
});
