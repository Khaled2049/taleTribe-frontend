import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  initializePlatformAuth,
  getAuthContext,
  getCurrentUid,
} from "@novelsync/platform-auth";
import { configureStoryData } from "@novelsync/story-data-client";
import {
  AllStories,
  StoryDetail,
  ChapterReader,
  ContinueReadingList,
  ReaderProvider,
  useReaderProfile,
} from "@novelsync/reader-ui";
import type { ReaderEnvironment } from "@novelsync/reader-ui";
import { DEFAULT_READER_SETTINGS } from "@novelsync/reader-ui/routes/Story/constants/readerThemes";
import { useAuthIdentity } from "@novelsync/platform-auth";
import "./styles.css";

initializePlatformAuth({
  platform: "mobile",
  firebase: {
    apiKey: "fixture-key",
    projectId: "fixture",
    appId: "fixture-app",
  },
});
configureStoryData({
  baseUrl: "https://fixture.invalid",
  getAuthContext,
  getUid: getCurrentUid,
});
const client = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
function Bootstrap() {
  const identity = useAuthIdentity();
  const viewer = useReaderProfile(identity);
  const preferences: ReaderEnvironment["preferences"] = {
    settings: DEFAULT_READER_SETTINGS,
    updateSettings: () => undefined,
    resetSettings: () => undefined,
    isLoading: false,
  };
  return (
    <ReaderProvider
      value={{
        identity,
        viewer,
        preferences,
        appName: "Reader fixture",
        lookupWord: async (word) => ({
          word,
          definition: "fixture",
          partOfSpeech: "noun",
        }),
        highlights: {
          getByChapter: async () => [],
          save: async (value) => value,
          update: async () => {
            throw new Error("unused");
          },
          delete: async () => undefined,
        },
      }}
    >
      <MemoryRouter>
        <Routes>
          <Route
            path="/"
            element={
              <ChapterReader
                currentChapter={{
                  id: "chapter",
                  title: "Fixture",
                  content: "<p>Read independently.</p>",
                }}
                currentChapterIndex={0}
                totalChapters={1}
                onBackToDetails={() => undefined}
                onPrevChapter={() => undefined}
                onNextChapter={() => undefined}
              />
            }
          />
          <Route path="/stories" element={<AllStories />} />
          <Route path="/story/:id" element={<StoryDetail />}>
            <Route path="read/:chapterId?" element={null} />
          </Route>
          <Route
            path="/shelf"
            element={
              <ContinueReadingList
                items={[]}
                loading={false}
                error={false}
                onOpen={() => undefined}
                onClear={() => undefined}
                onExplore={() => undefined}
              />
            }
          />
        </Routes>
      </MemoryRouter>
    </ReaderProvider>
  );
}
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    <Bootstrap />
  </QueryClientProvider>,
);
