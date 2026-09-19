import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";
import { useAuthContext } from "./contexts/AuthContext";

export const NavbarWrapper = () => {
  const location = useLocation();
  const { user } = useAuthContext();
  const isEditorPage = location.pathname.startsWith("/create");
  const isReaderPage = location.pathname.startsWith("/story");
  const isPublicHome = location.pathname === "/" && !user;
  const isAuthPage =
    location.pathname.startsWith("/sign-in") ||
    location.pathname.startsWith("/sign-up") ||
    location.pathname.startsWith("/forgot-password");

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-ns-bg">
      {/* Editor is a focused, full-height workspace — hide the navbar there and
          let users navigate away with the browser back button. */}
      {!isEditorPage && !isPublicHome && <Navbar />}

      <main
        className={`w-full h-full bg-ns-bg ${
          isEditorPage || isAuthPage ? "overflow-hidden" : "overflow-y-auto"
        }`}
      >
        <Outlet />
      </main>

      {!isEditorPage && !isReaderPage && !isPublicHome && <Footer />}
    </div>
  );
};
