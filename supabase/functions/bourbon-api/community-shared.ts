import type { Event, Actor } from "./engine.ts";
import { snapshot, member } from "./engine.ts";
export type Profile = {
  avatar_path?: string | null;
  mailing_address?: Record<string,string>;
  full_name?: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string;
  location?: string;
  approved_at?: string | null;
  admin_notified_at?: string | null;
  signup_source?: string;
  id: string;
  username: string;
  display_name: string;
  email: string;
  bio: string;
  discoverable: boolean;
  role: "owner" | "member";
  status: "pending" | "active" | "suspended";
};
export function profileFields(input: Record<string, unknown>) {
  const display_name = String(input.displayName ?? "")
      .trim()
      .replace(/\s+/g, " "),
    bio = String(input.bio ?? "").trim();
  if (!display_name || display_name.length > 80)
    throw new Error("Enter a display name of 1–80 characters.");
  if (bio.length > 500)
    throw new Error("Keep your profile description under 500 characters.");
  return {
    display_name,
    bio,
    discoverable: input.discoverable !== false,
  };
}
export function privateProfileFields(
  input: Record<string, unknown>,
  required = false,
) {
  const separated = "firstName" in input || "lastName" in input;
  const normalizeName=(value:unknown)=>{
    if(value!==undefined && typeof value!=="string")throw new Error("Names must be text.");
    return String(value??"").trim().replace(/\s+/g," ");
  };
  const first_name=separated?normalizeName(input.firstName):undefined;
  const last_name=separated?normalizeName(input.lastName):undefined;
  if(separated&&required&&(!first_name||!last_name))throw new Error("Enter your first name and last name.");
  const full_name = String(separated ? [first_name,last_name].filter(Boolean).join(" ") : input.fullName ?? "")
      .trim()
      .replace(/\s+/g, " "),
    phone = String(input.phone ?? "").trim(),
    location = String(input.location ?? "")
      .trim()
      .replace(/\s+/g, " ");
  if ((required && !full_name) || full_name.length > 100)
    throw new Error("Enter your full name, up to 100 characters.");
  if (phone.length > 30 || (phone && !/^[+0-9(). \-]+$/.test(phone)))
    throw new Error("Enter a valid phone number, up to 30 characters.");
  if (location.length > 120)
    throw new Error("Keep city/state under 120 characters.");
  let mailing_address: Record<string,string> | undefined;
  if (Object.prototype.hasOwnProperty.call(input,"mailingAddress")) {
    const address=input.mailingAddress;
    if(!address || typeof address!=="object" || Array.isArray(address)) throw new Error("Enter a valid mailing address.");
    mailing_address={};
    for(const [key,max] of Object.entries({line1:150,line2:150,city:100,region:100,postalCode:30,country:100})) {
      const raw=(address as Record<string,unknown>)[key];
      if(raw!==undefined && typeof raw!=="string") throw new Error("Address fields must be text.");
      const value=String(raw??"").trim().replace(/\s+/g," ");
      if(value.length>max) throw new Error(`Keep ${key} under ${max} characters.`);
      mailing_address[key]=value;
    }
  }
  return { full_name, phone, location, ...(separated?{first_name,last_name}:{}), ...(mailing_address ? {mailing_address} : {}) };
}
export function checkPassword(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.length < 12 || value.length > 128)
    throw new Error("Use a password between 12 and 128 characters.");
}
export function publicProfile(p: Profile) {
  return {
    id: p.id,
    displayName: p.display_name,
    bio: p.bio,
  };
}
export function historyFor(e: Event, a: Actor) {
  if (e.phase !== "complete" || !e.revealed) return null;
  const s = snapshot(e, a);
  const ownBottle = e.bottles.find((b) => b.ownerId === s.participantId);
  return {
    id: e.id,
    title: e.title,
    host: e.ownerId === a.id,
    participating: Boolean(s.participantId),
    participants: e.participants.map(p=>({id:p.id,name:p.name})),
    results: (s.results ?? []).map(r=>{
      const bottle=e.bottles.find(b=>b.id===r.bottleId);
      return {...r,bottleName:bottle?.name ?? "Unknown bottle",distillery:bottle?.distillery,proof:bottle?.proof,ownerName:e.participants.find(p=>p.id===bottle?.ownerId)?.name ?? "Participant"};
    }),
    bottle: ownBottle
      ? {
          name: ownBottle.name,
          number: ownBottle.number,
          result: s.results?.find((r) => r.bottleId === ownBottle.id) ?? null,
        }
      : null,
    ballots: s.groups
      .filter((g) => g.myBallot)
      .map((g) => ({
        name: g.name,
        runoff: g.runoff,
        entries: [...g.myBallot!.entries]
          .sort((a, b) => a.rank - b.rank)
          .map((x) => ({
            ...x,
            bottleName:
              e.bottles.find((b) => b.id === x.bottleId)?.name ??
              "Unknown bottle",
          })),
      })),
  };
}

export function currentParticipation(e:Event,a:Actor){
  const seat=member(e,a);
  if(!seat || (e.phase==="complete"&&e.revealed))return null;
  const bottle=e.bottles.find(b=>b.ownerId===seat.id);
  return {id:e.id,title:e.title,phase:e.phase,ownBottle:bottle?{name:bottle.name,distillery:bottle.distillery,proof:bottle.proof}:null};
}
