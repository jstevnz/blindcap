"use client";
import { useState } from "react";
import { request } from "@/lib/browser";
import { tournamentPlan } from "@/lib/tournament";
import EventTypePicker from "./EventTypePicker";
import { prepareSeriesLogo, uploadSeriesLogo } from "./SeriesLogo";
export type EventSeries = { id:string; title:string; logoUrl?:string|null; canManage:boolean };
export default function CreateEvent({series}:{series:EventSeries[]}) {
  const [kind,setKind]=useState("once"),[title,setTitle]=useState(""),[seriesId,setSeriesId]=useState(""),[year,setYear]=useState(new Date().getFullYear()),[count,setCount]=useState(12),[winner,setWinner]=useState("Yorktown Tumbler"),[swill,setSwill]=useState("Swill Award"),[logo,setLogo]=useState<File|null>(null),[created,setCreated]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const plan=tournamentPlan(count);
  return <section className="panel"><a href="/events">← Events</a><h1>Create an Event.</h1><p>Name your event and choose whether it stands alone or belongs to a recurring series. You’ll select participants next.</p>
    <form onSubmit={async e=>{e.preventDefault();const eventType=new FormData(e.currentTarget).get("eventType");setBusy(true);setError("");try{
      let id=seriesId;
      if(kind==="new") {
        const prepared=logo?await prepareSeriesLogo(logo):null;
        id=created ?? (await request("/api/series",{operation:"create",title,eventType,winnerAward:winner,swillAward:swill})).id;
        setCreated(id);if(prepared)await uploadSeriesLogo(id,prepared);
      }
      const result=kind==="once"?await request("/api/events",{title,eventType,tasterCount:count}):await request("/api/series",{operation:"create-edition",seriesId:id,year,eventType,tasterCount:count});
      location.href=`/event/${result.eventId ?? result.id}`;
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>
      <label>Event format<select value={kind} disabled={busy||!!created} onChange={e=>setKind(e.target.value)}><option value="once">One-time event</option><option value="new">Start a new event series</option>{series.some(s=>s.canManage)&&<option value="existing">Add a year to an existing series</option>}</select></label>
      {kind!=="existing"?<label>{kind==="new"?"Series name":"Event name"}<input required disabled={!!created} value={title} maxLength={100} placeholder="Enter a name" onChange={e=>setTitle(e.target.value)}/></label>:<label>Event series<select required value={seriesId} onChange={e=>setSeriesId(e.target.value)}><option value="">Choose a series</option>{series.filter(s=>s.canManage).map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label>}
      <EventTypePicker />
      {kind!=="once"&&<label>Year<input type="number" required min={1900} max={2200} value={year} onChange={e=>setYear(Number(e.target.value))}/></label>}
      <label>Number of tasters / bottles<select value={count} onChange={e=>setCount(Number(e.target.value))}>{Array.from({length:15},(_,i)=><option value={i+2} key={i}>{i+2} tasters · {i+2} bottles</option>)}</select></label>
      <p className="fine">{count<=4?`One final of ${count}${count===2?" · Head-to-head":""}`:`Opening: ${plan.opening.join(" + ")}${plan.semifinal.length?` → Semifinals: ${plan.semifinal.join(" + ")}`:""} → Final four`}</p>
      {kind==="new"&&<><label>Winner’s award<input required maxLength={80} value={winner} onChange={e=>setWinner(e.target.value)}/></label><label>Last place award<input required maxLength={80} value={swill} onChange={e=>setSwill(e.target.value)}/></label><label>Series logo (optional)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setLogo(e.target.files?.[0]??null)}/></label><p className="fine">All years, results and leaderboards stay together in this series. You can change its logo later.</p></>}
      {created&&<p className="notice">Your series is saved. Retry to finish this year’s event, or <a href={`/events?series=${created}`}>open the series</a>.</p>}
      {error&&<p role="alert" className="error">{error}</p>}<button disabled={busy}>{busy?"Creating…":"Create event & select participants"}</button>
    </form></section>;
}
