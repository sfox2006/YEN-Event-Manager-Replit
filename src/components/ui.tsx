import { useEffect, useRef, type ReactNode } from "react";
export function Badge({ value }: { value: string }) {
  const tone =
    /^(Confirmed|Complete|Registrations Open|Approved|Published|Active)/.test(
      value,
    )
      ? "green"
      : /^(Declined|Cancelled|Not started|Follow-up|Blocked|Overdue|No$|Not attending)/.test(
            value,
          )
        ? "red"
        : /Pending|Planning|requested|Likely|Awaiting|Invited|progress|Idea|Tentative/i.test(
              value,
            )
          ? "amber"
          : "neutral";
  return (
    <span className={"badge " + tone}>
      <span aria-hidden="true">●</span> {value}
    </span>
  );
}
export function Panel({
  title,
  subtitle,
  action,
  children,
  id,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section className="panel" id={id}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="panel-body">{children}</div>
    </section>
  );
}
export function Header({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
export function Metrics({ items }: { items: [string, number][] }) {
  return (
    <div className="metrics">
      {items.map(([label, n]) => (
        <div className="metric" key={label}>
          <div>{label}</div>
          <strong>{n}</strong>
        </div>
      ))}
    </div>
  );
}
export function Table({
  headers,
  rows,
  empty = "No matching records",
  rowLinks,
}: {
  headers: string[];
  rows: ReactNode[][];
  empty?: string;
  rowLinks?: string[];
}) {
  return rows.length ? (
    <table>
      <thead>
        <tr>
          {headers.map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr
            key={i}
            tabIndex={rowLinks ? 0 : undefined}
            aria-label={rowLinks ? "Open event" : undefined}
            className={rowLinks ? "clickable-row" : undefined}
            onClick={(e) => {
              if (
                rowLinks &&
                !(e.target as HTMLElement).closest("a,button,input,select")
              )
                window.location.hash = rowLinks[i];
            }}
            onKeyDown={(e) => {
              if (
                rowLinks &&
                e.target === e.currentTarget &&
                ["Enter", " "].includes(e.key)
              ) {
                e.preventDefault();
                window.location.hash = rowLinks[i];
              }
            }}
          >
            {r.map((v, j) => (
              <td key={j} data-label={headers[j]}>
                {v}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ) : (
    <div className="empty">
      <strong>{empty}</strong>
      <p>Add a record or adjust the filters.</p>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.showModal();
    const d = ref.current;
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Tab" && d) {
        const a = Array.from(
          d.querySelectorAll<HTMLElement>(
            "button,input,select,textarea,a[href]",
          ),
        ).filter((x) => !x.matches(":disabled"));
        const first = a[0],
          last = a[a.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    d?.addEventListener("keydown", handle);
    return () => {
      d?.removeEventListener("keydown", handle);
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      aria-label={title}
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button type="button" aria-label="Close dialog" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
export function Progress({ n }: { n: number }) {
  return (
    <span className="progress">
      <span>
        <i style={{ width: n + "%" }} />
      </span>
      {n}%
    </span>
  );
}
export const ErrorBox = ({ message }: { message: string }) => (
  <div className="error" role="alert">
    {message}
  </div>
);
