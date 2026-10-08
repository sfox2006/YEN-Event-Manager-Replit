import { useEffect, useState } from "react";
import {
  HashRouter,
  NavLink,
  Routes,
  Route,
  Navigate,
  useLocation,
  Link,
} from "react-router-dom";
import { Provider, useData } from "./data/context";
import {
  Dashboard,
  Events,
  Meetings,
  Tasks,
  Directory,
  Settings,
} from "./pages/Lists";
import { EventWorkspace } from "./pages/EventWorkspace";
function Shell() {
  const { service, install, refresh, busy, toast } = useData(),
    [menu, setMenu] = useState(false),
    [online, setOnline] = useState(navigator.onLine),
    location = useLocation();
  useEffect(() => {
    setMenu(false);
    window.scrollTo(0, 0);
    if (!busy && !document.querySelector("dialog[open],[data-dirty=true]"))
      refresh(false).catch((e) => toast(e.message));
  }, [location.pathname]);
  useEffect(() => {
    const h = () => setOnline(navigator.onLine);
    window.addEventListener("online", h);
    window.addEventListener("offline", h);
    return () => {
      window.removeEventListener("online", h);
      window.removeEventListener("offline", h);
    };
  }, []);
  return (
    <>
      <header className="app-header">
        <Link to="/dashboard" className="brand">
          <span className="logo">
            <img src="/icons/event.svg" alt="" />
          </span>
          <span>
            <strong>Event Manager</strong>
            <small>Organising Committee</small>
          </span>
        </Link>
        {install && <button onClick={install}>Install app</button>}
        <button
          className="menu-toggle"
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          Menu ☰
        </button>
        <nav aria-label="Main navigation" className={menu ? "expanded" : ""}>
          {[
            "Dashboard",
            "Events",
            "Meetings",
            "Tasks",
            "Committee",
            "Organisations",
            "Settings",
          ].map((label) => (
            <NavLink
              key={label}
              to={"/" + label.toLowerCase()}
              className={({ isActive }) =>
                isActive ||
                (label === "Events" && location.pathname.startsWith("/event/"))
                  ? "active"
                  : ""
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      {service.mode === "demo" && (
        <div className="demo-notice">
          Synthetic demo · Your records and local uploads stay in this browser.
          Each visitor has a separate demo.
        </div>
      )}
      {!online && (
        <div className="offline-notice">
          Offline —{" "}
          {service.mode === "google"
            ? "shared loading and saves need an internet connection."
            : "local demo records remain available; there is no queued shared synchronization."}
        </div>
      )}
      <main>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/events" element={<Events />} />
          <Route path="/event/:id" element={<EventWorkspace />} />
          <Route path="/meetings" element={<Meetings />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/committee" element={<Directory kind="member" />} />
          <Route
            path="/organisations"
            element={<Directory kind="organisation" />}
          />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
      <footer>YEN Event Manager · Plan together, keep track.</footer>
    </>
  );
}
export default function App() {
  return (
    <HashRouter>
      <Provider>
        <Shell />
      </Provider>
    </HashRouter>
  );
}
