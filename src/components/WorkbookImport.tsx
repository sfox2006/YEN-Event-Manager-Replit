import { useState } from "react";
import { useData } from "../data/context";
import { readWorkbook, type ImportResult } from "../data/workbookImport";
import { Panel, ErrorBox } from "./ui";
export function WorkbookImport() {
  const { service, mutate, toast } = useData(),
    [preview, setPreview] = useState<ImportResult>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [fileName, setFileName] = useState("");
  if (!service.replaceData) return null;
  return (
    <Panel
      title="Import dashboard workbook"
      subtitle="Replace this browser’s records with your complete dashboard workbook."
    >
      <p>
        Imports stay in this browser. Names, contacts, notes and links are not
        uploaded to the server or published for other visitors. Importing
        replaces existing records and local note-file uploads.
      </p>
      <label>
        Select dashboard workbook
        <input
          type="file"
          accept=".xlsx"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            setPreview(undefined);
            setError("");
            if (!file) return;
            setBusy(true);
            try {
              setPreview(await readWorkbook(file));
              setFileName(file.name);
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {preview && (
        <>
          <p>
            <strong>{preview.count} records ready to import</strong> from{" "}
            {fileName}
          </p>
          <ul>
            {Object.entries(preview.tables).map(([key, rows]) => (
              <li key={key}>
                {key.replaceAll("_", " ")}: {rows.length}
              </li>
            ))}
          </ul>
          {preview.warnings.length > 0 && (
            <div className="hint">
              <strong>Import repairs</strong>
              <ul>
                {preview.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={async () => {
              if (
                !confirm(
                  "Replace this browser’s current records and local note uploads with this workbook? A record backup is retained locally.",
                )
              )
                return;
              setBusy(true);
              setError("");
              try {
                await mutate(() => service.replaceData!(preview.tables));
                setPreview(undefined);
                toast("Dashboard workbook imported successfully");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Importing…" : "Replace records with workbook"}
          </button>
        </>
      )}
      {error && <ErrorBox message={error} />}
    </Panel>
  );
}
