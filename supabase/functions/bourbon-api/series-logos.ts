import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { rate } from "./community.ts";
export const logoBucket = "blindcap-series-logos";
export async function seriesLogoUrl(db: SupabaseClient, path?: string | null) {
  if (!path) return null;
  const { data, error } = await db.storage
    .from(logoBucket)
    .createSignedUrl(path, 3600);
  return error ? null : data.signedUrl;
}
export function logoPath(
  seriesId: string,
  path: unknown,
): asserts path is string {
  if (
    typeof path !== "string" ||
    !path.startsWith(seriesId + "/") ||
    !/^[0-9a-f-]{36}\.png$/.test(path.slice(seriesId.length + 1))
  )
    throw new Error("This logo upload does not belong to this series.");
}
export async function seriesLogoAction(
  input: Record<string, unknown>,
  db: SupabaseClient,
  series: { id: string; logo_path?: string | null },
  actorId: string,
) {
  if (input.operation === "logo-upload") {
    await rate(db, "series-logo:" + actorId, 15, 3600);
    const path = `${series.id}/${randomUUID()}.png`;
    const { data, error } = await db.storage
      .from(logoBucket)
      .createSignedUploadUrl(path);
    if (error) throw new Error("Unable to prepare the logo upload.");
    return { path, token: data.token };
  }
  if (input.operation === "logo-save") {
    logoPath(series.id, input.path);
    const path = input.path;
    const { data, error } = await db.storage.from(logoBucket).download(path);
    if (error || !data || data.size > 1048576)
      throw new Error("Upload a logo smaller than 1 MB.");
    const bytes = new Uint8Array(await data.arrayBuffer());
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (!signature.every((v, i) => bytes[i] === v))
      throw new Error("Choose a valid PNG logo.");
    let query = db
      .from("bourbon_series")
      .update({ logo_path: path })
      .eq("id", series.id);
    query = series.logo_path
      ? query.eq("logo_path", series.logo_path)
      : query.is("logo_path", null);
    const { data: saved, error: save } = await query.select("id").maybeSingle();
    if (save) throw new Error("Unable to save the series logo.");
    if (!saved)
      throw new Error("The series logo changed. Reload and try again.");
    if (series.logo_path && series.logo_path !== path)
      await db.storage.from(logoBucket).remove([series.logo_path]);
    return { logoUrl: await seriesLogoUrl(db, path) };
  }
  if (input.operation === "logo-remove") {
    let query = db
      .from("bourbon_series")
      .update({ logo_path: null })
      .eq("id", series.id);
    query = series.logo_path
      ? query.eq("logo_path", series.logo_path)
      : query.is("logo_path", null);
    const { data, error } = await query.select("id").maybeSingle();
    if (error || !data)
      throw new Error("The series logo changed. Reload and try again.");
    if (series.logo_path)
      await db.storage.from(logoBucket).remove([series.logo_path]);
    return { removed: true };
  }
  throw new Error("Unknown logo action.");
}
