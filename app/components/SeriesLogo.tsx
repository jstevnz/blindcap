"use client";
import { useState } from "react";
import { browser, request } from "@/lib/browser";
export async function prepareSeriesLogo(file: File): Promise<Blob> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  )
    throw new Error("Choose a PNG, JPEG or WebP logo smaller than 10 MB.");
  const bitmap = await createImageBitmap(file),
    scale = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob || blob.size > 1048576)
    throw new Error(
      "This logo is too large after resizing. Try a simpler or smaller image.",
    );
  return blob;
}
export async function uploadSeriesLogo(seriesId: string, blob: Blob) {
  const upload = await request("/api/series", {
    operation: "logo-upload",
    seriesId,
  });
  const { error } = await browser()
    .storage.from("blindcap-series-logos")
    .uploadToSignedUrl(upload.path, upload.token, blob, {
      contentType: "image/png",
    });
  if (error) throw error;
  return request("/api/series", {
    operation: "logo-save",
    seriesId,
    path: upload.path,
  });
}
export default function SeriesLogoEditor({
  seriesId,
  hasLogo,
  onSaved,
}: {
  seriesId: string;
  hasLogo: boolean;
  onSaved: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function run(f: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await f();
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>
        Series logo <small>(optional)</small>
      </h2>
      <p>
        This logo appears throughout the series and its annual editions. You can
        change it at any time.
      </p>
      <label>
        {hasLogo ? "Replace logo" : "Upload logo"}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file)
              run(async () => {
                await uploadSeriesLogo(seriesId, await prepareSeriesLogo(file));
                setNotice("Series logo saved.");
              });
          }}
        />
      </label>
      {hasLogo && (
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await request("/api/series", {
                operation: "logo-remove",
                seriesId,
              });
              setNotice("Logo removed.");
            })
          }
        >
          Remove logo
        </button>
      )}
      {busy && <p role="status">Saving logo…</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
