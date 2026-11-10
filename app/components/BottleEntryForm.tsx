"use client";
import { useState } from "react";
export type BottleInput = {
  name: string;
  distillery: string;
  proof: string | number | null;
};
export default function BottleEntryForm({
  initial,
  onSave,
  busy,
  label = "Save my bottle",
}: {
  initial?: BottleInput | null;
  onSave: (b: BottleInput) => Promise<void>;
  busy: boolean;
  label?: string;
}) {
  const [b, setBottle] = useState<BottleInput>(
    initial ?? { name: "", distillery: "", proof: "" },
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(b);
      }}
    >
      <label>
        Bottle name
        <input
          required
          maxLength={150}
          value={b.name}
          onChange={(e) => setBottle({ ...b, name: e.target.value })}
        />
      </label>
      <label>
        Distillery
        <input
          required
          maxLength={150}
          value={b.distillery}
          onChange={(e) => setBottle({ ...b, distillery: e.target.value })}
        />
      </label>
      <label>
        Proof
        <input
          required
          type="number"
          min="0.1"
          max="200"
          step="any"
          value={b.proof ?? ""}
          onChange={(e) => setBottle({ ...b, proof: e.target.value })}
        />
      </label>
      {b.proof && <p className="fine">ABV: {Number(b.proof) / 2}%</p>}
      <button disabled={busy}>{label}</button>
    </form>
  );
}
