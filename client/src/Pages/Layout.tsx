import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import BottomNav from "../components/BottomNav";

const Layout = () => {
  return (
    <div className="layout-container">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto pb-18 lg:pb-0">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
};

export default Layout;
