import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { auth } from "@novelsync/platform-auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SEOHead } from "@/components/seo/SEOHead";
import { APP_NAME } from "@/config/seo";
import { describeScopes } from "./mcpConsentScopes";

const MCP_BASE = (
  import.meta.env.VITE_AGENT_MCP_URL || "http://localhost:8000"
).replace(/\/$/, "");

interface TxnInfo {
  client_name: string;
  redirect_host: string;
  scopes: string[];
}

type Status =
  | "loading"
  | "ready"
  | "submitting"
  | "expired"
  | "denied" // 403 from /oauth/complete: account not on the rollout allowlist
  | "error";

const McpConnect = () => {
  const { user, loading } = useAuthContext();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const txnId = searchParams.get("txn");

  const [status, setStatus] = useState<Status>("loading");
  const [txn, setTxn] = useState<TxnInfo | null>(null);

  useEffect(() => {
    if (!txnId || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(
          `${MCP_BASE}/oauth/txn/${encodeURIComponent(txnId)}`,
        );
        if (cancelled) return;
        if (resp.status === 404) {
          setStatus("expired");
          return;
        }
        if (!resp.ok) {
          setStatus("error");
          return;
        }
        setTxn(await resp.json());
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [txnId, user]);

  const respond = useCallback(
    async (approve: boolean) => {
      if (!txnId) return;
      setStatus("submitting");
      try {
        const idToken = approve
          ? await auth.currentUser?.getIdToken()
          : undefined;
        const resp = await fetch(`${MCP_BASE}/oauth/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            txn_id: txnId,
            approve,
            ...(idToken ? { id_token: idToken } : {}),
          }),
        });
        if (resp.status === 404) {
          setStatus("expired");
          return;
        }
        if (resp.status === 403) {
          // The allowlist refusal, by far the likeliest failure while MCP is
          // invite-only. It carries a specific remedy (request access from
          // the profile page), so it must not collapse into the generic
          // "something went wrong".
          setStatus("denied");
          return;
        }
        if (!resp.ok) {
          setStatus("error");
          return;
        }
        const { redirect_url } = await resp.json();
        window.location.assign(redirect_url);
      } catch {
        setStatus("error");
      }
    },
    [txnId],
  );

  // Consent copy is derived from the requested scopes, never hardcoded — see
  // mcpConsentScopes.ts. Safe before `txn` loads: yields empty lists.
  const consent = describeScopes(txn?.scopes);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-ns-bg">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ns-accent" />
      </div>
    );
  }

  if (!user) {
    const back = `/mcp-connect?txn=${encodeURIComponent(txnId ?? "")}`;
    return <Navigate to={`/sign-in?redirect=${encodeURIComponent(back)}`} />;
  }

  return (
    <>
      <SEOHead
        title={`Connect an App - ${APP_NAME}`}
        description="Approve or deny an application's request to access your stories."
        noindex={true}
        nofollow={true}
      />
      <div className="flex items-center justify-center min-h-[60vh] bg-ns-bg px-4">
        <Card className="w-full max-w-md">
          {!txnId || status === "expired" ? (
            <>
              <CardHeader>
                <CardTitle>Connection request expired</CardTitle>
                <CardDescription>
                  This connection request is no longer valid. Restart the
                  connection from your MCP client (for example, reconnect the{" "}
                  {APP_NAME} connector in Claude) to get a fresh one.
                </CardDescription>
              </CardHeader>
            </>
          ) : status === "denied" ? (
            <>
              <CardHeader>
                <CardTitle>Your account needs MCP access</CardTitle>
                <CardDescription>
                  MCP connections are currently limited to approved accounts,
                  and this one hasn't been approved yet. Request access from
                  your profile settings — once it's granted, restart the
                  connection from your MCP client.
                </CardDescription>
              </CardHeader>
              <CardFooter className="justify-end">
                <Button onClick={() => navigate(`/profile/${user.uid}`)}>
                  Request access
                </Button>
              </CardFooter>
            </>
          ) : status === "error" ? (
            <CardHeader>
              <CardTitle>Something went wrong</CardTitle>
              <CardDescription>
                We couldn't process this connection request. Try again from your
                MCP client.
              </CardDescription>
            </CardHeader>
          ) : status === "loading" || !txn ? (
            <CardContent className="py-10 flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ns-accent" />
            </CardContent>
          ) : (
            <>
              <CardHeader>
                <CardTitle>Allow "{txn.client_name}" to connect?</CardTitle>
                <CardDescription>
                  An application is asking for access to your {APP_NAME}{" "}
                  account.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="rounded-md border border-ns-border p-3">
                  <p className="font-medium text-ns-ink">It will be able to:</p>
                  <ul className="mt-1 list-disc pl-5 text-ns-ink/80">
                    {consent.grants.map((grant) => (
                      <li key={grant}>{grant}</li>
                    ))}
                    {consent.unrecognized.map((scope) => (
                      <li key={scope}>
                        Use a permission this page doesn't recognize:{" "}
                        <span className="font-mono">{scope}</span>
                      </li>
                    ))}
                    {consent.grants.length === 0 &&
                      consent.unrecognized.length === 0 && (
                        <li>No permissions were requested</li>
                      )}
                  </ul>
                  {consent.withheld.length > 0 && (
                    <>
                      <p className="mt-2 font-medium text-ns-ink">It cannot:</p>
                      <ul className="mt-1 list-disc pl-5 text-ns-ink/80">
                        {consent.withheld.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
                {consent.unrecognized.length > 0 && (
                  <p className="text-xs text-ns-destructive">
                    This request includes a permission this page can't describe.
                    If you weren't expecting that, deny it and check that{" "}
                    {APP_NAME} is up to date.
                  </p>
                )}
                <p className="text-xs text-ns-ink/60">
                  After approval you'll be sent to{" "}
                  <span className="font-mono">{txn.redirect_host}</span>. The
                  app name above is self-reported — only approve connections you
                  started yourself.
                </p>
              </CardContent>
              <CardFooter className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  disabled={status === "submitting"}
                  onClick={() => respond(false)}
                >
                  Deny
                </Button>
                <Button
                  disabled={status === "submitting"}
                  onClick={() => respond(true)}
                >
                  {status === "submitting" ? "Connecting…" : "Allow access"}
                </Button>
              </CardFooter>
            </>
          )}
        </Card>
      </div>
    </>
  );
};

export default McpConnect;
