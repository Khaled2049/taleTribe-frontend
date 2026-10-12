import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { profileRepo, type PublicProfile } from "@novelsync/story-data-client";
import { queryKeys } from "./queries/queryKeys.js";
import type { ReaderIdentity, ReaderUser, ReaderViewer } from "../runtime.js";

/** Profile/follow adapter for apps that do not need the web's private legacy user document. */
export function useReaderProfile(identity: ReaderIdentity): ReaderViewer {
  const client = useQueryClient();
  const uid = identity.uid;
  const profile = useQuery({
    queryKey: ["reader", uid, "profile"],
    queryFn: () => profileRepo.getMe(),
    enabled: !!uid && !identity.loading,
  });
  const follows = useQuery({
    queryKey: ["reader", uid, "follows"],
    queryFn: () => profileRepo.getMyFollows(),
    enabled: !!uid && !identity.loading,
  });
  const user: ReaderUser | null = uid
    ? {
        uid,
        username: profile.data?.username || identity.displayName || "Signed in",
        firstName: profile.data?.firstName,
        photoURL: profile.data?.photoURL || identity.photoURL,
        following: follows.data?.following ?? [],
      }
    : null;
  async function setFollow(targetId: string, following: boolean) {
    if (!uid) throw new Error("Sign in to follow an author.");
    await profileRepo.setFollow(targetId, following);
    await client.invalidateQueries({ queryKey: ["reader", uid, "follows"] });
  }
  useEffect(() => {
    if (!uid || !profile.data) return;
    const key = queryKeys.user.publicProfile(uid);
    if (!client.getQueryData<PublicProfile>(key))
      client.setQueryData(key, profile.data);
  }, [uid, profile.data, client]);
  return {
    user,
    loading: identity.loading || (!!uid && profile.isPending),
    followUser: (targetId) => setFollow(targetId, true),
    unfollowUser: (targetId) => setFollow(targetId, false),
  };
}
