import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import type { Bootstrap } from "../domain/types";
import type { DataService } from "./service";
import { DemoService } from "./demo";
import { GoogleService } from "./google";
import { cache } from "./readCache";
interface State {
  data: Bootstrap;
  service: DataService;
  refresh: (force?: boolean) => Promise<void>;
  mutate: <T>(fn: () => Promise<T>) => Promise<T>;
  toast: (s: string) => void;
  busy: boolean;
  install: (() => void) | null;
}
const C = createContext<State>(null!);
export const useData = () => useContext(C);
export function Provider({ children }: { children: ReactNode }) {
  const [attempt, setAttempt] = useState(0);
  const [service, setService] = useState<DataService>(),
    [data, setData] = useState<Bootstrap>(),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [install, setInstall] = useState<(() => void) | null>(null),
    generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const toast = (s: string) => {
    setMessage(s);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(""), 3500);
  };
  async function refresh(force = true) {
    if (!service) return;
    const g = ++generation.current;
    const d = await cache.read(
      "bootstrap",
      () => service.getBootstrap(),
      force,
    );
    if (g === generation.current) setData(d);
  }
  useEffect(() => {
    let alive = true;
    fetch("/api/config", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("Unable to load configuration");
        return r.json();
      })
      .then((c) => {
        if (alive)
          setService(
            c.dataMode === "google" ? new GoogleService() : new DemoService(),
          );
      })
      .catch((e) => setError(e.message));
    return () => {
      alive = false;
    };
  }, [attempt]);
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, [service]);
  useEffect(() => {
    const h = (event: Event) => {
      event.preventDefault();
      if (window.matchMedia("(display-mode: standalone)").matches) return;
      setInstall(() => () => {
        const p = event as Event & {
          prompt: () => Promise<void>;
          userChoice: Promise<{ outcome: string }>;
        };
        p.prompt()
          .then(() => p.userChoice)
          .then((r) => {
            if (r.outcome === "accepted") setInstall(null);
          });
      });
    };
    const done = () => setInstall(null);
    window.addEventListener("beforeinstallprompt", h);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("beforeinstallprompt", h);
      window.removeEventListener("appinstalled", done);
    };
  }, []);
  if (error && !data)
    return (
      <main>
        <h1>Unable to load event data</h1>
        <p role="alert">{error}</p>
        <button
          onClick={() => {
            setError("");
            if (!service) setAttempt((a) => a + 1);
            else refresh().catch((e) => setError(e.message));
          }}
        >
          Retry
        </button>
      </main>
    );
  if (!service || !data)
    return (
      <main className="loading">
        Loading {service?.mode === "google" ? "shared event" : "local event"}{" "}
        data…
      </main>
    );
  async function mutate<T>(fn: () => Promise<T>) {
    setBusy(true);
    cache.invalidate();
    generation.current++;
    try {
      const result = await fn();
      cache.invalidate();
      await refresh();
      return result;
    } finally {
      cache.invalidate();
      setBusy(false);
    }
  }
  return (
    <C.Provider
      value={{ data, service, refresh, mutate, toast, busy, install }}
    >
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {message}
      </div>
    </C.Provider>
  );
}
