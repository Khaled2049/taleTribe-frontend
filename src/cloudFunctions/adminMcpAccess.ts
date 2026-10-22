import api, { getApiErrorMessage } from "./index";

export type McpStatus = "requested" | "granted" | "revoked";
export type McpDecision = "grant" | "reject" | "revoke";

export interface McpAccessRecord {
  uid: string;
  email: string | null;
  status: McpStatus;
  note: string;
  requestedAt: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
}

/** Connector access lives in Firestore, which clients may not list; these go through admin-only Functions. */
export const adminMcpAccessService = {
  async list(status: McpStatus | "", cursor: string) {
    try {
      const params: Record<string, string> = {};
      if (status) params.status = status;
      if (cursor) params.cursor = cursor;
      const { data } = await api.get<{
        records: McpAccessRecord[];
        nextCursor: string | null;
      }>("/listMcpAccess", { params });
      return data;
    } catch (error) {
      throw new Error(
        getApiErrorMessage(error, "Could not load connector access"),
      );
    }
  },

  async review(uid: string, decision: McpDecision) {
    try {
      const { data } = await api.post<McpAccessRecord>("/reviewMcpAccess", {
        uid,
        decision,
      });
      return data;
    } catch (error) {
      throw new Error(
        getApiErrorMessage(error, `Could not ${decision} access`),
      );
    }
  },
};
