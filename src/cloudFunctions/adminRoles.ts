import api, { getApiErrorMessage } from "./index";

/** The admin claim lives in Firebase Auth, so roles are read and changed through admin-only Functions. */
export const adminRoleService = {
  /** Who holds the admin claim and whose account is banned (disabled). */
  async statuses(uids: string[]) {
    try {
      const { data } = await api.post<{ admins: string[]; banned: string[] }>(
        "/adminRoles",
        { uids },
      );
      return { admins: new Set(data.admins), banned: new Set(data.banned) };
    } catch (error) {
      throw new Error(getApiErrorMessage(error, "Could not load admin roles"));
    }
  },

  async setAdmin(uid: string, admin: boolean) {
    try {
      await api.post("/setAdminRole", { uid, admin });
    } catch (error) {
      throw new Error(
        getApiErrorMessage(error, "Could not change the admin role"),
      );
    }
  },

  async setBan(uid: string, banned: boolean, reason = "") {
    try {
      await api.post(
        "/setUserBan",
        banned ? { uid, banned, reason } : { uid, banned },
      );
    } catch (error) {
      throw new Error(getApiErrorMessage(error, "Could not change the ban"));
    }
  },
};
