"use client";
import { useState } from "react";
import { browser, request } from "@/lib/browser";
import Avatar from "./Avatar";
async function photo(file: File): Promise<Blob> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  )
    throw new Error("Choose a JPEG, PNG or WebP photo smaller than 10 MB.");
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 384;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#f6f1e7";
  ctx.fillRect(0, 0, 384, 384);
  const scale = (canvas.width / Math.min(bitmap.width, bitmap.height)) * 0.85;
  const width = bitmap.width * scale;
  const height = bitmap.height * scale;
  ctx.drawImage(
    bitmap,
    (canvas.width - width) / 2,
    (canvas.height - height) / 2,
    width,
    height,
  );
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85),
  );
  if (!blob || blob.size > 524288)
    throw new Error("This photo could not be resized. Choose another image.");
  return blob;
}
export default function ProfilePhoto({
  name,
  initialUrl,
}: {
  name: string;
  initialUrl?: string | null;
}) {
  const [url, setUrl] = useState(initialUrl),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function run(f: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await f();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>
        Profile photo <small>(optional)</small>
      </h2>
      <Avatar name={name} url={url} />
      <p>
        Your initials appear when you don’t add a photo. Photos are visible
        inside the private community.
      </p>
      <label>
        Choose a photo
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file)
              run(async () => {
                const blob = await photo(file);
                const upload = await request("/api/community", {
                  operation: "photo-upload",
                });
                const { error } = await browser()
                  .storage.from("blindcap-avatars")
                  .uploadToSignedUrl(upload.path, upload.token, blob, {
                    contentType: "image/jpeg",
                  });
                if (error) throw error;
                const saved = await request("/api/community", {
                  operation: "photo-save",
                });
                setUrl(saved.avatarUrl);
                setNotice("Profile photo saved.");
              });
          }}
        />
      </label>
      {url && (
        <button
          className="text-button"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await request("/api/community", { operation: "photo-remove" });
              setUrl(null);
              setNotice("Photo removed. Your initials will appear instead.");
            })
          }
        >
          Remove photo
        </button>
      )}
      {busy && <p role="status">Saving photo…</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
