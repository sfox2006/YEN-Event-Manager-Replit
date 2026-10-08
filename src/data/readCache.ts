export class ReadCache {
  generation = 0;
  private entries = new Map<string, { at: number; value: unknown }>();
  private pending = new Map<string, Promise<unknown>>();
  invalidate() {
    this.generation++;
    this.entries.clear();
    this.pending.clear();
  }
  peek<T>(key: string): T | undefined {
    const e = this.entries.get(key);
    return e && Date.now() - e.at < 300000
      ? (structuredClone(e.value) as T)
      : undefined;
  }
  async read<T>(
    key: string,
    load: () => Promise<T>,
    force = false,
  ): Promise<T> {
    const e = this.entries.get(key);
    if (!force && e && Date.now() - e.at < 15000)
      return structuredClone(e.value) as T;
    if (!force && this.pending.has(key))
      return structuredClone(await this.pending.get(key)) as T;
    const gen = this.generation,
      p = load().then((value) => {
        if (gen === this.generation) {
          this.entries.set(key, {
            at: Date.now(),
            value: structuredClone(value),
          });
          while (this.entries.size > 30)
            this.entries.delete(this.entries.keys().next().value!);
        }
        return value;
      });
    this.pending.set(key, p);
    try {
      return structuredClone(await p);
    } finally {
      if (this.pending.get(key) === p) this.pending.delete(key);
    }
  }
}
export const cache = new ReadCache();
