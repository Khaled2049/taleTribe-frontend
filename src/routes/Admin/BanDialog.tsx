import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { adminRoleService } from "@/cloudFunctions/adminRoles";
import type { AdminMember } from "@/services/AdminMemberService";

const MAX_REASON = 500;
const textarea =
  "mt-2 block w-full rounded-ns border border-ns-border bg-ns-elevated px-3 py-2 text-sm text-ns-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent";

/** Confirms banning a member from the platform, or lifting the ban. */
export function BanDialog({
  change,
  viewerId,
  onClose,
}: {
  change: { member: AdminMember; banned: boolean } | null;
  viewerId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    setReason("");
    setError("");
  }, [change]);

  const who = `@${change?.member.username ?? ""}`;
  async function confirm() {
    if (!change) return false;
    try {
      await adminRoleService.setBan(
        change.member.userId,
        change.banned,
        reason.trim(),
      );
      await queryClient.invalidateQueries({
        queryKey: ["admin", viewerId, "roles"],
      });
      toast.success(
        change.banned
          ? `${who} is banned and has been signed out.`
          : `${who} can sign in again.`,
      );
      return true;
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not change the ban.",
      );
      return false;
    }
  }

  return (
    <ConfirmDialog
      open={change !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={change?.banned ? `Ban ${who}?` : `Unban ${who}?`}
      description={
        change?.banned
          ? "They are signed out of every device at once and cannot sign in again, use the API or the Claude connector. Their published stories stay up; delete any that need removing from Admin → Stories."
          : "They can sign in again with their existing account. Anything turned off separately, like AI access, stays as it is."
      }
      confirmLabel={change?.banned ? "Ban member" : "Unban"}
      variant={change?.banned ? "danger" : "default"}
      onConfirm={confirm}
    >
      {change?.banned && (
        <label className="block text-sm">
          Reason (optional, only admins see it)
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={MAX_REASON}
            rows={3}
            className={textarea}
          />
        </label>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-ns-destructive">
          {error}
        </p>
      )}
    </ConfirmDialog>
  );
}
