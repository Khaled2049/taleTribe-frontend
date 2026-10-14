import { prefetchStoriesPage as prefetch } from "@novelsync/reader-ui/routes/Story/prefetchStories";
import { appQueryClient } from "@/lib/queryClient";
export const prefetchStoriesPage = (client = appQueryClient) =>
  prefetch(client);
