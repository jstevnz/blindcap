import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { communityAction } from "../supabase/functions/bourbon-api/community.ts";
import type { Actor } from "../lib/engine";
type Row = Record<string, unknown>;
const owner: Actor = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "owner@example.com",
};
const member: Actor = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "member@example.com",
};
const token = "a".repeat(64),
  verification = "private-verification-hash";
function fixture() {
  const tables: Record<string, Row[]> = {
    bourbon_profiles: [
      {
        ...owner,
        email: owner.email,
        username: "owner",
        display_name: "Owner",
        bio: "",
        status: "active",
        role: "owner",
        discoverable: true,
      },
      {
        ...member,
        email: member.email,
        username: "member",
        display_name: "Member",
        bio: "",
        status: "active",
        role: "member",
        discoverable: true,
      },
    ],
    bourbon_community_invites: [
      {
        id: "invitation",
        email: "new@example.com",
        token_hash: "unused",
        expires_at: "2099-01-01T00:00:00Z",
        redeemed_at: null,
        reserved_user_id: null,
      },
    ],
    bourbon_member_invites: [],
  };
  const calls: { name: string; value: unknown }[] = [];
  let limited = false;
  class Query implements PromiseLike<{ data: Row[]; error: null }> {
    filters: ((r: Row) => boolean)[] = [];
    mutation: Row | null = null;
    kind = "read";
    constructor(readonly table: string) {}
    select() {
      return this;
    }
    eq(k: string, v: unknown) {
      if (k !== "token_hash") this.filters.push((r) => r[k] === v);
      return this;
    }
    is(k: string, v: unknown) {
      this.filters.push((r) => (r[k] ?? null) === v);
      return this;
    }
    gt(k: string, v: unknown) {
      this.filters.push((r) => String(r[k]) > String(v));
      return this;
    }
    order() {
      return this;
    }
    limit() {
      return this;
    }
    or() {
      return this;
    }
    update(v: Row) {
      this.mutation = v;
      this.kind = "update";
      return this;
    }
    upsert(v: Row) {
      this.mutation = v;
      this.kind = "upsert";
      return this;
    }
    insert(v: Row) {
      this.mutation = v;
      this.kind = "insert";
      return this;
    }
    result() {
      let rows = tables[this.table] ?? [];
      if (this.mutation) {
        if (this.kind === "upsert" || this.kind === "insert") {
          let found = rows.find((r) =>
            this.mutation!.id
              ? r.id === this.mutation!.id
              : r.email === this.mutation!.email,
          );
          if (!found) {
            found = { id: this.mutation.id ?? "new-invite" };
            rows.push(found);
          }
          Object.assign(found, this.mutation);
          rows = [found];
        } else {
          rows = rows.filter((r) => this.filters.every((f) => f(r)));
          rows.forEach((r) => Object.assign(r, this.mutation));
        }
      } else rows = rows.filter((r) => this.filters.every((f) => f(r)));
      return { data: rows, error: null };
    }
    async maybeSingle() {
      const r = this.result();
      return { data: r.data[0] ?? null, error: null };
    }
    then<T = { data: Row[]; error: null }, E = never>(
      resolve?:
        | ((v: { data: Row[]; error: null }) => T | PromiseLike<T>)
        | null,
      reject?: ((e: unknown) => E | PromiseLike<E>) | null,
    ) {
      return Promise.resolve(this.result()).then(resolve, reject);
    }
  }
  const db = {
    from: (table: string) => new Query(table),
    rpc: async (name: string, args: Row) => {
      calls.push({ name, value: args });
      if (name === "bourbon_activate_member") {
        const p = tables.bourbon_profiles.find((p) => p.id === args.p_user);
        if (p) p.status = "active";
      }
      return { data: !limited, error: null };
    },
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: "proven-guest",
            email: "guest-real@guests.blindcap.invalid",
          },
        },
      }),
      admin: {
        createUser: async (v: Row) => {
          calls.push({ name: "createUser", value: v });
          return { data: { user: { id: "new-user" } }, error: null };
        },
        updateUserById: async (id: string, v: Row) => {
          calls.push({ name: "updateUser", value: { id, ...v } });
          return { error: null };
        },
        deleteUser: async (id: string) => {
          calls.push({ name: "deleteUser", value: id });
          return { error: null };
        },
        generateLink: async (v: Row) => {
          calls.push({ name: "generateLink", value: v });
          return {
            data: { properties: { hashed_token: verification } },
            error: null,
          };
        },
      },
    },
  } as unknown as SupabaseClient;
  return {
    db,
    tables,
    calls,
    limit: () => {
      limited = true;
    },
  };
}
function req(auth = false, email = true) {
  return new Request("https://blindcap.net/api/community", {
    method: "POST",
    headers: {
      ...(email ? { "x-blindcap-email-key": "test-server-email-key" } : {}),
      ...(auth ? { authorization: "Bearer guest-proof" } : {}),
    },
  });
}
const register = {
  operation: "register",
  token,
  username: "new_member",
  displayName: "New Member",
  password: "a sufficiently long password",
};
test("registration requires a valid invitation and sends verification only to its bound email", async () => {
  const f = fixture(),
    sent: Row[] = [];
  const previous = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    sent.push(JSON.parse(String(init?.body)));
    assert.equal(
      new Headers(init?.headers).get("authorization"),
      "Bearer test-server-email-key",
    );
    return Response.json({ id: "mock-email" });
  };
  try {
    const result = await communityAction(
      { ...register, email: "attacker@example.com" },
      f.db,
      null,
      req(true),
    );
    assert.deepEqual(result, { verificationSent: true });
    assert.equal(JSON.stringify(result).includes(verification), false);
    assert.equal(JSON.stringify(result).includes("password"), false);
    assert.deepEqual(sent[0].to, ["new@example.com"]);
    assert.equal(sent[0].from, "Blindcap <invitations@blindcap.net>");
    assert.ok(
      String(sent[0].text).includes(
        "/account/confirm#token_hash=" + verification,
      ),
    );
    assert.deepEqual(
      (f.calls.find((c) => c.name === "createUser")!.value as Row).app_metadata,
      { blindcap_managed: true },
    );
    assert.equal(
      (f.calls.find((c) => c.name === "createUser")!.value as Row)
        .email_confirm,
      false,
    );
    const p = f.tables.bourbon_profiles.find((p) => p.id === "new-user")!;
    assert.equal(p.status, "pending");
    assert.equal(p.role, "member");
    assert.equal(
      f.tables.bourbon_community_invites[0].claim_guest_id,
      "proven-guest",
    );
    assert.equal(
      f.tables.bourbon_community_invites[0].reserved_user_id,
      "new-user",
    );
  } finally {
    globalThis.fetch = previous;
  }
});
test("invalid, expired and rate-limited registrations never create an account", async () => {
  for (const mode of ["invalid", "expired", "limited"]) {
    const f = fixture();
    if (mode === "expired")
      f.tables.bourbon_community_invites[0].expires_at = "2000-01-01";
    if (mode === "limited") f.limit();
    await assert.rejects(
      communityAction(
        { ...register, token: mode === "invalid" ? "wrong" : token },
        f.db,
        null,
        req(),
      ),
    );
    assert.equal(
      f.calls.some((c) => c.name === "createUser"),
      false,
    );
  }
});
test("only the owner can enroll new members; existing members can still search profiles privately", async () => {
  const f = fixture();
  await assert.rejects(
    communityAction(
      { operation: "community-invite", email: "new@example.com" },
      f.db,
      member,
      req(),
    ),
    /Only the community owner/,
  );
  const result = await communityAction(
    { operation: "search", query: "member" },
    f.db,
    member,
    req(),
  );
  assert.ok("profiles" in result);
  for (const p of result.profiles!) {
    assert.equal("email" in p, false);
    assert.equal("role" in p, false);
    assert.equal("status" in p, false);
  }
});
test("verified enrollment cannot redeem an invitation belonging to another email", async () => {
  const f = fixture();
  await assert.rejects(
    communityAction(
      { operation: "enroll", token, username: "other", displayName: "Other" },
      f.db,
      member,
      req(),
    ),
    /email this community invitation/,
  );
  assert.equal(
    f.calls.some((c) => c.name === "bourbon_activate_member"),
    false,
  );
});
test("recovery uses saved account email and never returns authentication tokens", async () => {
  const f = fixture(),
    sent: Row[] = [];
  const previous = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    sent.push(JSON.parse(String(init?.body)));
    return Response.json({ id: "mock-email" });
  };
  try {
    assert.deepEqual(
      await communityAction(
        { operation: "recover", email: " MEMBER@EXAMPLE.COM " },
        f.db,
        null,
        req(),
      ),
      { sent: true },
    );
    assert.deepEqual(sent[0].to, [member.email]);
    assert.ok(String(sent[0].text).includes("&type=recovery"));
    assert.deepEqual(
      await communityAction(
        { operation: "recover", email: "unknown@example.com" },
        f.db,
        null,
        req(),
      ),
      { sent: true },
    );
    assert.equal(sent.length, 1);
  } finally {
    globalThis.fetch = previous;
  }
});
test("membership roles and email cannot be changed through profile editing", async () => {
  const f = fixture();
  await communityAction(
    {
      operation: "profile",
      username: "new_name",
      displayName: "Renamed",
      role: "owner",
      email: "changed@example.com",
      status: "active",
    },
    f.db,
    member,
    req(),
  );
  const p = f.tables.bourbon_profiles.find((p) => p.id === member.id)!;
  assert.equal(p.role, "member");
  assert.equal(p.email, member.email);
  assert.equal(p.username, "new_name");
});

test("resending verification never changes a pending account’s password or profile", async () => {
  const f = fixture();
  f.tables.bourbon_profiles.push({
    id: "pending-user",
    email: "new@example.com",
    username: "original_name",
    display_name: "Original",
    bio: "Original bio",
    status: "pending",
    role: "member",
    discoverable: true,
  });
  f.tables.bourbon_community_invites[0].reserved_user_id = "pending-user";
  const previous = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ id: "mock-email" });
  try {
    const result = await communityAction(
      {
        ...register,
        username: "changed_name",
        password: "an attacker chosen new password",
      },
      f.db,
      null,
      req(),
    );
    assert.deepEqual(result, {
      verificationSent: true,
      existingRegistration: true,
    });
    assert.equal(
      f.calls.some((c) => c.name === "updateUser" || c.name === "createUser"),
      false,
    );
    const p = f.tables.bourbon_profiles.find((p) => p.id === "pending-user")!;
    assert.equal(p.username, "original_name");
    assert.equal(p.display_name, "Original");
    assert.equal(p.bio, "Original bio");
  } finally {
    globalThis.fetch = previous;
  }
});
test("username login resolves the saved email and delegates password checks to Supabase", async () => {
  const f = fixture(),
    previous = globalThis.fetch;
  const oldDeno = Object.getOwnPropertyDescriptor(globalThis, "Deno");
  Object.defineProperty(globalThis, "Deno", {
    configurable: true,
    value: {
      env: {
        get: (key: string) =>
          key === "SUPABASE_URL"
            ? "https://auth.example.test"
            : "public-test-key",
      },
    },
  });
  let submitted: Row | undefined;
  globalThis.fetch = async (url, init) => {
    assert.ok(String(url).includes("/auth/v1/token?grant_type=password"));
    submitted = JSON.parse(String(init?.body));
    return Response.json({
      access_token: "test-access-token",
      refresh_token: "test-refresh-token",
      expires_in: 3600,
      token_type: "bearer",
      user: {
        id: member.id,
        email: member.email,
        aud: "authenticated",
        role: "authenticated",
        app_metadata: {},
        user_metadata: {},
        created_at: new Date().toISOString(),
      },
    });
  };
  try {
    const result = await communityAction(
      {
        operation: "login",
        identifier: " MEMBER ",
        password: "correct private password",
        email: "attacker@example.com",
      },
      f.db,
      null,
      req(),
    );
    assert.equal(submitted?.email, member.email);
    assert.equal(submitted?.password, "correct private password");
    assert.ok("session" in result);
    assert.deepEqual(result.session, {
      access_token: "test-access-token",
      refresh_token: "test-refresh-token",
    });
    await assert.rejects(
      communityAction(
        { operation: "login", identifier: "unknown", password: "anything" },
        f.db,
        null,
        req(),
      ),
      /Username, email or password is incorrect/,
    );
  } finally {
    globalThis.fetch = previous;
    if (oldDeno) Object.defineProperty(globalThis, "Deno", oldDeno);
    else Reflect.deleteProperty(globalThis, "Deno");
  }
});
