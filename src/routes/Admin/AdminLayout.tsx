import { NavLink, Outlet } from "react-router-dom";

export default function AdminLayout() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 font-ui text-ns-ink sm:px-8 sm:py-12">
      <nav
        aria-label="Admin sections"
        className="mb-8 flex gap-6 border-b border-ns-border"
      >
        {[
          { to: "/admin/stories", label: "Stories" },
          { to: "/admin/competitions", label: "Competitions" },
          { to: "/admin/members", label: "Members" },
          { to: "/admin/ai-usage", label: "AI usage" },
        ].map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `border-b-2 pb-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent ${isActive ? "border-ns-accent text-ns-accent" : "border-transparent text-ns-ink-secondary hover:text-ns-ink"}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
