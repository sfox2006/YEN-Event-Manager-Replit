import { useEffect, useState } from "react";
import { Header, Panel, Badge, ErrorBox } from "../components/ui";
interface AccountState {
  authConfigured: boolean;
  authRequired: boolean;
  authenticated: boolean;
  administrator: boolean;
  user: { subject: string; name: string; email: string } | null;
  loginPath: string | null;
  logoutPath: string | null;
}
export function Account() {
  const [account, setAccount] = useState<AccountState>(),
    [error, setError] = useState("");
  async function load() {
    setError("");
    try {
      const r = await fetch("/api/account", { cache: "no-store" });
      if (!r.ok)
        throw new Error("Unable to verify sign-in. Retry or sign in again.");
      setAccount(await r.json());
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  return (
    <>
      <Header
        title="Account"
        subtitle="Your verified sign-in and application access."
      />
      {error && (
        <>
          <ErrorBox message={error} />
          <button onClick={load}>Retry</button>
        </>
      )}
      {account ? (
        <Panel title={account.authenticated ? "Signed in" : "Sign-in"}>
          {!account.authConfigured ? (
            <>
              <p>Replit Auth has not been connected to this application yet.</p>
              <p>
                Ask the Replit project’s Agent to activate the supported
                authentication integration using the instructions in
                docs/REPLIT-AUTH-SETUP.md.
              </p>
              <p className="hint">
                Committee names, email fields and browser-local records are not
                authenticated accounts. Existing local records remain in this
                browser.
              </p>
            </>
          ) : account.authenticated && account.user ? (
            <>
              <h3>{account.user.name || "Your account"}</h3>
              <p>{account.user.email}</p>
              <p>
                Verified user ID: <code>{account.user.subject}</code>
              </p>
              <Badge
                value={account.administrator ? "Administrator" : "Signed-in user"}
              />
              <p className="hint">
                Administrator access is assigned on the server to an explicitly
                configured verified user ID. Local browser records are not
                automatically shared or linked to this identity.
              </p>
              {account.logoutPath && (
                <a className="email-button" href={account.logoutPath}>
                  Sign out
                </a>
              )}
            </>
          ) : (
            <>
              <p>Sign in through Replit to verify your identity.</p>
              {account.loginPath && (
                <a className="email-button" href={account.loginPath}>
                  Sign in with Replit
                </a>
              )}
            </>
          )}
        </Panel>
      ) : (
        !error && <p>Checking sign-in…</p>
      )}
    </>
  );
}
