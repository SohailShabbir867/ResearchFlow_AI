import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { 
  Microscope, 
  Plus, 
  Search, 
  LayoutGrid, 
  List, 
  FileText, 
  FileType, 
  ChevronLeft, 
  ChevronRight, 
  Settings, 
  ArrowRight, 
  FolderOpen,
  X,
  Database,
  Calendar,
  Layers,
  ShieldCheck,
  BookOpen,
  Menu
} from "lucide-react";
import ThemeToggle from "../components/ThemeToggle.jsx";

export default function Documents() {
  const navigate = useNavigate();

  // Component State Management
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [viewMode, setViewMode] = useState("grid"); // "grid" or "list"
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("All Specialties");
  const [sortBy, setSortBy] = useState("Date Added");
  
  // UI Display States
  const [loading, setLoading] = useState(true);
  const [forceEmpty, setForceEmpty] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [documentsList, setDocumentsList] = useState([]);

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        setLoading(true);
        const res = await axios.get("/api/admin/documents");
        const docNames = res.data.documents || [];
        const totalChunks = res.data.total_chunks || 0;
        const formatted = docNames.map((name, i) => ({
          id: "doc_" + i,
          filename: name,
          ext: name.split(".").pop().toUpperCase(),
          specialty: "General",
          chunks: docNames.length ? Math.round(totalChunks / docNames.length) : 0,
          dateAdded: "Indexed",
          fileSize: "Active",
          description: `Medical research document indexed in Qdrant hybrid search vector store.`
        }));
        setDocumentsList(formatted);
      } catch (err) {
        console.error("Failed to load documents:", err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchDocs();
  }, []);

  // Filter & Sort Logic
  const filteredDocuments = documentsList.filter(doc => {
    const matchesSearch = doc.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          doc.specialty.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSpecialty = selectedSpecialty === "All Specialties" || doc.specialty === selectedSpecialty;
    return matchesSearch && matchesSpecialty;
  }).sort((a, b) => {
    if (sortBy === "Filename A-Z") return a.filename.localeCompare(b.filename);
    if (sortBy === "Chunk Count") return b.chunks - a.chunks;
    return 0; // Default: Date Added
  });

  const displayList = forceEmpty ? [] : filteredDocuments;

  // Helper for Specialty Pill Badge styling
  const getSpecialtyBadgeStyle = (specialty) => {
    switch (specialty) {
      case "Cardiology":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "Endocrinology":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "Oncology":
        return "bg-[var(--bg-badge)] text-[var(--brand-primary)] border-[var(--border-color)]";
      case "Neurology":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "Pulmonology":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "Microbiology":
        return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
      default:
        return "bg-gray-500/20 text-gray-300 border-gray-500/30";
    }
  };

  // Helper for File Type Badge styling
  const getFileTypeIcon = (ext) => {
    switch (ext) {
      case "PDF":
        return (
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-md"
            style={{ background: "var(--brand-primary)" }}
          >
            PDF
          </div>
        );
      case "DOCX":
        return (
          <div className="w-12 h-12 rounded-xl bg-blue-600/30 border border-blue-500/40 text-blue-400 flex items-center justify-center font-bold text-xs shadow-md">
            DOCX
          </div>
        );
      case "TXT":
        return (
          <div className="w-12 h-12 rounded-xl bg-emerald-600/30 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold text-xs shadow-md">
            TXT
          </div>
        );
      default:
        return (
          <div className="w-12 h-12 rounded-xl bg-gray-700/50 border border-gray-600 text-gray-300 flex items-center justify-center font-bold text-xs">
            FILE
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen w-full font-sans antialiased overflow-hidden" style={{ background: "var(--bg-page)", color: "var(--text-primary)" }}>
      
      {/* Mobile Sidebar Backdrop Overlay */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      {/* ── LEFT SIDEBAR (280px, dark #0A0614) ── */}
      <aside 
        className={`bg-[#0A0614] border-r border-white/10 flex flex-col justify-between transition-all duration-300 z-50 shrink-0 fixed lg:static inset-y-0 left-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } ${sidebarCollapsed ? "w-16" : "w-[280px]"}`}
      >
        {/* Top Header */}
        <div className="p-4 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm"
              style={{ background: "var(--brand-primary)" }}
            >
              <Microscope className="w-5 h-5 stroke-[2.2]" />
            </div>
            {!sidebarCollapsed && (
              <span className="font-bold text-white text-base tracking-tight truncate">
                ResearchAI
              </span>
            )}
          </div>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          <button
            onClick={() => navigate("/")}
            className={`w-full h-11 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-md transition-all duration-200 ${
              sidebarCollapsed ? "px-0" : "px-4"
            }`}
            style={{ background: "var(--brand-primary)" }}
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
            {!sidebarCollapsed && <span>New Chat</span>}
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <button
            onClick={() => navigate("/")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all ${
              sidebarCollapsed ? "justify-center" : ""
            }`}
          >
            <BookOpen className="w-4 h-4" />
            {!sidebarCollapsed && <span>Research Chat</span>}
          </button>

          {/* Document Library Item (ACTIVE HIGHLIGHTED) */}
          <button
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-white shadow-sm transition-all ${
              sidebarCollapsed ? "justify-center" : ""
            }`}
            style={{ background: "var(--bg-badge)", borderLeft: "3px solid var(--brand-primary)" }}
          >
            <FolderOpen className="w-4 h-4" style={{ color: "var(--brand-primary)" }} />
            {!sidebarCollapsed && <span className="font-semibold">Document Library</span>}
          </button>
        </div>

        {/* User Footer */}
        <div className="p-3 border-t border-white/10 bg-[#0A0614]">
          <div className={`flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer ${
            sidebarCollapsed ? "justify-center" : ""
          }`}>
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-md"
              style={{ background: "var(--brand-primary)" }}
            >
              SS
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">Sohail Shabbir</p>
                <p className="text-[10px] text-gray-400 truncate">Admin · Doctor</p>
              </div>
            )}
            {!sidebarCollapsed && (
              <button className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
                <Settings className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT AREA (background #0F0A1E) ── */}
      <main className="flex-1 flex flex-col h-full bg-[#0F0A1E] relative overflow-y-auto p-6 lg:p-8">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-colors"
              title="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-[24px] font-bold text-white tracking-tight">
                Document Library
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                47 documents indexed — last updated Jul 12, 2025
              </p>
            </div>
          </div>

          {/* Top-Right: Grid / List View Toggle & Theme Toggle Buttons */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 p-1 rounded-xl">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded-lg text-xs font-medium transition-all ${
                viewMode === "grid" 
                  ? "text-white shadow-sm" 
                  : "text-gray-400 hover:text-white"
              }`}
              style={viewMode === "grid" ? { background: "var(--brand-primary)" } : {}}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-lg text-xs font-medium transition-all ${
                viewMode === "list" 
                  ? "text-white shadow-sm" 
                  : "text-gray-400 hover:text-white"
              }`}
              style={viewMode === "list" ? { background: "var(--brand-primary)" } : {}}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

        {/* Filter Bar */}
        <div className="flex flex-col md:flex-row items-center gap-4 mb-8">
          
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents..."
              className="w-full h-11 pl-10 pr-4 text-sm text-white bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.10)] rounded-xl outline-none focus:border-[#E21B70] transition-all"
            />
          </div>

          {/* Specialty Dropdown */}
          <div className="w-full md:w-56">
            <select
              value={selectedSpecialty}
              onChange={(e) => setSelectedSpecialty(e.target.value)}
              className="w-full h-11 px-4 text-sm text-gray-200 bg-[#160E2E] border border-[rgba(255,255,255,0.10)] rounded-xl outline-none focus:border-[#E21B70] transition-all cursor-pointer"
            >
              <option value="All Specialties">All Specialties</option>
              <option value="Cardiology">Cardiology</option>
              <option value="Endocrinology">Endocrinology</option>
              <option value="Oncology">Oncology</option>
              <option value="Neurology">Neurology</option>
              <option value="Pulmonology">Pulmonology</option>
              <option value="Microbiology">Microbiology</option>
            </select>
          </div>

          {/* Sort Dropdown */}
          <div className="w-full md:w-48">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full h-11 px-4 text-sm text-gray-200 bg-[#160E2E] border border-[rgba(255,255,255,0.10)] rounded-xl outline-none focus:border-[#E21B70] transition-all cursor-pointer"
            >
              <option value="Date Added">Date Added</option>
              <option value="Filename A-Z">Filename A-Z</option>
              <option value="Chunk Count">Chunk Count</option>
            </select>
          </div>

          {/* Demo Testing Toggles */}
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setLoading(!loading)}
              className="h-11 px-3 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-400 hover:text-white transition-colors"
            >
              {loading ? "Hide Skeleton" : "Simulate Loading"}
            </button>
            <button
              onClick={() => setForceEmpty(!forceEmpty)}
              className="h-11 px-3 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-400 hover:text-white transition-colors"
            >
              {forceEmpty ? "Show Docs" : "Simulate Empty"}
            </button>
          </div>
        </div>

        {/* ── LOADING SKELETON STATE (8 cards) ── */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-64 rounded-2xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.10)] p-5 flex flex-col justify-between animate-pulse"
              >
                <div className="w-12 h-12 rounded-xl bg-white/10 mx-auto mb-4" />
                <div className="h-4 bg-white/10 rounded w-3/4 mb-2" />
                <div className="h-4 bg-white/10 rounded w-1/2 mb-4" />
                <div className="h-6 bg-white/10 rounded-full w-24 mb-4" />
                <div className="h-3 bg-white/10 rounded w-1/3 mb-1" />
                <div className="h-3 bg-white/10 rounded w-1/4" />
              </div>
            ))}
          </div>
        )}

        {/* ── EMPTY STATE (When no documents match or zero documents) ── */}
        {!loading && displayList.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 border border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center mb-4 shadow-md"
              style={{ background: "var(--bg-badge)", border: "1px solid var(--border-color)", color: "var(--brand-primary)" }}
            >
              <FolderOpen className="w-10 h-10 stroke-[1.8]" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              No documents indexed yet
            </h3>
            <p className="text-gray-400 text-sm max-w-md">
              Contact your administrator to add medical documents to the system.
            </p>
          </div>
        )}

        {/* ── DOCUMENT GRID VIEW (4 Columns Responsive) ── */}
        {!loading && displayList.length > 0 && viewMode === "grid" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {displayList.map(doc => (
              <div
                key={doc.id}
                onClick={() => setSelectedDoc(doc)}
                className="rounded-2xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.10)] p-5 backdrop-blur-md relative group hover:border-[#E21B70] hover:-translate-y-1 hover:shadow-xl hover:shadow-[#E21B70]/10 transition-all duration-200 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  {/* File Type Icon at Top Center */}
                  <div className="flex justify-center mb-3">
                    {getFileTypeIcon(doc.ext)}
                  </div>

                  {/* Document Filename Bold 13px 2-line truncation */}
                  <h3 className="font-bold text-[13px] text-white line-clamp-2 leading-snug mb-3 text-center group-hover:text-pink-100 transition-colors">
                    {doc.filename}
                  </h3>

                  {/* Specialty Tag Badge */}
                  <div className="flex justify-center mb-3">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${getSpecialtyBadgeStyle(doc.specialty)}`}>
                      {doc.specialty}
                    </span>
                  </div>
                </div>

                {/* Footer Meta */}
                <div className="pt-3 border-t border-white/5 flex flex-col items-center">
                  <span className="text-[11px] text-gray-400 font-medium">
                    {doc.chunks} chunks indexed
                  </span>
                  <span className="text-[11px] text-gray-500 mt-0.5">
                    Added {doc.dateAdded}
                  </span>

                  {/* View Details Button on Hover */}
                  <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity text-xs font-semibold flex items-center gap-1" style={{ color: "var(--brand-primary)" }}>
                    <span>View details</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── DOCUMENT LIST VIEW ── */}
        {!loading && displayList.length > 0 && viewMode === "list" && (
          <div className="rounded-2xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.10)] overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-white/[0.02]">
                  <th className="py-3.5 px-4">Filename</th>
                  <th className="py-3.5 px-4">Format</th>
                  <th className="py-3.5 px-4">Specialty</th>
                  <th className="py-3.5 px-4">Chunks</th>
                  <th className="py-3.5 px-4">Date Added</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs text-gray-200">
                {displayList.map(doc => (
                  <tr
                    key={doc.id}
                    onClick={() => setSelectedDoc(doc)}
                    className="hover:bg-white/[0.04] transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-4 font-semibold text-white">
                      {doc.filename}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-white/10 text-gray-300 font-mono text-[10px]">
                        {doc.ext}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${getSpecialtyBadgeStyle(doc.specialty)}`}>
                        {doc.specialty}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-300">
                      {doc.chunks} chunks
                    </td>
                    <td className="py-3.5 px-4 text-gray-400">
                      {doc.dateAdded}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button className="text-xs hover:underline font-semibold" style={{ color: "var(--brand-primary)" }}>
                        View details →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── DOCUMENT DETAILS MODAL ── */}
        {selectedDoc && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-2xl bg-[#140E26] border border-white/10 p-6 relative shadow-2xl animate-fade-in">
              <button
                onClick={() => setSelectedDoc(null)}
                className="absolute right-4 top-4 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-4 mb-4">
                {getFileTypeIcon(selectedDoc.ext)}
                <div>
                  <h3 className="text-lg font-bold text-white leading-snug">
                    {selectedDoc.filename}
                  </h3>
                  <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getSpecialtyBadgeStyle(selectedDoc.specialty)}`}>
                    {selectedDoc.specialty}
                  </span>
                </div>
              </div>

              <p className="text-sm text-gray-300 mb-6 leading-relaxed">
                {selectedDoc.description}
              </p>

              <div className="grid grid-cols-2 gap-3 mb-6 p-4 rounded-xl bg-white/5 border border-white/10 text-xs">
                <div>
                  <span className="text-gray-500 block mb-0.5">Vector Chunks</span>
                  <span className="font-bold text-white text-sm">{selectedDoc.chunks} Indexed</span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">File Size</span>
                  <span className="font-bold text-white text-sm">{selectedDoc.fileSize}</span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">Date Added</span>
                  <span className="font-bold text-white text-sm">{selectedDoc.dateAdded}</span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">Access Scope</span>
                  <span className="font-semibold text-emerald-400 text-sm">Read-Only</span>
                </div>
              </div>

              <button
                onClick={() => setSelectedDoc(null)}
                className="w-full py-2.5 rounded-xl text-white text-sm font-semibold transition-colors cursor-pointer"
                style={{ background: "var(--brand-primary)" }}
              >
                Close Details
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
