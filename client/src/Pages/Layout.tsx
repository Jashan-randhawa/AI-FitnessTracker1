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
      className={
        isChat
          ? "h-[100dvh] max-h-[100dvh] min-h-0 w-full flex flex-col lg:flex-row bg-white dark:bg-slate-950 transition-colors duration-200 overflow-hidden"
          : "layout-container"
      }
    >
      <Sidebar />
      <main
        className={`${
          isChat
            ? "flex-1 min-w-0 flex flex-col h-full overflow-hidden"
            : "flex-1 min-w-0 overflow-y-auto pb-18 lg:pb-0"
        } no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden`}
      >
        <Outlet />
      </main>
      {!isChat && <BottomNav />}
    </div>
  );
};

export default Layout;
