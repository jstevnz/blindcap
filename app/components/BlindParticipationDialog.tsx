"use client";
import { useEffect, useRef, useState } from "react";
import type { EventSummary } from "@/lib/event-management";
import MemberPicker from "./MemberPicker";
export default function BlindParticipationDialog({
  event,
  mode,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  event: EventSummary;
  mode: "lock" | "unlock";
  busy: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: (coordinatorId?: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    [ack, setAck] = useState(false),
    [coordinator, setCoordinator] = useState<
      { id: string; name: string } | undefined
    >(
      event.hostedByMe
        ? undefined
        : { id: event.coordinatorId, name: event.hostName },
    );
  useEffect(() => {
    const node = dialog.current;
    if (node && !node.open) node.showModal();
    return () => node?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="panel delete-dialog"
      aria-labelledby="blind-participation-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <p className="eyebrow">EVENT MANAGEMENT</p>
      <h2 id="blind-participation-title">
        {mode === "lock" ? "Participate blind?" : "End blind participation?"}
      </h2>
      <p>
        <strong>{event.title}</strong>
      </p>
      {mode === "lock" ? (
        <>
          <p>
            You will have the same event access as a taster. Host controls,
            bottle identities, owners and unpublished results will stay hidden.
            Your coordinator must add your existing profile as a participant.
          </p>
          <p>
            Select the approved member who will run this event. They will have
            host controls and confirmed participants’ mailing addresses.
          </p>
          <MemberPicker
            selected={coordinator}
            onSelect={(p) => setCoordinator({ id: p.id, name: p.displayName })}
            onClear={() => setCoordinator(undefined)}
            clearLabel="Choose a different coordinator"
            hint="Select another approved member to coordinate this event."
          />
        </>
      ) : (
        <>
          <p>
            This emergency action restores host access so you can appoint a
            replacement admin or finish the event. You may then see bottle
            identities and unpublished results.
          </p>
          <p>
            <strong>
              You will no longer be marked blind for this event and cannot turn
              blind status back on.
            </strong>{" "}
            The unlock is recorded with your account and time. Your existing
            ballots are preserved.
          </p>
        </>
      )}
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={ack}
          onChange={(e) => setAck(e.target.checked)}
          disabled={busy}
        />
        {mode === "lock"
          ? "I want to participate blind and delegate the host controls."
          : "I understand that emergency host access ends my blind status for this event."}
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button
          type="button"
          className="secondary"
          autoFocus
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy || !ack || (mode === "lock" && !coordinator)}
          onClick={() => onConfirm(coordinator?.id)}
        >
          {busy
            ? "Saving…"
            : mode === "lock"
              ? "Enable blind participation"
              : "End blind participation & unlock"}
        </button>
      </div>
    </dialog>
  );
}
