import { Link } from "react-router-dom";
import { Badge, Progress, Table } from "./ui";
import { useData } from "../data/context";
import { formatDate, safeUrl } from "../domain/rules";
import type { EventSummary, Meeting } from "../domain/types";
export function EventTable({ events }: { events: EventSummary[] }) {
  return (
    <Table
      headers={[
        "Event",
        "Date & time",
        "Progress",
        "Funding",
        "Speakers",
        "Room",
        "Committee",
        "Lead",
      ]}
      rowLinks={events.map((e) => "/event/" + e.event_id)}
      empty="No matching events"
      rows={events.map((e) => [
        <>
          <Link className="record-link" to={"/event/" + e.event_id}>
            {e.event_name}
          </Link>
          <div>
            <Badge value={e.status} />
          </div>
        </>,
        <>
          {formatDate(e.date)}
          <small>{e.start_time || "Time TBC"}</small>
        </>,
        <Progress n={e.progress} />,
        <Badge value={e.funding_status} />,
        <Badge value={e.speaker_summary} />,
        <Badge value={e.room_status} />,
        `${e.committee_confirmed} confirmed`,
        e.lead_organiser_name,
      ])}
    />
  );
}
export function SafeLink({
  url,
  children,
}: {
  url: string;
  children: React.ReactNode;
}) {
  return url && safeUrl(url) ? (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ) : null;
}
export function MeetingTable({
  meetings,
  onEdit,
  onDelete,
  onStatus,
}: {
  meetings: Meeting[];
  onEdit?: (m: Meeting) => void;
  onDelete?: (m: Meeting) => void;
  onStatus?: (m: Meeting, s: string) => void;
}) {
  const { data, service, busy, toast } = useData();
  return (
    <Table
      headers={[
        "Meeting",
        "Date & time",
        "Organisation",
        "Location / links",
        "Organiser",
        "Status",
        ...(onEdit ? ["Actions"] : []),
      ]}
      empty="No matching meetings"
      rows={meetings.map((m) => [
        <>
          <strong>{m.meeting_name}</strong>
          <small>{m.meeting_type}</small>
        </>,
        <>
          {formatDate(m.date)}
          <small>
            {m.start_time || "Time TBC"}
            {m.end_time ? "–" + m.end_time : ""}
          </small>
        </>,
        data.organisations.find((o) => o.organisation_id === m.organisation_id)
          ?.organisation_name ||
          m.external_organisation ||
          (m.meeting_type === "Executive meeting"
            ? "YEN Executive"
            : "Not set"),
        <>
          {m.location || "Not set"}
          <small>
            <SafeLink url={m.meeting_link}>Join meeting</SafeLink>{" "}
            <SafeLink url={m.meeting_notes_link}>Meeting notes</SafeLink>
          </small>
          {m.meeting_notes_file_id &&
            (service.mode === "demo" ? (
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  service
                    .openNotes?.(m.meeting_notes_file_id)
                    .catch((e) => toast(e.message))
                }
              >
                {m.meeting_notes_file_name} (local demo upload)
              </button>
            ) : (
              <SafeLink url={m.meeting_notes_file_url}>
                {m.meeting_notes_file_name}
              </SafeLink>
            ))}
        </>,
        data.committee.find((x) => x.member_id === m.organiser_member_id)
          ?.name || "Unassigned",
        onStatus ? (
          <select
            aria-label={"Status for " + m.meeting_name}
            disabled={busy}
            value={m.status}
            onChange={(e) => onStatus(m, e.target.value)}
          >
            {["Planned", "Confirmed", "Completed", "Cancelled"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        ) : (
          <Badge value={m.status} />
        ),
        ...(onEdit
          ? [
              <div className="row-actions">
                <button type="button" onClick={() => onEdit(m)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => onDelete?.(m)}
                >
                  Delete
                </button>
              </div>,
            ]
          : []),
      ])}
    />
  );
}
