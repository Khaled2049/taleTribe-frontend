import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { request } from "@novelsync/story-data-client";
import { useAuthIdentity } from "@novelsync/platform-auth";
import { Button } from "@/components/ui/button";

interface Agreement {
  termsVersion: string;
  privacyVersion: string;
  attestationVersion: string;
  attestation: string;
  accepted: boolean;
  acceptedAt?: string;
}

export function WriterAgreementGate({ children }: { children: ReactNode }) {
  const { uid } = useAuthIdentity();
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [terms, setTerms] = useState(false);
  const [rights, setRights] = useState(false);
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setAgreement(null);
    setError("");
    setTerms(false);
    setRights(false);
    setAdult(false);
    if (uid) {
      request<Agreement>("/v1/me/writer-agreement", {
        auth: "required",
        signal: controller.signal,
      })
        .then(setAgreement)
        .catch(() => {
          if (!controller.signal.aborted)
            setError("Could not load your writer agreement. Please retry.");
        });
    }
    return () => controller.abort();
  }, [uid, attempt]);

  async function accept() {
    if (!agreement || !terms || !rights || !adult) return;
    setBusy(true);
    setError("");
    try {
      const next = await request<Agreement>("/v1/me/writer-agreement", {
        auth: "required",
        method: "POST",
        body: {
          termsVersion: agreement.termsVersion,
          privacyVersion: agreement.privacyVersion,
          attestationVersion: agreement.attestationVersion,
          agreeTerms: terms,
          acknowledgePrivacy: terms,
          attestRights: rights,
          adult,
        },
      });
      setAgreement(next);
    } catch {
      setError(
        "Your agreement could not be saved. Please retry. If the policies changed, reload to review the current version.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (agreement?.accepted) return <>{children}</>;
  return (
    <section
      className="max-w-2xl mx-auto p-6 space-y-5 text-ns-ink overflow-y-auto"
      aria-labelledby="writer-agreement-title"
    >
      <h2 id="writer-agreement-title" className="text-2xl font-semibold">
        Before you start writing
      </h2>
      <p>
        Review the policies and confirm these statements to create, import, or
        edit stories. Your agreement applies to future contributions, including
        cover images and AI-assisted writing.
      </p>
      {!uid ? (
        <p>Please sign in to continue.</p>
      ) : !agreement && !error ? (
        <p role="status">Loading your agreement…</p>
      ) : null}
      {agreement && (
        <fieldset disabled={busy} className="space-y-4">
          <div className="flex items-start gap-3">
            <input
              id="writer-terms"
              type="checkbox"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              className="mt-1"
            />
            <label htmlFor="writer-terms">
              I agree to the{" "}
              <Link
                className="underline"
                to="/terms-of-use"
                target="_blank"
                rel="noopener noreferrer"
              >
                Terms of Use
              </Link>{" "}
              (version {agreement.termsVersion}) and acknowledge the{" "}
              <Link
                className="underline"
                to="/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Privacy Policy
              </Link>{" "}
              (version {agreement.privacyVersion}).
            </label>
          </div>
          <div className="flex items-start gap-3">
            <input
              id="writer-rights"
              type="checkbox"
              checked={rights}
              onChange={(e) => setRights(e.target.checked)}
              className="mt-1"
            />
            <label htmlFor="writer-rights">{agreement.attestation}</label>
          </div>
          <div className="flex items-start gap-3">
            <input
              id="writer-adult"
              type="checkbox"
              checked={adult}
              onChange={(e) => setAdult(e.target.checked)}
              className="mt-1"
            />
            <label htmlFor="writer-adult">
              I am at least 18 years old and can enter into this agreement.
            </label>
          </div>
          <p className="text-sm">
            We record your account ID, the policy and attestation versions, and
            the time you agree. This does not opt you into marketing.
          </p>
          <Button
            type="button"
            onClick={accept}
            disabled={!terms || !rights || !adult || busy}
          >
            {busy ? "Saving agreement…" : "Agree and continue"}
          </Button>
        </fieldset>
      )}
      {error && (
        <div role="alert" className="space-y-2">
          <p>{error}</p>
          {!agreement && (
            <Button type="button" onClick={() => setAttempt((n) => n + 1)}>
              Retry
            </Button>
          )}
        </div>
      )}
      <p className="text-sm">
        <Link
          to="/help"
          className="underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Help, privacy requests, and copyright reports
        </Link>
      </p>
    </section>
  );
}
