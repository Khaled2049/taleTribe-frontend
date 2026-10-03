import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { storyWorkspaceRepo } from "@novelsync/story-data-client";
import { auth } from "@novelsync/platform-auth";
import { storageService } from "@/services/StorageService";
import type { Story, StoryMetadata } from "@novelsync/story-data-client";

function patchOwnerStory(
  stories: StoryMetadata[] | undefined,
  updated: Story,
): StoryMetadata[] | undefined {
  if (!stories) return stories;
  return stories
    .map((story) =>
      story.id === updated.id
        ? {
            ...story,
            ...updated,
            // The single-story response does not contain list aggregates.
            chapterCount: story.chapterCount,
            wordCount: story.wordCount,
            views: story.views,
            likes: story.likes,
            averageRating: story.averageRating,
            ratingsCount: story.ratingsCount,
          }
        : story,
    )
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

async function updateStoryCover(
  storyId: string,
  imageFile: File | null,
  previewUrl: string | null,
) {
  const user = auth.currentUser;
  if (!user)
    throw new Error("You must be signed in to update the cover image.");
  const story = await storyWorkspaceRepo.getStory(storyId);
  if (!story) throw new Error("Story not found");
  if (story.userId !== user.uid)
    throw new Error("You do not have permission to update this cover.");
  if (story.coverImageUrl)
    await storageService.deleteCoverImage(story.coverImageUrl);
  if (story.thumbnailUrl && story.thumbnailUrl !== story.coverImageUrl)
    await storageService.deleteCoverImage(story.thumbnailUrl);
  let coverImageUrl = "";
  let thumbnailUrl = "";
  if (imageFile) {
    ({ coverImageUrl, thumbnailUrl } = await storageService.uploadCoverImage(
      imageFile,
      user.uid,
      storyId,
    ));
  } else if (previewUrl?.startsWith("data:")) {
    ({ coverImageUrl, thumbnailUrl } = await storageService.uploadCoverImage(
      storageService.dataUrlToFile(previewUrl),
      user.uid,
      storyId,
    ));
  }
  return storyWorkspaceRepo.updateStory({
    ...story,
    coverImageUrl,
    thumbnailUrl,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function useDeleteStory(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (storyId: string) =>
      storyWorkspaceRepo.deleteStoryByID(storyId),
    onSuccess: async (_result, storyId) => {
      if (userId) {
        const key = queryKeys.user.stories(userId);
        await queryClient.cancelQueries({ queryKey: key });
        queryClient.setQueryData<StoryMetadata[]>(key, (stories) =>
          stories?.filter((story) => story.id !== storyId),
        );
      }
      queryClient.invalidateQueries({
        queryKey: queryKeys.workspace.all(userId!),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.stories.all(),
      });
    },
  });
}

export function useTogglePublishStory(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (storyId: string) => {
      const story = await storyWorkspaceRepo.getStory(storyId);
      if (!story) throw new Error("Story not found");
      return storyWorkspaceRepo.updateStory({
        ...story,
        isPublished: !story.isPublished,
      });
    },
    onSuccess: async (updated) => {
      if (userId) {
        const key = queryKeys.user.stories(userId);
        await queryClient.cancelQueries({ queryKey: key });
        queryClient.setQueryData<StoryMetadata[]>(key, (stories) =>
          patchOwnerStory(stories, updated),
        );
      }
      queryClient.invalidateQueries({
        queryKey: queryKeys.workspace.all(userId!),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.stories.all(),
      });
    },
  });
}

export function useUpdateStoryMetadata(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      storyId,
      data,
    }: {
      storyId: string;
      data: {
        title: string;
        description: string;
        category?: string;
        tags?: string[];
        targetAudience?: string;
        language?: string;
        copyright?: string;
      };
    }) => storyWorkspaceRepo.updateStoryByID(storyId, data),
    onSuccess: async (updated) => {
      if (userId) {
        const key = queryKeys.user.stories(userId);
        await queryClient.cancelQueries({ queryKey: key });
        queryClient.setQueryData<StoryMetadata[]>(key, (stories) =>
          patchOwnerStory(stories, updated),
        );
      }
      queryClient.invalidateQueries({
        queryKey: queryKeys.workspace.all(userId!),
      });
    },
  });
}

export function useUpdateStoryCover(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      storyId,
      imageFile,
      previewUrl,
    }: {
      storyId: string;
      imageFile: File | null;
      previewUrl: string | null;
    }) => updateStoryCover(storyId, imageFile, previewUrl),
    onSuccess: async (updated) => {
      if (userId) {
        const key = queryKeys.user.stories(userId);
        await queryClient.cancelQueries({ queryKey: key });
        queryClient.setQueryData<StoryMetadata[]>(key, (stories) =>
          patchOwnerStory(stories, updated),
        );
      }
      queryClient.invalidateQueries({
        queryKey: queryKeys.workspace.all(userId!),
      });
    },
  });
}
