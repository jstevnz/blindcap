import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  logoPath,
  seriesLogoAction,
} from "../supabase/functions/bourbon-api/series-logos";
const path = "series/11111111-1111-4111-8111-111111111111.png";
test("logo save validates the series path, PNG signature and size before changing stored branding", async () => {
  assert.doesNotThrow(() => logoPath("series", path));
  for (const p of [
    "other/" + path,
    "series/../logo.png",
    "series/evil.svg",
    "series/" + path,
  ])
    assert.throws(() => logoPath("series", p));
  let blob = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])]),
    saved: any = null;
  const removed: string[] = [];
  const db = {
    storage: {
      from: () => ({
        download: async () => ({ data: blob, error: null }),
        remove: async (p: string[]) => {
          removed.push(...p);
          return { error: null };
        },
        createSignedUrl: async () => ({
          data: { signedUrl: "private-url" },
          error: null,
        }),
      }),
    },
    from: () => ({
      update: (data: any) => {
        saved = data;
        return {
          eq: () => ({
            is: () => ({
              select: () => ({
                maybeSingle: async () => ({
                  data: { id: "series" },
                  error: null,
                }),
              }),
            }),
          }),
        };
      },
    }),
  } as unknown as SupabaseClient;
  const result = await seriesLogoAction(
    { operation: "logo-save", path },
    db,
    { id: "series" },
    "host",
  );
  assert.equal(result.logoUrl, "private-url");
  assert.deepEqual(saved, { logo_path: path });
  saved = null;
  blob = new Blob(["not a PNG"]);
  await assert.rejects(
    seriesLogoAction(
      { operation: "logo-save", path },
      db,
      { id: "series" },
      "host",
    ),
    /valid PNG/,
  );
  assert.equal(saved, null);
  blob = new Blob([new Uint8Array(1048577)]);
  await assert.rejects(
    seriesLogoAction(
      { operation: "logo-save", path },
      db,
      { id: "series" },
      "host",
    ),
    /smaller than 1 MB/,
  );
  assert.equal(saved, null);
  assert.equal(removed.length, 0);
});
