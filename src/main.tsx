import "./polyfills";
import "./index.css";
import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import {
  createBrowserRouter,
  redirect,
  RouterProvider,
} from "react-router-dom";
import { NavbarWrapper } from "./NavbarWrapper";
import { Web3Boundary } from "./contexts/Web3Boundary";
import { ThemeToaster } from "./components/common/ThemeToaster";
import { SEOProvider } from "./contexts/HelmetProvider";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { appQueryClient } from "./lib/queryClient";
import { AuthBootstrap } from "./components/AppBootstrap/AuthBootstrap";
import { RouteError } from "./components/common/RouteError";
import { useAuthContext } from "./contexts/AuthContext";
import RequireAuth from "./routes/RequireAuth";
import { prefetchStoriesPage } from "./routes/Story/prefetchStories";
import {
  prefetchReaderChapter,
  prefetchStoryDetail,
} from "./routes/Story/prefetchStoryDetail";
import { prefetchBookClub } from "./routes/BookClub/prefetchBookClub";
import { getCurrentUid, useAuthIdentity } from "@novelsync/platform-auth";
import { storyIdFromParam } from "./lib/seoPaths";
import { prefetchGuestbookRoute } from "./routes/Guestbook/prefetchGuestbook";
import { StoriesPageSkeleton } from "./routes/Story/StoriesPageSkeleton";
import { UserStoriesSkeleton } from "./routes/Story/UserStoriesSkeleton";
import { prefetchUserStories } from "./routes/Story/prefetchUserStories";
import { WallPageSkeleton } from "./components/guestbook/WallSkeleton";
import { StoryDetailSkeleton } from "./routes/Story/StoryDetailSkeleton";
import {
  EditorCanvasSkeleton,
  EditorWorkspaceSkeleton,
} from "./components/editor/EditorWorkspaceSkeleton";

const Root = lazy(() => import("./routes/root"));
const Signin = lazy(() => import("./routes/Auth/sign-in"));
const Signup = lazy(() => import("./routes/Auth/sign-up"));
const StoryDetail = lazy(() => import("./routes/Story/StoryDetail"));
const BookClubs = lazy(() => import("./routes/BookClub"));
const UserStories = lazy(() => import("./routes/Story/UserStories"));
const AllStories = lazy(() => import("./routes/Story/AllStories"));
const BookClubDetails = lazy(() => import("./routes/BookClub/BookClubDetails"));
const Characters = lazy(() => import("./routes/Story/Characters"));
const Plot = lazy(() => import("./routes/Story/Plot"));
const Places = lazy(() => import("./routes/Story/Places"));
const CreateStory = lazy(() => import("./routes/Story/CreateStory"));
const PrivateRoute = lazy(() => import("./routes/PrivateRoute"));
const PrivacyPolicy = lazy(() => import("./routes/Legal/PrivacyPolicy"));
const TermsOfUse = lazy(() => import("./routes/Legal/TermsOfUse"));
const ForgotPassword = lazy(() => import("./routes/Auth/forgot-password"));
const CompleteSignup = lazy(() => import("./routes/Auth/complete-signup"));
const McpConnect = lazy(() => import("./routes/Auth/McpConnect"));
const Competitions = lazy(() => import("./components/explore/Competitions"));
const CompetitionDetail = lazy(
  () => import("./components/explore/CompetitionDetail"),
);
const CompetitionEditor = lazy(
  () => import("./components/explore/CompetitionEditor"),
);
const HowCompetitionsWork = lazy(
  () => import("./components/explore/HowCompetitionsWork"),
);

const HelpSupport = lazy(() => import("./routes/Help/HelpSupport"));
const PublicUserProfile = lazy(
  () => import("./routes/Profile/PublicUserProfile"),
);
const GuestbookPage = lazy(() => import("./routes/Guestbook/GuestbookPage"));
const PeopleDirectory = lazy(
  () => import("./components/guestbook/PeopleDirectory"),
);
const GuestbookSettings = lazy(
  () => import("./routes/Guestbook/GuestbookSettings"),
);
const WallPage = lazy(() => import("./routes/Guestbook/WallPage"));

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-ns-bg">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ns-accent"></div>
  </div>
);

/**
 * The signed-in home is the member's guestbook feed. The marketing page stays
 * at the same public URL for visitors, and auth must resolve before choosing a
 * page so returning members never see the marketing page flash on screen.
 */
const HomeRoute = () => {
  const { loading } = useAuthContext();
  const identity = useAuthIdentity();

  // The SDK may switch accounts before the React identity snapshot updates.
  if (identity.loading || identity.uid !== getCurrentUid()) {
    return <LoadingFallback />;
  }
  if (identity.uid) {
    return (
      <Suspense fallback={<WallPageSkeleton title="Your guestbook" />}>
        <WallPage />
      </Suspense>
    );
  }
  if (loading) return <LoadingFallback />;

  return <Root />;
};

const router = createBrowserRouter([
  {
    path: "/",
    element: <NavbarWrapper />,
    errorElement: <RouteError />,
    children: [
      {
        path: "/",
        loader: () => {
          const uid = getCurrentUid();
          if (uid) void prefetchGuestbookRoute("/", uid);
          return null;
        },
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <HomeRoute />
          </Suspense>
        ),
      },
      {
        path: "/privacy-policy",
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <PrivacyPolicy />
          </Suspense>
        ),
      },
      {
        path: "/terms-of-use",
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <TermsOfUse />
          </Suspense>
        ),
      },
      {
        path: "/stories",
        loader: () => {
          void prefetchStoriesPage();
          return null;
        },
        hydrateFallbackElement: <StoriesPageSkeleton />,
        element: (
          <Suspense fallback={<StoriesPageSkeleton />}>
            <AllStories />
          </Suspense>
        ),
      },
      // Genre and tag listings are the same page filtered, each at its own
      // crawlable URL. The filter is read from the params, not from state.
      ...["/stories/genre/:genre", "/stories/tag/:tag"].map((path) => ({
        path,
        hydrateFallbackElement: <StoriesPageSkeleton />,
        element: (
          <Suspense fallback={<StoriesPageSkeleton />}>
            <AllStories />
          </Suspense>
        ),
      })),
      {
        path: "/competitions",
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <Competitions />
          </Suspense>
        ),
      },
      // Declared before the dynamic sibling below. React Router ranks static
      // segments higher regardless of order, but the intent should not depend
      // on knowing that.
      {
        path: "/competitions/how-it-works",
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <HowCompetitionsWork />
          </Suspense>
        ),
      },
      {
        path: "/competitions/new",
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <CompetitionEditor />
          </Suspense>
        ),
      },
      {
        path: "/competitions/:competitionId",
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <CompetitionDetail />
          </Suspense>
        ),
      },
      {
        path: "/competitions/:competitionId/edit",
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <CompetitionEditor />
          </Suspense>
        ),
      },
      // /explore is retired: its sections are top-level routes now. These two
      // keep old links, bookmarks and indexed URLs working. The splat maps the
      // whole subtree in one rule — /explore/competitions/abc/edit and
      // /explore/guestbook/:uid included — so it needs no per-section entry.
      {
        path: "/explore",
        loader: () => redirect("/stories"),
      },
      {
        path: "/explore/*",
        loader: ({ params }) => redirect(`/${params["*"] ?? ""}`),
      },
      {
        path: "/book-clubs",
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <BookClubs />
          </Suspense>
        ),
      },
      {
        path: "/book-clubs/:id",
        loader: ({ params }) => {
          if (params.id) void prefetchBookClub(params.id);
          return null;
        },
        hydrateFallbackElement: <LoadingFallback />,
        element: (
          <RequireAuth>
            <Suspense fallback={<LoadingFallback />}>
              <BookClubDetails />
            </Suspense>
          </RequireAuth>
        ),
      },
      {
        path: "/sign-in",
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <Signin />
          </Suspense>
        ),
      },
      {
        path: "/sign-up",
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <Signup />
          </Suspense>
        ),
      },
      {
        path: "/mcp-connect",
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <McpConnect />
          </Suspense>
        ),
      },
      {
        path: "/profile/:userId",
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <PublicUserProfile />
          </Suspense>
        ),
      },
      // Your personal combined feed — own posts, people you follow, notes
      // left on your page. Declared before the dynamic sibling below; React
      // Router ranks static segments higher regardless of order, but the
      // intent should not depend on knowing that.
      {
        path: "/guestbook",
        loader: () => {
          const uid = getCurrentUid();
          if (uid) void prefetchGuestbookRoute("/guestbook", uid);
          return null;
        },
        element: (
          <Suspense fallback={<WallPageSkeleton title="Your guestbook" />}>
            <WallPage />
          </Suspense>
        ),
      },
      // The member directory is a section of the guestbook, not a per-user page,
      // so it takes a static segment. No uid can collide with "people" —
      // Firebase uids are 28 alphanumeric characters.
      {
        path: "/guestbook/people",
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <PeopleDirectory />
          </Suspense>
        ),
      },
      {
        path: "/guestbook/settings",
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <GuestbookSettings />
          </Suspense>
        ),
      },
      {
        path: "/guestbook/:userId",
        loader: ({ params }) => {
          const uid = getCurrentUid();
          if (params.userId && uid) {
            void prefetchGuestbookRoute(`/guestbook/${params.userId}`, uid);
          }
          return null;
        },
        element: (
          <Suspense fallback={<WallPageSkeleton />}>
            <GuestbookPage />
          </Suspense>
        ),
      },
      {
        path: "/help",
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <HelpSupport />
          </Suspense>
        ),
      },
      {
        path: "/forgot-password",
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <ForgotPassword />
          </Suspense>
        ),
      },
      {
        path: "/auth/complete-signup",
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <Web3Boundary>
              <CompleteSignup />
            </Web3Boundary>
          </Suspense>
        ),
      },
      {
        path: "/create/:storyId",
        // Not awaited, and imported lazily to keep the story-data workspace
        // client out of the entry bundle; the shelf's hover has usually loaded
        // it already. The uid is null until Firebase restores a session, so a
        // cold refresh preloads only code and the guard fetches the data.
        loader: ({ params, request }) => {
          const { storyId } = params;
          if (storyId) {
            const uid = getCurrentUid();
            const chapterId = new URL(request.url).searchParams.get("chapter");
            void import("./routes/Story/prefetchWorkspace").then(
              ({ prefetchWorkspace }) =>
                prefetchWorkspace(uid, storyId, chapterId),
            );
          }
          return null;
        },
        shouldRevalidate: ({ currentParams, nextParams }) =>
          currentParams.storyId !== nextParams.storyId,
        hydrateFallbackElement: <EditorWorkspaceSkeleton />,
        element: (
          <Suspense fallback={<EditorWorkspaceSkeleton />}>
            <PrivateRoute />
          </Suspense>
        ),
        children: [
          {
            index: true,
            element: (
              <Suspense fallback={<EditorCanvasSkeleton />}>
                <CreateStory />
              </Suspense>
            ),
          },
          {
            path: "characters",
            element: (
              <Suspense fallback={<LoadingFallback />}>
                <Characters />
              </Suspense>
            ),
          },
          {
            path: "plot",
            element: (
              <Suspense fallback={<LoadingFallback />}>
                <Plot />
              </Suspense>
            ),
          },
          {
            path: "places",
            element: (
              <Suspense fallback={<LoadingFallback />}>
                <Places />
              </Suspense>
            ),
          },
        ],
      },
      {
        path: "/user-stories",
        loader: () => {
          prefetchUserStories(getCurrentUid());
          return null;
        },
        hydrateFallbackElement: <UserStoriesSkeleton />,
        element: (
          <RequireAuth>
            <Suspense fallback={<UserStoriesSkeleton />}>
              <UserStories />
            </Suspense>
          </RequireAuth>
        ),
      },
      {
        path: "/story/:id",
        loader: ({ params }) => {
          const storyId = storyIdFromParam(params.id);
          if (storyId) void prefetchStoryDetail(storyId);
          return null;
        },
        hydrateFallbackElement: <StoryDetailSkeleton />,
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
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <SEOProvider>
    <QueryClientProvider client={appQueryClient}>
      <AuthBootstrap />
      <RouterProvider router={router} />
      <ThemeToaster />
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  </SEOProvider>,
);
