export function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (
    a === null ||
    b === null ||
    typeof a !== "object" ||
    typeof b !== "object"
  )
    return false;
  if (Array.isArray(a) || Array.isArray(b))
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((v, i) => same(v, b[i]))
    );
  const x = a as Record<string, unknown>,
    y = b as Record<string, unknown>;
  return [...new Set([...Object.keys(x), ...Object.keys(y)])].every((k) =>
    same(x[k], y[k]),
  );
}
const conflict = () => {
  throw new Error(
    "Save conflict: another edit changed the same field or removed an edited record. Your changes are retained. Reload before resolving it.",
  );
};
export function mergeRow<T extends object>(base: T, user: T, latest: T): T {
  const result = { ...latest } as Record<string, unknown>;
  for (const key of new Set([...Object.keys(base), ...Object.keys(user)])) {
    if (["created_at", "updated_at"].includes(key)) continue;
    const b = (base as Record<string, unknown>)[key],
      u = (user as Record<string, unknown>)[key],
      l = (latest as Record<string, unknown>)[key];
    if (!same(b, u)) {
      if (!same(b, l) && !same(u, l)) conflict();
      result[key] = u;
    }
  }
  return result as T;
}
export function mergeRows<T extends object>(
  base: T[],
  user: T[],
  latest: T[],
  key: keyof T,
): T[] {
  const out: T[] = [];
  for (const l of latest) {
    const b = base.find((x) => x[key] === l[key]),
      u = user.find((x) => x[key] === l[key]);
    if (!b) {
      if (u && !same(u, l)) conflict();
      out.push(l);
    } else if (u) out.push(mergeRow(b, u, l));
    else if (!same(b, l)) conflict();
  }
  for (const u of user) {
    if (latest.some((x) => x[key] === u[key])) continue;
    const b = base.find((x) => x[key] === u[key]);
    if (b) {
      if (!same(b, u)) conflict();
    } else out.push(u);
  }
  return out;
}
