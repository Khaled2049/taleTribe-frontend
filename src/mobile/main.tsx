import "@/index.css";
// After index.css: fonts.css re-points Tailwind's font utilities at the
// bundled families, and equal-specificity rules resolve by order.
import "./fonts.css";
import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { createHashRouter, redirect, RouterProvider } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { SEOProvider } from "@/contexts/HelmetProvider";
import { ThemeToaster } from "@/components/common/ThemeToaster";
import { RouteError } from "@/components/common/RouteError";
import { appQueryClient } from "@/lib/queryClient";
import { storyIdFromParam } from "@/lib/seoPaths";
import { prefetchStoriesPage } from "@/routes/Story/prefetchStories";
import {
  prefetchReaderChapter,
  prefetchStoryDetail,
} from "@/routes/Story/prefetchStoryDetail";
import { StoriesPageSkeleton } from "@/routes/Story/StoriesPageSkeleton";
import { StoryDetailSkeleton } from "@/routes/Story/StoryDetailSkeleton";
import { MobileBootstrap } from "./MobileBootstrap";
import { MobileShell } from "./MobileShell";

const AllStories = lazy(() => import("@/routes/Story/AllStories"));
const StoryDetail = lazy(() => import("@/routes/Story/StoryDetail"));
const Shelf = lazy(() => import("./routes/Shelf"));
const Account = lazy(() => import("./routes/Account"));
const SignIn = lazy(() => import("./routes/SignIn"));
const ExternalLink = lazy(() => import("./routes/ExternalLink"));

const stories = (
  <Suspense fallback={<StoriesPageSkeleton />}>
    <AllStories />
  </Suspense>
);

// A hash router, because the bundle is served from a file-like origin with no
// server to rewrite deep paths. Path shapes match the web app on purpose:
// StoryDetail matches "/story/:id/read/:chapterId?" itself, and shared
// components build links with seoPaths.
const router = createHashRouter([
  {
    path: "/",
    element: <MobileShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, loader: () => redirect("/stories") },
      {
        path: "stories",
        loader: () => {
          void prefetchStoriesPage();
          return null;
        },
        element: stories,
      },
      { path: "stories/genre/:genre", element: stories },
      { path: "stories/tag/:tag", element: stories },
      {
        path: "story/:id",
        loader: ({ params }) => {
          const storyId = storyIdFromParam(params.id);
          if (storyId) void prefetchStoryDetail(storyId);
          return null;
        },
        element: (
          <Suspense fallback={<StoryDetailSkeleton />}>
            <StoryDetail />
          </Suspense>
        ),
        children: [
          {
            path: "read/:chapterId?",
            element: null,
            loader: ({ params }) => {
              const storyId = storyIdFromParam(params.id);
              if (storyId && params.chapterId) {
                void prefetchReaderChapter(storyId, params.chapterId);
              }
              return null;
            },
          },
        ],
      },
      {
        path: "shelf",
        element: (
          <Suspense fallback={null}>
            <Shelf />
          </Suspense>
        ),
      },
      {
        path: "account",
        element: (
          <Suspense fallback={null}>
            <Account />
          </Suspense>
        ),
      },
      {
        path: "sign-in",
        element: (
          <Suspense fallback={null}>
            <SignIn />
          </Suspense>
        ),
      },
      {
        path: "*",
        element: (
          <Suspense fallback={null}>
            <ExternalLink />
          </Suspense>
        ),
      },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <SEOProvider>
    <QueryClientProvider client={appQueryClient}>
      <MobileBootstrap />
      <RouterProvider router={router} />
      <ThemeToaster />
    </QueryClientProvider>
  </SEOProvider>,
);
