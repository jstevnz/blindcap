"use client";
import { useEffect, useState } from "react";
import { request } from "@/lib/browser";
import MemberPicker from "./MemberPicker";
type Team = {
  revision: number;
  canManage: boolean;
  primaryHostId: string;
  admins: {
    id: string;
    name: string;
    status: string;
    primary: boolean;
    blind?: boolean;
    emergency?: boolean;
  }[];
};
export {mailingCsv} from "./PhysicalMailingList";
export default function EventTeam({
  id,
  onChanged,
}: {
  id: string;
  onChanged: () => Promise<void>;
}) {
  const [team, setTeam] = useState<Team | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function load() {
    setTeam(await request(`/api/events/${id}/team`));
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [id]);
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
  async function update(ids: string[]) {
    await request(`/api/events/${id}/team`, {
      revision: team!.revision,
      adminIds: ids,
    });
    await load();
    await onChanged();
    setNotice("Event admins updated.");
  }
  return (
    <>
      <section className="panel">
        <h2>Event admins</h2>
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={() => run(load)}
        >
          Refresh admin team
        </button>
        <p>
          Co-admins can manage setup, invitations, scoring and reveal, and
          request confirmed participants’ mailing addresses. Only the primary
          host or site owner can change this team. Event deletion remains with
          the primary host or site owner.
        </p>
        {team?.admins.map((p) => (
          <div className="row-between" key={p.id}>
            <p>
              <strong>{p.name}</strong> ·{" "}
              {p.blind
                ? "Event creator · participating blind"
                : p.emergency
                  ? "Emergency admin"
                  : p.primary
                    ? "Primary host"
                    : "Co-admin"}
              {p.status !== "active" ? " · Inactive" : ""}
            </p>
            {team.canManage && !p.primary && !p.emergency && (
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`Remove ${p.name} as an event admin?`))
                    run(() =>
                      update(
                        team.admins
                          .filter((x) => !x.primary && x.id !== p.id)
                          .map((x) => x.id),
                      ),
                    );
                }}
              >
                Remove co-admin
              </button>
            )}
          </div>
        ))}
        {team?.canManage && team.admins.length < 9 && (
          <MemberPicker
            onClear={() => {}}
            onSelect={(p) => {
              if (team.admins.some((x) => x.id === p.id)) {
                setError("This member is already an event admin.");
                return;
              }
              if (
                window.confirm(
                  `Give ${p.displayName} full admin controls for this event, including access to confirmed participants’ mailing addresses?`,
                )
              )
                run(() =>
                  update([
                    ...team.admins.filter((x) => !x.primary).map((x) => x.id),
                    p.id,
                  ]),
                );
            }}
          />
        )}
      </section>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
    </>
  );
}
