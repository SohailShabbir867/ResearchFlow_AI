import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  Microscope,
  MessageSquare,
  Library,
  Plus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  User,
  Settings,
  Clock,
  X,
  ShieldCheck,
} from "lucide-react";
import { createChat, deleteChat, loadChat, clearMessages } from "../../store/researchSlice.js";
import { logoutUser } from "../../store/authSlice.js";
import ThemeToggle from "../ThemeToggle.jsx";

// Helper: format relative time
function relativeTime(date) {
  if (!date) return "";
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

// Helper: group chats by date
function groupChats(chatList) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const groups = { Today: [], Yesterday: [], "This Week": [], Older: [] };

  chatList.forEach(chat => {
    const d = new Date(chat.updatedAt || chat.createdAt);
    if (d >= today) groups.Today.push(chat);
    else if (d >= yesterday) groups.Yesterday.push(chat);
    else if (d >= new Date(today.getTime() - 6 * 86400000)) groups["This Week"].push(chat);
    else groups.Older.push(chat);
  });

  return groups;
}

export default function Sidebar({ mobileOpen, onMobileClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();

  const { chatList, currentChatId } = useSelector(s => s.research);
  const user = useSelector(s => s.auth.user);

  const [collapsed, setCollapsed] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [creating, setCreating] = useState(false);

  const isActive = (path) => location.pathname === path;

  async function handleNewChat() {
    setCreating(true);
    try {
      const result = await dispatch(createChat("New Chat")).unwrap();
      navigate("/");
      dispatch(loadChat(result._id));
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  }

  async function handleSelectChat(chatId) {
    if (chatId === currentChatId) return;
    dispatch(loadChat(chatId));
    navigate("/");
    if (onMobileClose) onMobileClose();
  }

  async function handleDeleteChat(e, chatId) {
    e.stopPropagation();
    setDeletingId(chatId);
    try {
      await dispatch(deleteChat(chatId)).unwrap();
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingId(null);
    }
  }

  function handleLogout() {
    dispatch(logoutUser());
    navigate("/login");
  }

  const groups = groupChats(chatList);
  const userInitials = user?.name
    ? user.name.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase()
    : "??";

  const sidebarContent = (
    <div
      className="sidebar flex flex-col h-full"
      style={{ width: collapsed ? "64px" : "280px", transition: "width 0.2s ease" }}
    >
      {/* ── Logo + Collapse ── */}
      <div className="flex items-center justify-between px-4 h-16 shrink-0" style={{ borderBottom: "1px solid var(--border-color-subtle)" }}>
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--brand-primary)", boxShadow: "0 0 12px var(--brand-glow)" }}>
              <Microscope className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>ResearchFlow AI</span>
              <span className="text-[10px] block font-medium uppercase tracking-widest" style={{ color: "var(--brand-primary)" }}>AI Research Assistant</span>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto" style={{ background: "var(--brand-primary)" }}>
            <Microscope className="w-4 h-4 text-white" />
          </div>
        )}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--text-muted)" }}
            title="Collapse sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="absolute left-14 top-5 w-6 h-6 rounded-full flex items-center justify-center border z-10"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-muted)" }}
            title="Expand sidebar"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* ── New Chat Button ── */}
      <div className="px-3 pt-4 pb-2 shrink-0">
        <button
          onClick={handleNewChat}
          disabled={creating}
          className="btn-primary w-full flex items-center gap-2 justify-center"
          style={collapsed ? { padding: "0.625rem", justifyContent: "center" } : {}}
        >
          <Plus className="w-4 h-4 shrink-0" />
          {!collapsed && <span>{creating ? "Creating..." : "New Chat"}</span>}
        </button>
      </div>

      {/* ── Nav Links ── */}
      <div className="px-2 pb-2 shrink-0">
        <button
          onClick={() => { navigate("/"); if (onMobileClose) onMobileClose(); }}
          className={isActive("/") ? "sidebar-item-active w-full" : "sidebar-item w-full"}
        >
          <MessageSquare className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Research Chat</span>}
        </button>
        {user?.role === "admin" && (
          <button
            onClick={() => { navigate("/documents"); if (onMobileClose) onMobileClose(); }}
            className={isActive("/documents") ? "sidebar-item-active w-full" : "sidebar-item w-full"}
          >
            <Library className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Document Library</span>}
          </button>
        )}

        {/* Admin Panel — only visible to admin users */}
        {user?.role === "admin" && (
          <>
            {!collapsed && (
              <div className="mx-1 my-1.5 h-px" style={{ background: "linear-gradient(to right, transparent, rgba(142,78,20,0.3), transparent)" }} />
            )}
            <button
              onClick={() => { navigate("/admin"); if (onMobileClose) onMobileClose(); }}
              className={isActive("/admin") ? "sidebar-item-active w-full" : "sidebar-item w-full"}
              title="Admin Dashboard"
            >
              <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: "var(--brand-primary)" }} />
              {!collapsed && (
                <span className="flex-1 text-left">
                  Admin Panel
                </span>
              )}
              {!collapsed && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(142,78,20,0.12)", color: "var(--brand-primary)", border: "1px solid rgba(142,78,20,0.25)" }}>
                  ADMIN
                </span>
              )}
            </button>
          </>
        )}
      </div>

      {/* ── Chat History ── */}
      {!collapsed && (
        <>
          <div className="divider mx-4" />
          <div className="px-4 pb-1 shrink-0">
            <span className="section-title flex items-center gap-1.5">
              <Clock className="w-3 h-3" /> Recent Chats
            </span>
          </div>
          <div className="flex-1 overflow-y-auto sidebar-scroll px-2 pb-2">
            {chatList.length === 0 && (
              <p className="text-xs px-3 py-4 text-center" style={{ color: "var(--text-muted)" }}>
                No chats yet. Start a new conversation!
              </p>
            )}
            {Object.entries(groups).map(([group, chats]) =>
              chats.length === 0 ? null : (
                <div key={group} className="mb-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider px-3 mb-1" style={{ color: "var(--text-muted)" }}>{group}</p>
                  {chats.map(chat => (
                    <div
                      key={chat._id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectChat(chat._id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleSelectChat(chat._id);
                        }
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-all duration-150 group relative ${
                        chat._id === currentChatId
                          ? "sidebar-item-active"
                          : "sidebar-item"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate flex-1 font-medium">{chat.title || "Untitled"}</span>
                        <span className="text-[10px] shrink-0 opacity-60">{relativeTime(chat.updatedAt)}</span>
                      </div>
                      {chat.lastMessage && (
                        <p className="text-[11px] truncate mt-0.5 opacity-60">{chat.lastMessage}</p>
                      )}
                      {/* Delete on hover */}
                      <button
                        onClick={(e) => handleDeleteChat(e, chat._id)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-500/20 hover:text-red-400 transition-all"
                        title="Delete chat"
                        disabled={deletingId === chat._id}
                      >
                        {deletingId === chat._id
                          ? <span className="text-[10px]">…</span>
                          : <Trash2 className="w-3 h-3" />
                        }
                      </button>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </>
      )}

      {/* ── Footer: User + Actions ── */}
      <div className="shrink-0 px-3 pb-4 pt-2" style={{ borderTop: "1px solid var(--border-color-subtle)" }}>
        {!collapsed ? (
          <div className="flex items-center gap-2">
            {/* Avatar */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
              style={{ background: "var(--brand-primary)" }}
            >
              {userInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>{user?.name || "User"}</p>
              <p className="text-[10px] capitalize" style={{ color: "var(--text-muted)" }}>{user?.role || "viewer"}</p>
            </div>
            <ThemeToggle />
            <button
              onClick={() => { navigate("/profile"); if (onMobileClose) onMobileClose(); }}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: "var(--text-muted)" }}
              title="Profile & Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: "var(--brand-primary)" }}
            >
              {userInitials}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex h-full shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 z-40 lg:hidden"
            onClick={onMobileClose}
          />
          {/* Drawer */}
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden" style={{ width: "280px" }}>
            <div className="relative h-full">
              {sidebarContent}
              <button
                onClick={onMobileClose}
                className="absolute top-4 right-4 p-1.5 rounded-lg"
                style={{ color: "var(--text-muted)", background: "var(--bg-card)" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
