import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useLocation } from "react-router-dom";
import { fetchChats, createChat, loadChat, deleteChat } from "../../store/researchSlice.js";
import Avatar from "../ui/Avatar.jsx";

const NAV = [
  { icon: "🔬", label: "Research Chat", path: "/" },
  { icon: "📚", label: "Document Library", path: "/documents" },
];

function timeAgo(date) {
  const diff = (Date.now() - new Date(date)) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff/86400)}d ago`;
  return new Date(date).toLocaleDateString("en", { month:"short", day:"numeric" });
}

export default function Sidebar({ collapsed, onToggle }) {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const location  = useLocation();
  const { chatList, currentChatId } = useSelector(s => s.research);
  const [hovered, setHovered] = useState(null);

  const user = { name: "Dr. Sarah Khan", role: "Doctor", specialty: "Cardiology" };

  return (
    <aside className={`sidebar transition-all duration-300 ${collapsed ? "w-16" : "w-72"} h-screen flex-shrink-0`}>

      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/5">
        <div className="w-8 h-8 rounded-xl bg-gradient-primary flex items-center justify-center shrink-0 glow-sm">
          <span className="text-base">🔬</span>
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">MedResearch AI</p>
            <p className="text-[10px] text-gray-500 font-mono">v2.1 · RAG</p>
          </div>
        )}
        <button onClick={onToggle}
                className="w-7 h-7 rounded-lg flex items-center justify-center
                           text-gray-500 hover:text-white hover:bg-white/5 transition-colors">
          {collapsed ? "→" : "←"}
        </button>
      </div>

      {/* Nav links */}
      <div className="py-3">
        {NAV.map(n => {
          const active = location.pathname === n.path;
          return (
            <button key={n.path}
                    onClick={() => navigate(n.path)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium
                                transition-all duration-150 mx-0 rounded-xl
                                ${active
                                  ? "text-white bg-gradient-to-r from-[#E21B70]/20 to-[#A53860]/10 border-l-2 border-[#E21B70]"
                                  : "text-gray-400 hover:text-white hover:bg-white/5"}`}>
              <span className="text-base shrink-0">{n.icon}</span>
              {!collapsed && <span className="truncate">{n.label}</span>}
            </button>
          );
        })}
      </div>

      {!collapsed && (
        <>
          {/* New chat button */}
          <div className="px-3 pb-3">
            <button onClick={() => dispatch(createChat("New Chat"))}
                    className="w-full btn-primary flex items-center justify-center gap-2 py-2.5">
              <span className="text-lg leading-none">+</span>
              <span>New Chat</span>
            </button>
          </div>

          <div className="divider mx-4 my-0"/>

          {/* Chat list */}
          <div className="flex-1 overflow-y-auto sidebar-scroll px-2 py-2 space-y-0.5">
            <p className="section-title px-2 pt-1">Recent Chats</p>
            {chatList.length === 0 && (
              <p className="text-xs text-gray-600 px-2 py-4 text-center">No chats yet</p>
            )}
            {chatList.map(c => (
              <div key={c._id}
                   onMouseEnter={() => setHovered(c._id)}
                   onMouseLeave={() => setHovered(null)}
                   onClick={() => { dispatch(loadChat(c._id)); navigate("/"); }}
                   className={`group flex items-center justify-between px-3 py-2.5 rounded-xl
                               cursor-pointer transition-all duration-150 ${
                     c._id === currentChatId
                       ? "bg-[#E21B70]/15 border border-[#E21B70]/25 text-white"
                       : "text-gray-400 hover:text-white hover:bg-white/5"}`}>
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="text-sm shrink-0">💬</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{c.title || "New Chat"}</p>
                    <p className="text-[10px] text-gray-600 mt-0.5">{timeAgo(c.updatedAt)}</p>
                  </div>
                </div>
                {hovered === c._id && (
                  <button onClick={e => { e.stopPropagation(); dispatch(deleteChat(c._id)); }}
                          className="text-gray-600 hover:text-red-400 transition-colors p-1 rounded ml-1">
                    🗑
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* User footer */}
      <div className="border-t border-white/5 p-3 mt-auto shrink-0">
        <div className={`flex items-center gap-3 p-2 rounded-xl hover:bg-white/5
                         cursor-pointer transition-colors ${collapsed ? "justify-center" : ""}`}>
          <Avatar name={user.name} size="sm"/>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user.name}</p>
              <p className="text-[10px] text-gray-500 truncate">{user.role} · {user.specialty}</p>
            </div>
          )}
          {!collapsed && (
            <button className="text-gray-600 hover:text-gray-300 transition-colors"
                    onClick={() => navigate("/profile")}>
              ⚙
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
