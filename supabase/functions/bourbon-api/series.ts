import { seriesLogoUrl, seriesLogoAction } from "./series-logos.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createEvent, type Actor, type Event } from "./engine.ts";
import { getProfile, rate } from "./community.ts";
import {
  annualYear,
  historyEntries,
  revealedEntries,
  leaderboard,
  type HistoryEntry,
} from "./series-shared.ts";
const check = (error: unknown) => {
  if (error)
    throw new Error(
      "Unable to save this change. The year or linked profile may already be in use.",
    );
};
const text = (v: unknown, max: number) => {
  const s = String(v ?? "").trim();
  if (!s || s.length > max)
    throw new Error(`Enter text of 1–${max} characters.`);
  return s;
};
export async function seriesAction(
  input: Record<string, any>,
  db: SupabaseClient,
  a: Actor,
) {
  const p = await getProfile(db, a.id),
    global = p?.status === "active" && p.role === "owner";
  const active = p?.status === "active",
    guest = a.email.endsWith("@guests.blindcap.invalid");
  if (!active && !guest) throw new Error("Approved membership is required.");
  const [{ data: all, error }, { data: members, error: me }] =
    await Promise.all([
      db.from("bourbon_series").select("*"),
      db.from("bourbon_series_members").select("series_id").eq("user_id", a.id),
    ]);
  check(error || me);
  // Issued invitations and guest grants also authorize history immediately; ballots remain private.
  const [{ data: invites, error: ie }, { data: grants, error: ge }] =
    await Promise.all([
      db
        .from("bourbon_member_invites")
        .select("event_id")
        .eq("invitee_id", a.id),
      db
        .from("bourbon_guest_access")
        .select("event_id")
        .eq("auth_user_id", a.id),
    ]);
  check(ie || ge);
  const {data:adminEvents,error:adminError}=await db.from("bourbon_events").select("id").contains("admin_ids",[a.id]);check(adminError);
  const ids = [...(invites ?? []), ...(grants ?? [])].map((x) => x.event_id).concat((adminEvents??[]).map(x=>x.id));
  const linked = ids.length
    ? await db.from("bourbon_editions").select("series_id").in("event_id", ids)
    : { data: [], error: null };
  check(linked.error);
  const visible = (all ?? []).filter(
    (s) =>
      global ||
      s.owner_id === a.id ||
      members?.some((m) => m.series_id === s.id) ||
      linked.data?.some((m) => m.series_id === s.id),
  );
  const manage = (s: any) => active && (global || s.owner_id === a.id);
  const summary = async (s: any) => ({
    logoUrl: await seriesLogoUrl(db, s.logo_path),
    id: s.id,
    title: s.title,
    winnerAward: s.winner_award,
    swillAward: s.swill_award,
    canManage: manage(s),
  });
  if (input.operation === "list")
    return {
      series: await Promise.all(visible.map(summary)),
      canCreate: active,
    };
  if (input.operation === "create") {
    if (!active) throw new Error("Approved membership is required.");
    await rate(db, "series-create:" + a.id, 10, 86400);
    const { data, error } = await db
      .from("bourbon_series")
      .insert({
        owner_id: a.id,
        title: text(input.title, 100),
        winner_award: text(input.winnerAward ?? "Yorktown Tumbler", 80),
        swill_award: text(input.swillAward ?? "Swill Award", 80),
      })
      .select("id")
      .single();
    check(error);
    return data;
  }
  async function detail(s: any) {
    const [{ data: editions, error: ee }, { data: people, error: pe }] =
      await Promise.all([
        db
          .from("bourbon_editions")
          .select("*")
          .eq("series_id", s.id)
          .order("year", { ascending: false }),
        db.from("bourbon_series_people").select("*").eq("series_id", s.id),
      ]);
    check(ee || pe);
    const eventIds = (editions ?? []).map((e) => e.event_id).filter(Boolean);
    const events = eventIds.length
      ? await db.from("bourbon_events").select("id,state").in("id", eventIds)
      : { data: [], error: null };
    check(events.error);
    const rows = (editions ?? []).map((e) => {
      const ev = events.data?.find((x) => x.id === e.event_id)?.state as
        | Event
        | undefined;
      const entries: HistoryEntry[] | null = ev
        ? revealedEntries(ev)
        : e.historical_entries.map((r: HistoryEntry) => {
            const person = people?.find((x) => x.id === r.personId);
            return {
              ...r,
              name: person?.name ?? r.name,
              profileId: person?.profile_id ?? undefined,
            };
          });
      return {
        id: e.id,
        year: e.year,
        revision: e.revision,
        source: ev ? "Blindcap" : "Historical entry",
        eventId: e.event_id,
        canOpen: ev?.ownerId === a.id || ids.includes(e.event_id),
        phase: ev?.phase ?? "complete",
        revealed: ev ? ev.revealed : true,
        entries,
      };
    });
    return {
      ...(await summary(s)),
      editions: rows,
      leaderboard: leaderboard(rows),
      people: manage(s) ? people : [],
    };
  }
  if (input.operation === "achievements") {
    const data = [];
    for (const s of visible) {
      const d = await detail(s);
      const row = d.leaderboard.find((r) => r.profileId === a.id);
      if (row)
        data.push({
          seriesId: s.id,
          title: s.title,
          winnerAward: s.winner_award,
          swillAward: s.swill_award,
          ...row,
        });
    }
    return { achievements: data };
  }
  const s = visible.find((s) => s.id === input.seriesId);
  if (!s) throw new Error("You are not invited to this event series.");
  if (input.operation === "detail") return await detail(s);
  if (!manage(s))
    throw new Error(
      "Only the series creator or site owner can manage its history and editions.",
    );
  if (String(input.operation).startsWith("logo-"))
    return await seriesLogoAction(input, db, s, a.id);
  if (input.operation === "create-edition") {
    const year = annualYear(input.year),
      coordinator = await getProfile(db, String(input.coordinatorId ?? a.id));
    if (coordinator?.status !== "active")
      throw new Error("Select an approved event coordinator.");
    const event = createEvent(
      coordinator.id,
      `${s.title} ${year}`,
      Number(input.tasterCount ?? 12),
    );
    const { error } = await db.rpc("bourbon_create_edition", {
      p_series: s.id,
      p_year: year,
      p_event: event,
      p_actor: a.id,
    });
    check(error);
    return { eventId: event.id };
  }
  if (input.operation === "attach-event") {
    const { data: event, error } = await db
      .from("bourbon_events")
      .select("owner_id,state")
      .eq("id", input.eventId)
      .single();
    check(error);
    if (!event || (!global && event.owner_id !== a.id))
      throw new Error("Only your own events can be attached.");
    const { error: save } = await db.from("bourbon_editions").insert({
      series_id: s.id,
      year: annualYear(input.year),
      event_id: input.eventId,
    });
    check(save);
    const users = [
      event.owner_id,
      ...(event.state.phase === "setup"
        ? []
        : event.state.participants
            .map((x: any) => x.accountId)
            .filter(Boolean)),
    ];
    const { error: grant } = await db
      .from("bourbon_series_members")
      .upsert(
        [...new Set(users)].map((user_id) => ({ series_id: s.id, user_id })),
      );
    check(grant);
    return { saved: true };
  }
  if (input.operation === "link-person") {
    const profile = await getProfile(db, String(input.profileId));
    if (profile?.status !== "active")
      throw new Error("Select an approved member.");
    const { data, error } = await db
      .from("bourbon_series_people")
      .update({ profile_id: profile.id })
      .eq("series_id", s.id)
      .eq("id", input.personId)
      .select("id")
      .maybeSingle();
    check(error);
    if (!data) throw new Error("Historical participant not found.");
    const grant = await db
      .from("bourbon_series_members")
      .upsert({ series_id: s.id, user_id: profile.id });
    check(grant.error);
    return { saved: true };
  }
  if (input.operation === "save-history") {
    const year = annualYear(input.year),
      rows = historyEntries(input.entries);
    const entries = [];
    for (const r of rows) {
      let q = db
        .from("bourbon_series_people")
        .select("*")
        .eq("series_id", s.id);
      q = r.profileId
        ? q.eq("profile_id", r.profileId)
        : q.eq("name_key", r.name.toLowerCase());
      const { data: existing, error } = await q.maybeSingle();
      check(error);
      if (
        r.profileId &&
        (await getProfile(db, r.profileId))?.status !== "active"
      )
        throw new Error("Select an approved member.");
      let person = existing;
      if (!person) {
        const { data, error } = await db
          .from("bourbon_series_people")
          .insert({
            series_id: s.id,
            name: r.name,
            profile_id: r.profileId ?? null,
          })
          .select("*")
          .single();
        check(error);
        person = data;
      }
      if (person.profile_id) {
        const grant = await db
          .from("bourbon_series_members")
          .upsert({ series_id: s.id, user_id: person.profile_id });
        check(grant.error);
      }
      entries.push({ ...r, profileId: undefined, personId: person.id });
    }
    if (input.editionId) {
      const { data, error } = await db
        .from("bourbon_editions")
        .update({
          historical_entries: entries,
          revision: Number(input.revision) + 1,
        })
        .eq("id", input.editionId)
        .eq("series_id", s.id)
        .eq("year", year)
        .is("event_id", null)
        .eq("revision", input.revision)
        .select("id")
        .maybeSingle();
      check(error);
      if (!data)
        throw new Error("History changed. Reload before editing again.");
    } else {
      const { error } = await db
        .from("bourbon_editions")
        .insert({ series_id: s.id, year, historical_entries: entries });
      check(error);
    }
    return { saved: true };
  }
  throw new Error("Unknown series action.");
}
