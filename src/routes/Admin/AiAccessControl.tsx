import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  adminAiUsageService,
  type AiSuspension,
  type AiSuspensionScope,
} from "@/cloudFunctions/adminAiUsage";
import { control } from "./usageCharts";

const MAX_REASON = 500;

const SCOPES: { value: AiSuspensionScope; label: string; detail: string }[] = [
  {
    value: "platform",
    label: "Platform AI only",
    detail:
      "Stops AI paid for by TheTaleTribe and credit top-ups. Their own API key keeps working.",
  },
  {
    value: "all",
    label: "All AI",
    detail: "Also stops AI on their own API key.",
  },
];

const scopeLabel = (scope: AiSuspensionScope) =>
  SCOPES.find((s) => s.value === scope)!.label;

/** Shows a member's AI access and lets an admin suspend or restore it. */
export function AiAccessControl({
  uid,
  who,
  suspension,
  isSelf,
  viewerId,
}: {
  uid: string;
  who: string;
  suspension: AiSuspension | null;
  isSelf: boolean;
  viewerId: string;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<AiSuspensionScope>("platform");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  function start() {
    setScope("platform");
    setReason("");
    setError("");
    setOpen(true);
  }

  async function confirm() {
    try {
      await adminAiUsageService.setSuspension(
        uid,
        suspension ? null : { scope, reason: reason.trim() },
      );
      await queryClient.invalidateQueries({
        queryKey: ["admin", viewerId],
        predicate: (query) =>
          query.queryKey[2] === "ai-usage-user" ||
          query.queryKey[2] === "ai-usage-users",
      });
      toast.success(
        suspension
          ? `AI is back on for ${who}.`
          : `AI is turned off for ${who} from their next request.`,
      );
      return true;
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not change this member's AI access.",
      );
      return false;
    }
  }

  return (
    <section
      aria-labelledby="ai-access"
      className="mt-6 flex flex-wrap items-start justify-between gap-4 rounded-ns border border-ns-border p-4"
    >
      <div className="max-w-prose text-sm">
        <h2 id="ai-access" className="font-semibold">
          AI access
        </h2>
        {suspension ? (
          <>
            <p className="mt-1 text-ns-destructive">
              Suspended: {scopeLabel(suspension.scope).toLowerCase()}
              {suspension.suspendedAt &&
                ` since ${new Date(suspension.suspendedAt).toLocaleString()}`}
              .
            </p>
            {suspension.reason && (
              <p className="mt-1 break-words text-ns-ink-secondary">
                Reason: {suspension.reason}
              </p>
            )}
          </>
        ) : (
          <p className="mt-1 text-ns-ink-secondary">
            Active. Daily limits and credits apply as usual.
          </p>
        )}
      </div>
      {!isSelf && (
        <button
          type="button"
          className={`${control} ${suspension ? "" : "text-ns-destructive"}`}
          onClick={start}
        >
          {suspension ? "Restore AI" : "Suspend AI"}
        </button>
      )}

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={suspension ? `Restore AI for ${who}?` : `Suspend AI for ${who}?`}
        description={
          suspension
            ? "They can use AI again from their next request, within their usual limits."
            : "It applies from their next AI request; they stay signed in and keep their stories. They see a message that AI is turned off for their account."
        }
        confirmLabel={suspension ? "Restore AI" : "Suspend AI"}
        variant={suspension ? "default" : "danger"}
        onConfirm={confirm}
      >
        {!suspension && (
          <div className="space-y-4 text-sm">
            <fieldset>
              <legend className="font-semibold">What to stop</legend>
              {SCOPES.map((option) => (
                <label key={option.value} className="mt-2 flex gap-2">
                  <input
                    type="radio"
                    name="ai-suspension-scope"
                    value={option.value}
                    checked={scope === option.value}
                    onChange={() => setScope(option.value)}
                    className="mt-1"
                  />
                  <span>
                    {option.label}
                    <span className="block text-ns-ink-secondary">
                      {option.detail}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
            <label className="block">
              Reason (optional, only admins see it)
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={MAX_REASON}
                rows={3}
                className={`${control} mt-2 block w-full`}
              />
            </label>
          </div>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-ns-destructive">
            {error}
          </p>
        )}
      </ConfirmDialog>
    </section>
  );
}
