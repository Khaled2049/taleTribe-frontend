import api, { getApiErrorMessage } from "./index";

export type InviteStatus =
  "pending" | "approved" | "sent" | "completed" | "rejected";

export interface AdminInvite {
  email: string;
  status: InviteStatus;
  requestedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  sentAt: string | null;
  completedAt: string | null;
  linkSentCount: number;
}

export interface AdminInvitePage {
  invites: AdminInvite[];
  nextCursor: string | null;
}

/** Invite requests live in Firestore, which clients may not list; these go through admin-only Functions. */
export const adminInviteService = {
  async list(status: InviteStatus | "", cursor: string) {
    try {
      const params: Record<string, string> = {};
      if (status) params.status = status;
      if (cursor) params.cursor = cursor;
      const { data } = await api.get<AdminInvitePage>("/listInvites", {
        params,
      });
      return data;
    } catch (error) {
      throw new Error(getApiErrorMessage(error, "Could not load invites"));
    }
  },

  async review(email: string, decision: "approve" | "reject") {
    try {
      const { data } = await api.post<AdminInvite>("/reviewInvite", {
        email,
        decision,
      });
      return data;
    } catch (error) {
      throw new Error(
        getApiErrorMessage(error, `Could not ${decision} invite`),
      );
    }
  },
};
