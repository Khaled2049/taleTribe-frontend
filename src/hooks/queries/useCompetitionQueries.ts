import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { competitionService } from "@/services/CompetitionService";
import type {
  ICompetition,
  ICompetitionDraftInput,
  ICompetitionUpdate,
} from "@/types/ICompetition";

/**
 * Competition list, with the caller's joined-set folded in.
 *
 * The merge happens inside `queryFn` rather than in the component, mirroring
 * how useGuestbookQueries enriches a page with the viewer's votes — so
 * `isJoined` is part of the cached value and every mutation invalidating this
 * key gets a consistent snapshot back.
 *
 * Keyed by user because `isJoined` is per-viewer; a shared key would leak one
 * user's join state to the next.
 */
export function useCompetitionsQuery(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.competitions.list(userId ?? "anonymous"),
    queryFn: async (): Promise<ICompetition[]> => {
      const [competitions, joinedIds] = await Promise.all([
        competitionService.getCompetitions(),
        userId
          ? competitionService.getUserJoinedCompetitionIds(userId)
          : Promise.resolve(new Set<string>()),
      ]);

      return competitions.map((competition) => ({
        ...competition,
        isJoined: joinedIds.has(competition.id),
      }));
    },
  });
}

/** Invalidate every competition list, regardless of which user it was keyed by. */
const invalidateAll = (queryClient: ReturnType<typeof useQueryClient>) =>
  queryClient.invalidateQueries({ queryKey: queryKeys.competitions.all() });

/** A host's own unpublished drafts. Empty for anyone who cannot host. */
export function useMyDraftsQuery(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.competitions.drafts(userId ?? "anonymous"),
    queryFn: () => competitionService.getMyDrafts(userId as string),
    enabled: !!userId,
  });
}

/** Save a draft. No money moves, so no balance invalidation. */
export function useSaveDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ICompetitionDraftInput) =>
      competitionService.saveDraft(input),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function usePublishCompetition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (competitionId: string) =>
      competitionService.publishCompetition(competitionId),
    onSuccess: () => {
      invalidateAll(queryClient);
      // Publishing funds escrow, so the host's balance just changed.
      queryClient.invalidateQueries({ queryKey: ["token", "balance"] });
    },
  });
}

export function useDiscardDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (competitionId: string) =>
      competitionService.discardDraft(competitionId),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useUpdateCompetition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      competitionId,
      updates,
    }: {
      competitionId: string;
      updates: ICompetitionUpdate;
    }) => competitionService.updateCompetition(competitionId, updates),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useCancelCompetition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      competitionId,
      reason,
    }: {
      competitionId: string;
      reason?: string;
    }) => competitionService.cancelCompetition(competitionId, reason),
    onSuccess: () => {
      invalidateAll(queryClient);
      // Cancelling refunds escrow to the creator.
      queryClient.invalidateQueries({ queryKey: ["token", "balance"] });
    },
  });
}

/**
 * Join, applied optimistically.
 *
 * Follows the cancel -> snapshot -> patch -> rollback -> settle shape used by
 * usePlaceQueries, so a failed join reverts the button and the participant
 * count rather than leaving the list lying.
 */
export function useJoinCompetition(userId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.competitions.list(userId ?? "anonymous");

  return useMutation({
    mutationFn: (competitionId: string) =>
      competitionService.joinCompetition(competitionId),
    onMutate: async (competitionId) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ICompetition[]>(queryKey);

      queryClient.setQueryData<ICompetition[]>(queryKey, (current) =>
        (current ?? []).map((competition) =>
          competition.id === competitionId
            ? {
                ...competition,
                isJoined: true,
                participants: competition.participants + 1,
              }
            : competition,
        ),
      );

      return { previous };
    },
    onError: (_error, _competitionId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => invalidateAll(queryClient),
  });
}

/**
 * One competition, with the viewer's join state folded in.
 *
 * `isJoined` is per-viewer, so it is merged here exactly as the list query does
 * it — and the key includes the user, because a shared key would leak one
 * user's join state to the next. Without this the detail page cannot tell
 * whether you have joined, and the "Enter a story" action stays disabled.
 */
export function useCompetitionQuery(
  competitionId: string | undefined,
  userId?: string,
) {
  return useQuery({
    queryKey: [
      ...queryKeys.competitions.detail(competitionId ?? ""),
      userId ?? "anonymous",
    ] as const,
    queryFn: async (): Promise<ICompetition | null> => {
      const competition = await competitionService.getCompetition(
        competitionId!,
      );
      if (!competition) return null;
      if (!userId) return competition;

      return {
        ...competition,
        isJoined: await competitionService.hasJoinedCompetition(
          competitionId!,
          userId,
        ),
      };
    },
    enabled: Boolean(competitionId),
  });
}

export function useSubmissionsQuery(competitionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.competitions.submissions(competitionId ?? ""),
    queryFn: () => competitionService.getSubmissions(competitionId!),
    enabled: Boolean(competitionId),
  });
}

/**
 * The viewer's own ballot. Kept as a separate query from the submissions list
 * because it is the only vote data a client is permitted to read — the running
 * tally is denied to every client by `firestore.rules`.
 */
export function useMyBallotQuery(
  competitionId: string | undefined,
  userId: string | undefined,
) {
  return useQuery({
    queryKey: queryKeys.competitions.myBallot(
      competitionId ?? "",
      userId ?? "anonymous",
    ),
    queryFn: () => competitionService.getMyBallot(competitionId!, userId!),
    enabled: Boolean(competitionId && userId),
  });
}

export function useSubmitStory(competitionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (storyId: string) =>
      competitionService.submitStory(competitionId, storyId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.competitions.detail(competitionId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.competitions.submissions(competitionId),
      });
    },
  });
}

export function useWithdrawSubmission(competitionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => competitionService.withdrawSubmission(competitionId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.competitions.detail(competitionId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.competitions.submissions(competitionId),
      });
    },
  });
}

/**
 * Replace the viewer's ballot.
 *
 * Optimistic on the ballot only. There is deliberately nothing to optimistically
 * update on the submissions themselves — no client-visible vote count exists
 * during voting.
 */
export function useCastVote(competitionId: string, userId: string | undefined) {
  const queryClient = useQueryClient();
  const ballotKey = queryKeys.competitions.myBallot(
    competitionId,
    userId ?? "anonymous",
  );

  return useMutation({
    mutationFn: (submissionIds: string[]) =>
      competitionService.castVote(competitionId, submissionIds),
    onMutate: async (submissionIds) => {
      await queryClient.cancelQueries({ queryKey: ballotKey });
      const previous = queryClient.getQueryData(ballotKey);
      queryClient.setQueryData(ballotKey, {
        voterId: userId ?? "",
        submissionIds,
      });
      return { previous };
    },
    onError: (_error, _ids, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(ballotKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ballotKey });
      queryClient.invalidateQueries({
        queryKey: queryKeys.competitions.detail(competitionId),
      });
    },
  });
}
