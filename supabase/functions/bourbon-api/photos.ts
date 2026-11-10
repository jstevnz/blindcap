import type { SupabaseClient } from "@supabase/supabase-js";
import { getProfile, rate } from "./community.ts";
import type { Actor } from "./engine.ts";
const bucket = "blindcap-avatars";
export async function avatarUrl(db: SupabaseClient, path?: string | null) {
  if (!path) return null;
  const { data, error } = await db.storage
    .from(bucket)
    .createSignedUrl(path, 3600);
  return error ? null : data.signedUrl;
}
export async function photoAction(
  input: Record<string, unknown>,
  db: SupabaseClient,
  a: Actor,
) {
  const p = await getProfile(db, a.id);
  if (!p || !["pending", "active"].includes(p.status))
    throw new Error("An eligible member profile is required.");
  const path = `${a.id}/avatar.jpg`;
  if (input.operation === "photo-upload") {
    await rate(db, "photo:" + a.id, 10, 3600);
    const { data, error } = await db.storage
      .from(bucket)
      .createSignedUploadUrl(path, { upsert: true });
    if (error) throw new Error("Unable to prepare your photo upload.");
    return { path, token: data.token };
  }
  if (input.operation === "photo-save") {
    const { data, error } = await db.storage.from(bucket).download(path);
    if (error || !data || data.size > 524288)
      throw new Error("Upload a photo smaller than 512 KB.");
    const bytes = new Uint8Array(await data.arrayBuffer());
    if (bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) {
      await db.storage.from(bucket).remove([path]);
      throw new Error("Please upload a JPEG photo.");
    }
    const { error: save } = await db
      .from("bourbon_profiles")
      .update({ avatar_path: path })
      .eq("id", a.id);
    if (save) throw new Error("Unable to save your photo.");
    return { avatarUrl: await avatarUrl(db, path) };
  }
  if (input.operation === "photo-remove") {
    const { error } = await db.storage.from(bucket).remove([path]);
    if (error) throw new Error("Unable to remove your photo.");
    const { error: save } = await db
      .from("bourbon_profiles")
      .update({ avatar_path: null })
      .eq("id", a.id);
    if (save) throw new Error("Unable to remove your photo.");
    return { removed: true };
  }
  throw new Error("Unknown photo action.");
}
