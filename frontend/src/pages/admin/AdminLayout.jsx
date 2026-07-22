import { Outlet } from "react-router-dom";
import AdminSidebar from "../../components/layout/AdminSidebar.jsx";

export default function AdminLayout() {
  return (
    <div className="flex h-screen bg-[#0F0A1E] overflow-hidden">
      <AdminSidebar/>
      <main className="flex-1 overflow-y-auto">
        <Outlet/>
      </main>
    </div>
  );
}
