import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchChats,
  createChat,
  fetchChatDetails,
  deleteChat
} from "../store/researchSlice.js";
import ChatBox from "../components/ChatBox.jsx";

export default function Research() {
  const dispatch = useDispatch();
  const { chats, currentChatId } = useSelector((s) => s.research);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Load chat sessions on mount
  useEffect(() => {
    dispatch(fetchChats());
  }, [dispatch]);

  // Load details whenever active chat changes
  useEffect(() => {
    if (currentChatId) {
      dispatch(fetchChatDetails(currentChatId));
    }
  }, [currentChatId, dispatch]);

  const handleNewChat = () => {
    dispatch(createChat("New Chat"));
  };

  const handleDeleteChat = (e, id) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this chat session?")) {
      dispatch(deleteChat(id));
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* ── Sidebar (Previous Chats Section) ── */}
      <aside
        className={`bg-gray-900 text-gray-100 flex flex-col transition-all duration-300 z-20 shrink-0 border-r border-gray-800 ${
          isSidebarOpen ? "w-72" : "w-0 overflow-hidden border-none"
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔬</span>
            <span className="font-bold text-sm tracking-wide text-white uppercase">History</span>
          </div>
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white text-xs font-semibold
                       px-3 py-2 rounded-xl transition-all shadow-md shadow-primary/20 hover:scale-[1.02]"
          >
            <span>+</span> New Chat
          </button>
        </div>

        {/* Previous Chats List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {chats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center px-4">
              <span className="text-2xl text-gray-600 mb-2">💬</span>
              <p className="text-xs text-gray-500">No previous chats.</p>
              <button
                onClick={handleNewChat}
                className="text-xs text-primary font-medium hover:underline mt-1"
              >
                Create one now
              </button>
            </div>
          ) : (
            chats.map((c) => {
              const isActive = c._id === currentChatId;
              return (
                <div
                  key={c._id}
                  onClick={() => dispatch(fetchChatDetails(c._id))}
                  className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer
                             transition-all ${
                               isActive
                                 ? "bg-primary text-white"
                                 : "hover:bg-gray-800 text-gray-300 hover:text-white"
                             }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="text-sm shrink-0">💬</span>
                    <span className="text-xs font-medium truncate leading-none">
                      {c.title || "New Chat"}
                    </span>
                  </div>
                  <button
                    onClick={(e) => handleDeleteChat(e, c._id)}
                    className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-1 rounded transition-opacity shrink-0 ml-1"
                    title="Delete Chat"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-gray-800 text-center shrink-0">
          <p className="text-[10px] text-gray-500 font-mono">MedResearch Local DB v2.0</p>
        </div>
      </aside>

      {/* ── Main Chat Area ── */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-100 px-6 py-4 shadow-sm z-10 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Sidebar Toggler Button */}
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-primary transition-colors"
                title={isSidebarOpen ? "Hide History" : "Show History"}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 6h16M4 12h8m-8 6h16" />
                </svg>
              </button>

              {/* Logo & Info */}
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-dark
                                flex items-center justify-center shadow-md shadow-primary/20 shrink-0">
                  <span className="text-white text-base font-bold">🔬</span>
                </div>
                <div>
                  <h1 className="text-sm font-bold text-gray-900 leading-tight">
                    MedResearch AI
                  </h1>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <p className="text-[10px] text-gray-400 font-semibold tracking-wide uppercase">
                      FastEmbed + Qdrant &middot; Groq LLaMA 70B &middot; MongoDB
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-medium bg-gray-50 border border-gray-100 px-2.5 py-1.5 rounded-lg">
                MongoDB Local
              </span>
            </div>
          </div>
        </header>

        {/* ChatBox View */}
        <main className="flex-1 overflow-hidden bg-white">
          <ChatBox />
        </main>
      </div>
    </div>
  );
}
