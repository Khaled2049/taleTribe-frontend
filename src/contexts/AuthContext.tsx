import { useShallow } from "zustand/react/shallow";
import { AuthStore, useAuthStore } from "@/stores";

type AuthContextType = Pick<
  AuthStore,
  | "user"
  | "loading"
  | "followUser"
  | "unfollowUser"
  | "updateBio"
  | "updateProfile"
>;

export const useAuthContext = (): AuthContextType =>
  useAuthStore(
    useShallow((state) => ({
      user: state.user,
      loading: state.loading,
      followUser: state.followUser,
      unfollowUser: state.unfollowUser,
      updateBio: state.updateBio,
      updateProfile: state.updateProfile,
    })),
  );
