import { Outlet, NavLink, Link } from "react-router-dom";
import { BookOpen, Layers, Users, MapPin, ArrowLeft } from "lucide-react";
import { useParams } from "react-router-dom";
import { StoryWorkspaceTabs } from "./components/StoryWorkspaceTabs";

const NAV_ITEMS = [
  { label: "Editor", path: "", icon: BookOpen, end: true },
  { label: "Plot", path: "plot", icon: Layers, end: false },
  { label: "Characters", path: "characters", icon: Users, end: false },
  { label: "Places", path: "places", icon: MapPin, end: false },
] as const;

const Story = () => {
  const { storyId } = useParams<{ storyId: string }>();

  return (
    <div className="flex h-full bg-ns-bg overflow-hidden">
      <nav className="hidden lg:flex flex-shrink-0 w-44 bg-ns-surface border-r border-ns-border flex-col pt-4 pb-4 px-2 gap-0.5">
        <Link
          to="/user-stories"
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-ns font-ui text-sm text-ns-ink-secondary hover:bg-ns-surface-hover hover:text-ns-ink transition-all duration-150"
        >
          <ArrowLeft className="w-4 h-4 flex-shrink-0" />
          <span>My Stories</span>
        </Link>
        <div className="my-1.5 mx-3 h-px bg-ns-border" />
        {NAV_ITEMS.map(({ label, path, icon: Icon, end }) => (
          <NavLink
            key={label}
            to={path}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2.5 rounded-ns font-ui text-sm transition-all duration-150 ${
                isActive
                  ? "bg-ns-accent-subtle text-ns-accent font-medium"
                  : "text-ns-ink-secondary hover:bg-ns-surface-hover hover:text-ns-ink"
              }`
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="flex-1 overflow-hidden min-w-0 flex flex-col">
        <StoryWorkspaceTabs
          basePath="/create"
          storyId={storyId}
          className="lg:hidden"
        />
        <main className="h-full overflow-hidden min-h-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Story;
