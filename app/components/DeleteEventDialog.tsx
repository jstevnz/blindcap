"use client";
import { useEffect, useRef } from "react";
import type { EventSummary } from "@/lib/event-management";
export default function DeleteEventDialog({
  event,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  event: EventSummary;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    if (node && !node.open) node.showModal();
    return () => node?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="panel delete-dialog"
      aria-labelledby="delete-event-title"
      aria-describedby="delete-event-description"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <p className="eyebrow">CONFIRM DELETION</p>
      <h2 id="delete-event-title">Delete this event?</h2>
      <p className="delete-event-name">{event.title}</p>
      <p className="muted">
        Created {new Date(event.createdAt).toLocaleString()} · Hosted by{" "}
        {event.hostName}
      </p>
      <p id="delete-event-description">
        This permanently deletes this event, its scores, invitations and tasting
        history for everyone who participated. This cannot be undone.
      </p>
      {event.phase !== "complete" && <p>This event is still in progress.</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="actions">
        <button
          autoFocus
          type="button"
          className="secondary"
          disabled={busy}
          onClick={onCancel}
        >
          Keep event
        </button>
        <button
          type="button"
          className="danger"
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? "Deleting…" : "Delete permanently"}
        </button>
      </div>
    </dialog>
  );
}
