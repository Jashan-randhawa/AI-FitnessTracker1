import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import BottomNav from "../components/BottomNav";

const Layout = () => {
  const location = useLocation();
  const isChat =
    location.pathname === "/ai" ||
    location.pathname === "/ai-assistant" ||
    location.pathname.startsWith("/ai");

  return (
    <div
      className={`layout-container ${
        isChat ? "h-[100dvh] max-h-[100dvh] overflow-hidden" : ""
      }`}
    >
      <Sidebar />
      <main
        className={`${
          isChat
            ? "chat-main-container"
            : "flex-1 min-w-0 overflow-y-auto pb-18 lg:pb-0"
        } no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden`}
      >
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
};

export default Layout;
