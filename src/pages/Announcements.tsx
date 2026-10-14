import { useEffect, useState } from "react";
import { useData } from "../data/context";
import { Header, Panel, Badge, ErrorBox } from "../components/ui";
import type { Announcement } from "../domain/types";
export function Announcements() {
  const { service, data } = useData(),
    [rows, setRows] = useState<Announcement[]>([]),
    [member, setMember] = useState(
      () => sessionStorage.getItem("announcementMember") || "",
    ),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [pending, setPending] = useState("");
  async function load() {
    setLoading(true);
    setError("");
    try {
      setRows(await service.getAnnouncements());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let alive = true;
    service
      .getAnnouncements()
      .then((r) => {
        if (alive) setRows(r);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [service]);
  const shown = rows
    .filter((a) => !member || a.member_id === member)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (
    <>
      <Header
        title="Announcements"
        subtitle="Task reminders for committee members."
      />
      <p className="hint">
        {service.mode === "demo"
          ? "Reminders stay in this browser. They are not delivered to another person’s browser or account."
          : "Reminders are stored in the shared Google backend. Members can view them here; there are no signed-in inboxes or push notifications."}
      </p>
      <label>
        View announcements for
        <select
          aria-label="View announcements for"
          value={member}
          onChange={(e) => {
            setMember(e.target.value);
            sessionStorage.setItem("announcementMember", e.target.value);
          }}
        >
          <option value="">All members</option>
          {data.committee.map((m) => (
            <option key={m.member_id} value={m.member_id}>
              {m.name}
              {m.active ? "" : " (inactive)"}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <>
          <ErrorBox message={error} />
          <button onClick={load}>Retry</button>
        </>
      )}
      {loading ? (
        <p>Loading announcements…</p>
      ) : error ? null : !shown.length ? (
        <Panel title="No announcements">
          <p>No task reminders for this selection yet.</p>
        </Panel>
      ) : (
        shown.map((a) => (
          <Panel
            key={a.announcement_id}
            title={a.task_name}
            subtitle={`For ${data.committee.find((m) => m.member_id === a.member_id)?.name || "Former member"} · ${new Date(a.created_at).toLocaleString("en-AU")}`}
            action={<Badge value={a.read_at ? "Read" : "Unread"} />}
          >
            <p className="reminder-message">{a.message}</p>
            <button
              type="button"
              disabled={pending === a.announcement_id}
              onClick={async () => {
                setPending(a.announcement_id);
                setError("");
                try {
                  const saved = await service.markAnnouncementRead(
                    a.announcement_id,
                    !a.read_at,
                  );
                  setRows((r) =>
                    r.map((x) =>
                      x.announcement_id === saved.announcement_id ? saved : x,
                    ),
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setPending("");
                }
              }}
            >
              Mark as {a.read_at ? "unread" : "read"}
            </button>
          </Panel>
        ))
      )}
    </>
  );
}
