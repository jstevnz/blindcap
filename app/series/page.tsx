import { redirect } from "next/navigation";
export default async function SeriesRedirect({searchParams}:{searchParams:Promise<{id?:string}>}) {const {id}=await searchParams;redirect(id?`/events?series=${encodeURIComponent(id)}`:"/events");}
