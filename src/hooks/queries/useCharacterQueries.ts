import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { storyWorldbuildingRepo } from "@/services/StoryWorldbuildingRepo";
import { Character } from "@/types/ICharacter";

export function useCharacters(storyId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.characters.byStory(storyId!),
    queryFn: () => storyWorldbuildingRepo.getCharacters(storyId!),
    enabled: !!storyId,
  });
}

export function useDeleteCharacter(storyId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (characterId: string) =>
      storyWorldbuildingRepo.deleteCharacter(storyId!, characterId, queryClient.getQueryData<Character[]>(queryKeys.characters.byStory(storyId!))?.find((x) => x.id === characterId)?.revision),
    onMutate: async (characterId) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.characters.byStory(storyId!),
      });
      const prev = queryClient.getQueryData<Character[]>(
        queryKeys.characters.byStory(storyId!),
      );
      queryClient.setQueryData<Character[]>(
        queryKeys.characters.byStory(storyId!),
        (old) => old?.filter((character) => character.id !== characterId) ?? [],
      );
      return { prev };
    },
    onError: (_err, _characterId, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(queryKeys.characters.byStory(storyId!), ctx.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.characters.byStory(storyId!),
      });
    },
  });
}

export function useAddCharacter(storyId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (character: Omit<Character, "id">) =>
      storyWorldbuildingRepo.addCharacter(storyId!, character),
    onSuccess: (newCharacter) => {
      queryClient.setQueryData<Character[]>(
        queryKeys.characters.byStory(storyId!),
        (old) => {
          if (!old) return [newCharacter];
          const withoutExisting = old.filter((c) => c.id !== newCharacter.id);
          return [newCharacter, ...withoutExisting];
        },
      );
    },
  });
}

export function useUpdateCharacter(storyId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (character: Character) =>
      storyWorldbuildingRepo.updateCharacter(storyId!, character),
    onMutate: async (updated) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.characters.byStory(storyId!),
      });
      const prev = queryClient.getQueryData<Character[]>(
        queryKeys.characters.byStory(storyId!),
      );
      queryClient.setQueryData<Character[]>(
        queryKeys.characters.byStory(storyId!),
        (old) => old?.map((c) => (c.id === updated.id ? updated : c)) ?? [],
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(
          queryKeys.characters.byStory(storyId!),
          ctx.prev,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.characters.byStory(storyId!),
      });
    },
  });
}
