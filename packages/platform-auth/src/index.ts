export {
  app,
  auth,
  initializePlatformAuth,
  getPlatformAuth,
  type PlatformAuthOptions,
} from "./firebase.js";
export { getAuthContext, getCurrentUid, type AuthContext } from "./identity.js";
export { useAuthIdentity, type AuthIdentity } from "./useAuthIdentity.js";
