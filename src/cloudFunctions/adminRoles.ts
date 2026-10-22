import api, { getApiErrorMessage } from "./index";

/** The admin claim lives in Firebase Auth, so roles are read and changed through admin-only Functions. */
export const adminRoleService = {
  async admins(uids: string[]) {
    try {
      const { data } = await api.post<{ admins: string[] }>("/adminRoles", {
        uids,
      });
      return new Set(data.admins);
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
};
