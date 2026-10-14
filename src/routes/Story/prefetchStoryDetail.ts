import {
  prefetchStoryDetail as detail,
  prefetchReaderChapter as chapter,
} from "@novelsync/reader-ui/routes/Story/prefetchStoryDetail";
import { appQueryClient } from "@/lib/queryClient";
export const prefetchStoryDetail = (storyId: string, client = appQueryClient) =>
  detail(storyId, client);
export const prefetchReaderChapter = (
  storyId: string,
  chapterId: string,
  client = appQueryClient,
) => chapter(storyId, chapterId, client);
