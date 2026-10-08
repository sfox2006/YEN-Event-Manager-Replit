export type Option = string | [string, string];
export interface FieldSpec {
  key: string;
  label: string;
  type?: string;
  options?: Option[];
  required?: boolean;
  wide?: boolean;
  min?: number;
  max?: number;
  step?: string;
}
export function Fields({
  spec,
  value,
  onChange,
  disabled = false,
}: {
  spec: FieldSpec[];
  value: object;
  onChange: (key: string, value: unknown) => void;
  disabled?: boolean;
}) {
  const data = value as Record<string, unknown>;
  return (
    <div className="form-grid">
      {spec.map((f) => (
        <label key={f.key} className={f.wide ? "wide" : ""}>
          <span>
            {f.label}
            {f.required ? " *" : ""}
          </span>
          {f.options ? (
            <select
              aria-label={f.label}
              disabled={disabled}
              value={String(data[f.key] ?? "")}
              onChange={(e) =>
                onChange(
                  f.key,
                  f.key === "active"
                    ? e.target.value === "true"
                    : e.target.value,
                )
              }
            >
              {f.options.map((o) => {
                const [v, l] = typeof o === "string" ? [o, o] : o;
                return (
                  <option key={v} value={v}>
                    {l}
                  </option>
                );
              })}
            </select>
          ) : f.type === "textarea" ? (
            <textarea
              aria-label={f.label}
              disabled={disabled}
              value={String(data[f.key] ?? "")}
              onChange={(e) => onChange(f.key, e.target.value)}
            />
          ) : (
            <input
              aria-label={f.label}
              disabled={disabled}
              type={f.type || "text"}
              required={f.required}
              min={f.min}
              max={f.max}
              step={f.step}
              value={String(data[f.key] ?? "")}
              onChange={(e) =>
                onChange(
                  f.key,
                  f.type === "number"
                    ? e.target.value === ""
                      ? undefined
                      : Number(e.target.value)
                    : e.target.value,
                )
              }
            />
          )}
        </label>
      ))}
    </div>
  );
}
