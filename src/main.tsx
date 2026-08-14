import "./polyfills";
import "./index.css";
import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { NavbarWrapper } from "./NavbarWrapper";
import { Web3Provider } from "./contexts/Web3Provider";
import { ThemeToaster } from "./components/common/ThemeToaster";
import { SEOProvider } from "./contexts/HelmetProvider";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { appQueryClient } from "./lib/queryClient";
import { AuthBootstrap } from "./components/AppBootstrap/AuthBootstrap";
import { RouteError } from "./components/common/RouteError";

const Root = lazy(() => import("./routes/root"));
const Signin = lazy(() => import("./routes/Auth/sign-in"));
const Signup = lazy(() => import("./routes/Auth/sign-up"));
const StoryDetail = lazy(() => import("./routes/Story/StoryDetail"));
const BookClubs = lazy(() => import("./routes/BookClub"));
const Home = lazy(() => import("./routes/Home"));
const UserStories = lazy(() => import("./routes/Story/UserStories"));
const AllStories = lazy(() => import("./routes/Story/AllStories"));
const BookClubDetails = lazy(() => import("./routes/BookClub/BookClubDetails"));
const Characters = lazy(() => import("./routes/Story/Characters"));
const Plot = lazy(() => import("./routes/Story/Plot"));
const Places = lazy(() => import("./routes/Story/Places"));
const CreateStory = lazy(() => import("./routes/Story/CreateStory"));
const PrivateRoute = lazy(() => import("./routes/PrivateRoute"));
const PrivacyPolicy = lazy(() => import("./components/pages/PrivacyPolicy"));
const TermsOfUse = lazy(() => import("./components/pages/TermsOfUse"));
const ForgotPassword = lazy(() => import("./routes/Auth/forgot-password"));
const CompleteSignup = lazy(() => import("./routes/Auth/complete-signup"));
const McpConnect = lazy(() => import("./routes/Auth/McpConnect"));
const StoriesLayout = lazy(() => import("./routes/Story/StoriesLayout"));
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
const DemoEditorPage = lazy(() => import("./routes/Demo/DemoEditorPage"));
const DemoEditorIndex = lazy(() => import("./routes/Demo/DemoEditorIndex"));
const PublicUserProfile = lazy(
  () => import("./routes/Profile/PublicUserProfile"),
);

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-ns-bg">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ns-accent"></div>
  </div>
);

const router = createBrowserRouter([
  {
    path: "/",
    element: <NavbarWrapper />,
    errorElement: <RouteError />,
    children: [
      {
        path: "/",
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <Root />
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
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <AllStories />
          </Suspense>
        ),
      },
      {
        path: "/explore",
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <StoriesLayout />
          </Suspense>
        ),
        children: [
          {
            index: true,
            element: (
              <Suspense fallback={<LoadingFallback />}>
                <AllStories />
              </Suspense>
            ),
          },
          {
            path: "competitions",
            element: (
              <Suspense fallback={<LoadingFallback />}>
                <Competitions />
              </Suspense>
            ),
          },
          // Declared before the dynamic sibling below. React Router ranks
          // static segments higher regardless of order, but the intent should
          // not depend on knowing that.
          {
            path: "competitions/how-it-works",
            element: (
              <Suspense fallback={<LoadingFallback />}>
                <HowCompetitionsWork />
              </Suspense>
            ),
          },
          {
            path: "competitions/new",
            element: (
              <Suspense fallback={<LoadingFallback />}>
                <CompetitionEditor />
              </Suspense>
            ),
          },
          {
            path: "competitions/:competitionId",
            element: (
              <Suspense fallback={<LoadingFallback />}>
                <CompetitionDetail />
              </Suspense>
            ),
          },
          {
            path: "competitions/:competitionId/edit",
            element: (
              <Suspense fallback={<LoadingFallback />}>
                <CompetitionEditor />
              </Suspense>
            ),
          },
          {
            path: "stories",
            element: (
              <Suspense fallback={<LoadingFallback />}>
                <AllStories />
              </Suspense>
            ),
          },
          {
            path: "community",
            element: (
              <Suspense fallback={<LoadingFallback />}>
                <Home />
              </Suspense>
            ),
          },
          {
            path: "book-clubs",
            element: (
              <Suspense fallback={<LoadingFallback />}>
                <BookClubs />
              </Suspense>
            ),
          },
        ],
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
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <BookClubDetails />
          </Suspense>
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
            <CompleteSignup />
          </Suspense>
        ),
      },
      {
        path: "/create/:storyId",
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <PrivateRoute />
          </Suspense>
        ),
        children: [
          {
            index: true,
            element: (
              <Suspense fallback={<LoadingFallback />}>
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
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <UserStories />
          </Suspense>
        ),
      },
      {
        path: "/story/:id",
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <StoryDetail />
          </Suspense>
        ),
      },
      {
        path: "/try",
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <DemoEditorPage />
          </Suspense>
        ),
        children: [
          {
            index: true,
            element: (
              <Suspense fallback={<LoadingFallback />}>
                <DemoEditorIndex />
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
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <SEOProvider>
    <QueryClientProvider client={appQueryClient}>
      <Web3Provider>
        <AuthBootstrap />
        <RouterProvider router={router} />
        <ThemeToaster />
      </Web3Provider>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  </SEOProvider>,
);
