import {isBlindLocked} from "./blind-access.ts";
import {requireEventType,eventTypeFor,type EventType} from "./event-types.ts";
import { tournamentPlan, validCount } from "./tournament.ts";
import { randomInt, randomUUID } from "node:crypto";
export type Stage = "opening" | "semifinal" | "final";
export type Participant = {
  slot?: number;
  firstName?: string;
  lastName?: string;
  id: string;
  name: string;
  email: string;
  invitationEmail?: string;
  accountId?: string;
};
export type Bottle = {
  id: string;
  number: number;
  distillery?: string;
  proof?: number;
  abv?: number;
  name: string;
  ownerId: string;
};
export type Entry = {
  bottleId: string;
  rank: number;
  aroma: number;
  flavor: number;
  smoothness: number;
  enjoyment: number;
};
export type Ballot = { participantId: string; entries: Entry[] };
export type Group = {
  cupNumbers?: Record<string,number>;
  publicIds?: Record<string,string>;
  id: string;
  name: string;
  stage: Stage;
  status: "waiting" | "open" | "closed";
  bottleIds: string[];
  ballots: Ballot[];
  runoffKey?: string;
};
export type Event = {
  workflowVersion?: 2;
  rosterInvited?: boolean;
  blindParticipantIds?: string[];
  blindUnlockedIds?: string[];
  blindAccessLog?: {actorId:string;action:"lock"|"unlock";at:string}[];
  eventType?: EventType;
  adminIds?: string[];
  id: string;
  title: string;
  tasterCount?: number;
  ownerId: string;
  revision: number;
  phase: "setup" | "opening" | "semifinal" | "final" | "complete";
  revealed: boolean;
  participants: Participant[];
  bottles: Bottle[];
  groups: Group[];
  resolutions: Record<string, string[]>;
};
export type Actor = { id: string; email: string; guestParticipantId?: string };
export type Result = {
  bottleId: string;
  place: number;
  tier: Stage;
  score: number;
  preference: number;
  enjoyment: number;
  stages: Partial<Record<Stage, number>>;
};
const eps = 1e-8;
export function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
export function createEvent(
  ownerId: string,
  title: string,
  tasterCount = 12,
  eventType: unknown = "bourbon-tasting",
): Event {
  const type=requireEventType(eventType);
  assert(
    validCount(tasterCount),
    "Choose a whole number of tasters from 2 to 16.",
  );
  assert(
    title.trim().length > 0 && title.length <= 100,
    "Enter an event name (up to 100 characters).",
  );
  return {
    id: randomUUID(),
    title: title.trim(),
    eventType:type,
    tasterCount,
    ownerId,
    revision: 0,
    phase: "setup",
    revealed: false,
    participants: [],
    bottles: [],
    groups: [],
    resolutions: {},
  };
}
export function member(e: Event, a: Actor) {
  return e.participants.find((p) =>
    a.guestParticipantId
      ? p.id === a.guestParticipantId
      : e.workflowVersion===2 ? false : !p.accountId && p.email.toLowerCase() === a.email.toLowerCase(),
  );
}
export function isEventAdmin(e: Event, a: Actor) {
  return !isBlindLocked(e,a.id) && (e.ownerId === a.id || !!e.adminIds?.includes(a.id) || !!e.blindUnlockedIds?.includes(a.id));
}
export function authorized(e: Event, a: Actor) {
  return isEventAdmin(e,a) || !!member(e, a);
}
export function shuffle<T>(input: T[]): T[] {
  const a = [...input];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function group(stage: Stage, index: number, ids: string[]): Group {
  const order=shuffle(ids);
  return {
    cupNumbers:Object.fromEntries(order.map((id,i)=>[id,i+1])),
    publicIds:Object.fromEntries(ids.map(id=>[id,randomUUID()])),
    id: randomUUID(),
    name: `${stage === "opening" ? "Opening" : stage === "semifinal" ? "Semifinal" : "Final"} ${index + 1}`,
    stage,
    status: "waiting",
    bottleIds: ids,
    ballots: [],
  };
}
export function metrics(g: Group, id: string) {
  const n = g.bottleIds.length;
  assert(n >= 2, "A group needs two bottles.");
  const entries = g.ballots
    .map((b) => b.entries.find((x) => x.bottleId === id)!)
    .filter(Boolean);
  assert(entries.length > 0, "This group has no submitted scores.");
  const mean = (f: (x: Entry) => number) =>
    entries.reduce((s, x) => s + f(x), 0) / entries.length;
  return {
    bottleId: id,
    score: mean((x) =>
      g.runoffKey
        ? (100 * (n - x.rank)) / (n - 1)
        : (80 * (n - x.rank)) / (n - 1) +
          (5 * (x.aroma + x.flavor + x.smoothness + x.enjoyment - 4)) / 9,
    ),
    preference: mean((x) => (100 * (n - x.rank)) / (n - 1)),
    enjoyment: mean((x) => (100 * (x.enjoyment - 1)) / 9),
  };
}
type Metric = {
  bottleId: string;
  score: number;
  preference: number;
  enjoyment: number;
};
export function compare(a: Metric, b: Metric) {
  for (const key of ["score", "preference", "enjoyment"] as const) {
    if (Math.abs(a[key] - b[key]) > eps) return b[key] - a[key];
  }
  return 0;
}
function ordered(e: Event, key: string, items: Metric[]) {
  return [...items].sort(
    (a, b) =>
      compare(a, b) || resolutionCompare(e, key, a.bottleId, b.bottleId),
  );
}
function resolutionCompare(e: Event, key: string, a: string, b: string) {
  const order = e.resolutions[key];
  return order?.includes(a) && order.includes(b)
    ? order.indexOf(a) - order.indexOf(b)
    : 0;
}
function ensureRunoff(e: Event, key: string, ids: string[], stage: Stage) {
  if (!e.groups.some((g) => g.runoffKey === key && g.status !== "closed")) {
    const g = group(stage, 0, ids);
    g.name = "Blind tie-break";
    g.runoffKey = key;
    e.groups.push(g);
  }
}
function normalGroups(e: Event, stage: Stage) {
  return e.groups.filter((g) => g.stage === stage && !g.runoffKey);
}
export function eventSize(e: Event) {
  return e.tasterCount ?? (e.participants.length || 12);
}
function placementTie(e: Event, a: string, b: string) {
  return (
    resolutionCompare(e, "award:top", a, b) ||
    resolutionCompare(e, "award:bottom", a, b)
  );
}
function advance(e: Event) {
  const plan = tournamentPlan(eventSize(e));
  const stage = e.phase;
  assert(
    stage === "opening" || stage === "semifinal",
    "Only opening and semifinal stages advance.",
  );
  const gs = normalGroups(e, stage);
  assert(
    gs.length ===
      (stage === "opening" ? plan.opening.length : plan.semifinal.length) &&
      gs.every((g) => g.status === "closed"),
    "Close every group in this stage first.",
  );
  const winners: string[][] = [];
  let pending = false;
  for (const g of gs) {
    const key = `advance:${g.id}`;
    const m = ordered(
      e,
      key,
      g.bottleIds.map((id) => metrics(g, id)),
    );
    const quota = stage === "opening" ? plan.openingQualifiers : 2;
    if (
      compare(m[quota - 1], m[quota]) === 0 &&
      !resolutionCompare(e, key, m[quota - 1].bottleId, m[quota].bottleId)
    ) {
      const tied = m
        .filter((x) => compare(x, m[quota - 1]) === 0)
        .map((x) => x.bottleId);
      ensureRunoff(e, key, tied, stage);
      pending = true;
    } else winners.push(m.slice(0, quota).map((x) => x.bottleId));
  }
  if (pending) return;
  if (stage === "opening" && plan.semifinal.length) {
    // Each semifinal receives one qualifier from each opening group.
    const pairs = winners.map(shuffle);
    e.groups.push(
      group(
        "semifinal",
        0,
        pairs.map((p) => p[0]),
      ),
      group(
        "semifinal",
        1,
        pairs.map((p) => p[1]),
      ),
    );
    e.phase = "semifinal";
  } else {
    e.groups.push(group("final", 0, shuffle(winners.flat())));
    e.phase = "final";
  }
}
export function results(e: Event): Result[] {
  const finals = new Set(normalGroups(e, "final").flatMap((g) => g.bottleIds));
  const semis = new Set(
    normalGroups(e, "semifinal").flatMap((g) => g.bottleIds),
  );
  const tiers: Stage[] = ["final", "semifinal", "opening"];
  let offset = 0;
  const out: Result[] = [];
  for (const tier of tiers) {
    const ids = e.bottles
      .filter((b) =>
        tier === "final"
          ? finals.has(b.id)
          : tier === "semifinal"
            ? semis.has(b.id) && !finals.has(b.id)
            : !semis.has(b.id) && !finals.has(b.id),
      )
      .map((b) => b.id);
    const ms = ids
      .map((id) => {
        const stageMetrics: Partial<Record<Stage, Metric>> = {};
        for (const s of tiers) {
          const g = normalGroups(e, s).find(
            (g) => g.bottleIds.includes(id) && g.status === "closed",
          );
          if (g) stageMetrics[s] = metrics(g, id);
        }
        const rawWeights = { opening: 0.2, semifinal: 0.3, final: 0.5 };
        const denominator = tiers.reduce(
          (sum, t) => sum + (stageMetrics[t] ? rawWeights[t] : 0),
          0,
        );
        const weights = Object.fromEntries(
          tiers.map((t) => [
            t,
            stageMetrics[t] ? rawWeights[t] / denominator : 0,
          ]),
        ) as Record<Stage, number>;
        const sum = (k: "score" | "preference" | "enjoyment") =>
          tiers.reduce(
            (s, t) => s + (stageMetrics[t]?.[k] ?? 0) * weights[t],
            0,
          );
        return {
          bottleId: id,
          score: sum("score"),
          preference: sum("preference"),
          enjoyment: sum("enjoyment"),
          tier,
          stages: Object.fromEntries(
            Object.entries(stageMetrics).map(([s, m]) => [s, m.score]),
          ),
        };
      })
      .sort((a, b) => compare(a, b) || placementTie(e, a.bottleId, b.bottleId));
    let place = offset + 1;
    ms.forEach((m, i) => {
      if (
        i &&
        (compare(m, ms[i - 1]) !== 0 ||
          placementTie(e, m.bottleId, ms[i - 1].bottleId) !== 0)
      )
        place = offset + i + 1;
      out.push({ ...m, place });
    });
    offset += ids.length;
  }
  return out;
}
function finish(e: Event) {
  assert(
    e.phase === "final" &&
      normalGroups(e, "final").every((g) => g.status === "closed"),
    "Close the final first.",
  );
  const r = results(e);
  let pending = false;
  for (const [key, index] of [
    ["award:top", 0],
    ["award:bottom", r.length - 1],
  ] as const) {
    const target = r[index];
    const tied = r.filter(
      (x) => x.tier === target.tier && compare(x, target) === 0,
    );
    if (
      tied.length > 1 &&
      !placementTie(e, tied[0].bottleId, tied[1].bottleId)
    ) {
      const ids = tied.map((x) => x.bottleId);
      // A head-to-head tie needs one runoff to settle both awards.
      if (
        !e.groups.some(
          (g) =>
            g.runoffKey &&
            g.status !== "closed" &&
            g.bottleIds.length === ids.length &&
            ids.every((id) => g.bottleIds.includes(id)),
        )
      )
        ensureRunoff(e, key, ids, target.tier);
      pending = true;
    }
  }
  if (!pending) e.phase = "complete";
}
export type Command = { type: string; [key: string]: unknown };
export function applyCommand(original: Event, actor: Actor, c: Command): Event {
  assert(authorized(original, actor), "You are not invited to this event.");
  const e = structuredClone(original);
  const admin = isEventAdmin(e, actor);
  const count = eventSize(e);
  if(c.type==="bottle-entry") {
    assert(e.workflowVersion===2&&(e.phase==="setup"||(admin&&e.groups.length>0&&e.groups.every(g=>g.status==="waiting"))),"Bottle details lock when tasting begins.");
    const seat=admin?e.participants.find(p=>p.id===c.participantId):member(e,actor);
    assert(seat && (admin||!c.participantId||c.participantId===seat.id),"You can edit only your own bottle.");
    const name=String(c.name??"").trim(),distillery=String(c.distillery??"").trim(),proof=Number(c.proof);
    assert(name.length>0&&name.length<=150&&distillery.length>0&&distillery.length<=150&&Number.isFinite(proof)&&proof>0&&proof<=200,"Enter bottle name, distillery and proof (greater than 0 and no more than 200).");
    const previous=e.bottles.find(b=>b.ownerId===seat.id);
    e.bottles=e.bottles.filter(b=>b.ownerId!==seat.id);
    e.bottles.push({id:previous?.id??randomUUID(),ownerId:seat.id,number:(seat.slot??e.participants.indexOf(seat))+1,name,distillery,proof,abv:proof/2});
    e.revision++;return e;
  }

  e.tasterCount = count;
  if (c.type === "ballot") {
    const p = member(e, actor);
    assert(p, "Only registered tasters can submit a ballot.");
    const g = e.groups.find((g) => g.id === c.groupId);
    assert(g?.status === "open", "This tasting group is not open.");
    if(e.workflowVersion===2&&!admin&&!e.revealed&&Array.isArray(c.entries)) {
      c={...c,entries:(c.entries as Entry[]).map(x=>{
        const real=Object.entries(g.publicIds??{}).find(([,alias])=>alias===x.bottleId)?.[0];
        assert(real,"This cup does not belong to the current flight.");return {...x,bottleId:real};
      })};
    }
    assert(
      Array.isArray(c.entries) && c.entries.length === g.bottleIds.length,
      "Rank and score every bottle.",
    );
    const entries = c.entries as Entry[];
    assert(
      new Set(entries.map((x) => x.bottleId)).size === g.bottleIds.length &&
        entries.every((x) => g.bottleIds.includes(x.bottleId)),
      "Ballot bottles do not match this group.",
    );
    assert(
      new Set(entries.map((x) => x.rank)).size === entries.length,
      "Every preference rank must be unique.",
    );
    for (const x of entries) {
      assert(
        Number.isInteger(x.rank) && x.rank >= 1 && x.rank <= entries.length,
        "Invalid preference rank.",
      );
      for (const k of ["aroma", "flavor", "smoothness", "enjoyment"] as const)
        assert(
          Number.isInteger(x[k]) && x[k] >= 1 && x[k] <= 10,
          "Each attribute must be a whole number from 1 to 10.",
        );
    }
    g.ballots = g.ballots.filter((b) => b.participantId !== p.id);
    g.ballots.push({
      participantId: p.id,
      entries: entries.map((x) => ({
        bottleId: x.bottleId,
        rank: x.rank,
        aroma: x.aroma,
        flavor: x.flavor,
        smoothness: x.smoothness,
        enjoyment: x.enjoyment,
      })),
    });
  } else {
    assert(admin, "Only the event admin can do that.");
    switch (c.type) {
      case "roster-seat": {
        assert(e.workflowVersion===2&&e.phase==="setup","The participant list is locked after event preparation.");
        const slot=Number(c.slot);assert(Number.isInteger(slot)&&slot>=0&&slot<count,"Choose a valid participant slot.");
        const firstName=String(c.firstName??"").trim(),lastName=String(c.lastName??"").trim(),email=String(c.email??"").trim().toLowerCase(),accountId=typeof c.accountId==="string"?c.accountId:undefined;
        assert(firstName&&(accountId||lastName)&&(firstName+" "+lastName).length<=100&&email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),"Enter first name, last name and a valid email address.");
        assert(!accountId||/^[0-9a-f-]{36}$/i.test(accountId),"Choose a valid profile.");
        assert(!e.participants.some(p=>p.slot!==slot&&(p.email===email||(accountId&&p.accountId===accountId))),"This participant already has a seat.");
        const previous=e.participants.find(p=>p.slot===slot),same=previous&&previous.email===email&&previous.accountId===accountId;
        const id=same?previous.id:randomUUID();e.participants=e.participants.filter(p=>p.slot!==slot);
        e.participants.push({id,slot,name:(firstName+" "+lastName).trim(),firstName,lastName,email,...(accountId?{accountId}:{})});e.participants.sort((a,b)=>(a.slot??0)-(b.slot??0));
        if(previous&&!same)e.bottles=e.bottles.filter(b=>b.ownerId!==previous.id);
        break;
      }
      case "invite-roster":
        assert(e.workflowVersion===2&&e.phase==="setup"&&e.participants.length===count,"Save every participant before sending invitations.");e.rosterInvited=true;break;
      case "setup": {
        assert(e.phase === "setup", "Setup is locked after the draw.");
        assert(
          Array.isArray(c.participants) && Array.isArray(c.bottles),
          "Participants and bottles are required.",
        );
        assert(
          c.participants.length === count && c.bottles.length === count,
          `Enter exactly ${count} tasters and ${count} bottles.`,
        );
        const ps = c.participants as { name: string; email: string; accountId?:string }[];
        const accountIds=ps.map(p=>p.accountId).filter(Boolean);
        assert(new Set(accountIds).size===accountIds.length,"Each member can have only one seat per event.");
        assert(ps.every(p=>!p.accountId||/^[0-9a-f-]{36}$/i.test(p.accountId)),"Select a valid member profile.");
        assert(
          ps.every(
            (p) =>
              typeof p.name === "string" &&
              p.name.trim().length > 0 &&
              p.name.length <= 100 &&
              typeof p.email === "string" &&
              (p.email.trim() === "" ||
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email.trim())) &&
              p.email.length <= 254,
          ),
          "Each taster needs a name. Optional emails must be valid.",
        );
        assert(
          new Set(ps.map((p) => p.email.trim().toLowerCase()).filter(Boolean))
            .size === ps.filter((p) => p.email.trim()).length,
          "Taster emails must be unique.",
        );
        e.participants = ps.map((p) => ({
          id: randomUUID(),
          name: p.name.trim(),
          email: p.email.trim().toLowerCase(),
          ...(p.accountId?{accountId:p.accountId}:{}),
        }));
        const bs = c.bottles as { name: string; ownerIndex: number; distillery?: string; proof?: number | string }[];
        assert(
          bs.every(
            (b) =>
              typeof b.name === "string" &&
              b.name.trim().length > 0 &&
              b.name.length <= 150 &&
              Number.isInteger(b.ownerIndex) &&
              b.ownerIndex >= 0 &&
              b.ownerIndex < count,
          ) && new Set(bs.map((b) => b.ownerIndex)).size === count,
          "Each taster must own exactly one named bottle.",
        );
        for (const b of bs) {
          assert(b.distillery === undefined || (typeof b.distillery === "string" && b.distillery.length <= 150), "Keep distillery under 150 characters.");
          assert(b.proof === undefined || b.proof === "" || ((typeof b.proof === "number" || typeof b.proof === "string") && Number.isFinite(Number(b.proof)) && Number(b.proof) > 0 && Number(b.proof) <= 200), "Proof must be greater than 0 and no more than 200.");
        }
        e.bottles = bs.map((b, i) => ({
          id: randomUUID(),
          number: i + 1,
          name: b.name.trim(),
          ...(b.distillery?.trim() ? {distillery:b.distillery.trim()} : {}),
          ...(b.proof !== undefined && b.proof !== "" ? {proof:Number(b.proof), abv:Number(b.proof)/2} : {}),
          ownerId: e.participants[b.ownerIndex].id,
        }));
        break;
      }
      case "delivery-email": {
        const participant = e.participants.find(
          (p) => p.id === c.participantId,
        );
        assert(participant, "Select a registered taster.");
        assert(
          typeof c.email === "string" &&
            c.email.length <= 254 &&
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim()),
          "Enter a valid invitation email address.",
        );
        participant.invitationEmail = c.email.trim().toLowerCase();
        break;
      }
      case "start": {
        assert(
          e.phase === "setup" && e.bottles.length === count,
          `Save all ${count} tasters and bottles first.`,
        );
        if(e.workflowVersion===2)assert(e.rosterInvited&&e.participants.length===count&&e.participants.every(p=>p.accountId)&&e.bottles.every(b=>b.name&&b.distillery&&b.proof),"Every participant must join and complete their bottle before preparation.");
        const plan = tournamentPlan(count),
          ids = shuffle(e.bottles.map((b) => b.id));
        let offset = 0;
        e.groups = plan.opening.length
          ? plan.opening.map((size, i) => {
              const g = group("opening", i, ids.slice(offset, offset + size));
              offset += size;
              return g;
            })
          : [group("final", 0, ids)];
        e.phase = plan.opening.length ? "opening" : "final";
        break;
      }
      case "open": {
        assert(
          e.phase !== "setup" && e.phase !== "complete",
          "There is no active stage.",
        );
        const g = e.groups.find((g) => g.id === c.groupId);
        assert(
          g?.status === "waiting" && (g.stage === e.phase || !!g.runoffKey),
          "This group cannot be opened.",
        );
        assert(
          !e.groups.some((g) => g.status === "open"),
          "Close the current group before opening another.",
        );
        g.status = "open";
        break;
      }
      case "close": {
        const g = e.groups.find((g) => g.id === c.groupId);
        assert(g?.status === "open", "This group is not open.");
        assert(
          g.ballots.length === count &&
            new Set(g.ballots.map((b) => b.participantId)).size === count,
          `All ${count} tasters must submit before closing.`,
        );
        g.status = "closed";
        if (g.runoffKey) {
          const ms = g.bottleIds
            .map((id) => metrics(g, id))
            .sort((a, b) => b.score - a.score);
          if (
            ms.some(
              (m, i) => i > 0 && Math.abs(m.score - ms[i - 1].score) < eps,
            )
          ) {
            ensureRunoff(e, g.runoffKey, g.bottleIds, g.stage);
          } else e.resolutions[g.runoffKey] = ms.map((x) => x.bottleId);
        }
        break;
      }
      case "advance":
        advance(e);
        break;
      case "finish":
        finish(e);
        break;
      case "reveal":
        assert(
          e.phase === "complete",
          "Finish the event and resolve award ties before revealing.",
        );
        e.revealed = true;
        break;
      default:
        throw new Error("Unknown action.");
    }
  }
  e.revision++;
  return e;
}
export function snapshot(e: Event, a: Actor) {
  assert(authorized(e, a), "You are not invited to this event.");
  const admin = isEventAdmin(e, a);
  const p = member(e, a);
  const hiddenCups=e.workflowVersion===2&&!admin&&!e.revealed;
  const ownBottle=e.bottles.find(b=>b.ownerId===p?.id);
  const visibleResults =
    (admin || e.revealed) && e.phase === "complete" ? results(e) : null;
  return {
    id: e.id,
    workflowVersion:e.workflowVersion,
    rosterInvited:!!e.rosterInvited,
    ownBottle:e.workflowVersion===2&&ownBottle?{name:ownBottle.name,distillery:ownBottle.distillery??"",proof:ownBottle.proof??null}:null,
    series: null as {id:string;title:string;year:number;logoUrl?:string|null;winnerAward:string;swillAward:string}|null,
    title: e.title,
    eventType:eventTypeFor(e),
    tasterCount: eventSize(e),
    plan: tournamentPlan(eventSize(e)),
    revision: e.revision,
    phase: e.phase,
    revealed: e.revealed,
    admin,
    blindParticipation:isBlindLocked(e,a.id)?"blind" as const:e.blindUnlockedIds?.includes(a.id)?"unlocked" as const:"standard" as const,
    memberInvitations:[] as {participantId:string;status:string}[],
    participantId: p?.id ?? null,
    participants: admin
      ? e.participants
      : e.participants.map((p) => ({ id: p.id, name: p.name })),
    bottles: (hiddenCups ? e.groups.flatMap(g=>g.bottleIds.map(id=>({id:g.publicIds![id],number:g.cupNumbers![id]}))) : e.bottles.map((b) =>
      admin || e.revealed ? b : { id: b.id, number: b.number },
    )) as (Bottle | Pick<Bottle,"id"|"number">)[],
    groups: e.groups.map((g) => ({
      id: g.id,
      name: g.name,
      stage: g.stage,
      status: g.status,
      bottleIds: hiddenCups?g.bottleIds.map(id=>g.publicIds![id]):g.bottleIds,
      cupNumbers:e.workflowVersion===2?Object.fromEntries(g.bottleIds.map(id=>[hiddenCups?g.publicIds![id]:id,g.cupNumbers![id]])):undefined,
      pourGuide:admin&&e.workflowVersion===2?g.bottleIds.map(id=>{const b=e.bottles.find(b=>b.id===id)!;return {cup:g.cupNumbers![id],bottleNumber:b.number,name:b.name,owner:e.participants.find(p=>p.id===b.ownerId)?.name??""};}).sort((a,b)=>a.cup-b.cup):undefined,
      runoff: !!g.runoffKey,
      submitted: g.ballots.length,
      submittedIds: admin ? g.ballots.map((b) => b.participantId) : undefined,
      myBallot: (()=>{const ballot=g.ballots.find(b=>b.participantId===p?.id);return !ballot?null:hiddenCups?{...ballot,entries:ballot.entries.map(x=>({...x,bottleId:g.publicIds![x.bottleId]}))}:ballot;})(),
      scores:
        admin && g.status === "closed"
          ? g.bottleIds.map((id) => metrics(g, id))
          : undefined,
    })),
    results: visibleResults,
  };
}
export type Snapshot = ReturnType<typeof snapshot>;
