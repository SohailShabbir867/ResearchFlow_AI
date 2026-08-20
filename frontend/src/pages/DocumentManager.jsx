import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { 
  Microscope, 
  Users, 
  FileText, 
  MessageSquare, 
  Settings, 
  HeartPulse, 
  BarChart3, 
  ArrowLeft, 
  UploadCloud, 
  X, 
  Search, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  File, 
  ShieldCheck, 
  FolderOpen,
  Filter,
  ArrowUpDown,
  Tag,
  Menu
} from "lucide-react";
import AdminSidebar from "../components/layout/AdminSidebar.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";

const SPECIALTY_OPTIONS = [
  "Cardiology",
  "Endocrinology",
  "Oncology",
  "Neurology",
  "Pulmonology",
  "Pharmacology"
];

const INDEXING_STAGES = [
  { label: "Uploading file...", pct: 20 },
  { label: "Splitting into chunks...", pct: 40 },
  { label: "Creating vector embeddings...", pct: 60 },
  { label: "Storing in Qdrant vector database...", pct: 80 },
  { label: "Rebuilding BM25 hybrid index...", pct: 100 }
];

export default function DocumentManager() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // State Management
  const [mobileOpen, setMobileOpen] = useState(false);
  const [docs, setDocs] = useState([]);

  // Drag & File Selected State
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedTags, setSelectedTags] = useState(["Cardiology"]);

  // Upload & Progress State
  const [uploading, setUploading] = useState(false);
  const [currentStageIdx, setCurrentStageIdx] = useState(0);
  const [progressPct, setProgressPct] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [uploadError, setUploadError] = useState("");

  // Table Filter & Delete State
  const [searchQuery, setSearchQuery] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("All");
  const [deleteConfirmDoc, setDeleteConfirmDoc] = useState(null);

  // Load live documents from backend
  const loadDocs = async () => {
    try {
      const res = await axios.get("/api/admin/documents");
      const docNames = res.data.documents || [];
      const totalChunks = res.data.total_chunks || 0;
      const formatted = docNames.map((name, i) => ({
        id: "doc_" + i,
        filename: name,
        ext: name.split(".").pop().toUpperCase(),
        specialty: "General",
        chunks: docNames.length ? Math.round(totalChunks / docNames.length) : 0,
        size: "Indexed",
        dateAdded: "Active",
        uploader: "Admin"
      }));
      setDocs(formatted);
    } catch (err) {
      console.error("Failed to load documents:", err.message);
    }
  };

  useEffect(() => {
    loadDocs();
  }, []);

  // Handle File Selection
  const handleFileSelect = (file) => {
    if (!file) return;
    const allowedExts = [".pdf", ".txt", ".docx"];
    const ext = "." + file.name.split(".").pop().toLowerCase();
    
    if (!allowedExts.includes(ext)) {
      setUploadError("Invalid file type. Only PDF, TXT, and DOCX files are allowed.");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setUploadError("File size exceeds maximum limit of 50MB.");
      return;
    }

    setSelectedFile(file);
    setUploadError("");
    setUploadSuccess(null);
  };

  // Toggle Specialty Tag Multiselect
  const toggleTag = (tag) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag) 
        : [...prev, tag]
    );
  };

  // Real Upload & Indexing to Backend
  const handleStartIndexing = async () => {
    if (!selectedFile || uploading) return;

    setUploading(true);
    setCurrentStageIdx(0);
    setProgressPct(20);
    setUploadError("");
    setUploadSuccess(null);

    const formData = new FormData();
    formData.append("file", selectedFile);
    if (selectedTags.length > 0) {
      formData.append("specialties", selectedTags.join(","));
    }

    try {
      setCurrentStageIdx(2);
      setProgressPct(60);

      const res = await axios.post("/api/admin/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 300000,
      });

      setCurrentStageIdx(4);
      setProgressPct(100);
      setUploadSuccess(`Successfully indexed "${selectedFile.name}" with ${res.data.chunks_created || 0} vector chunks!`);
      setSelectedFile(null);
      loadDocs();
    } catch (err) {
      console.error("Upload error:", err);
      setUploadError(err.response?.data?.error || err.response?.data?.detail || err.message || "Indexing failed.");
    } finally {
      setUploading(false);
    }
  };

  // Handle Document Delete from Backend
  const handleDeleteDoc = async (doc) => {
    if (!doc) return;
    try {
      await axios.delete("/api/admin/documents/" + encodeURIComponent(doc.filename));
      setDeleteConfirmDoc(null);
      loadDocs();
    } catch (err) {
      alert("Failed to delete document: " + (err.response?.data?.error || err.message));
    }
  };

  // Filtered Documents
  const filteredDocs = docs.filter(d => {
    const matchesSearch = d.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          d.specialty.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSpecialty = specialtyFilter === "All" || d.specialty.includes(specialtyFilter);
    return matchesSearch && matchesSpecialty;
  });

  // Total Chunks Calculation
  const totalChunks = docs.reduce((acc, d) => acc + d.chunks, 0);

  // File Type Icon Helper
  const getFileIcon = (ext) => {
    switch (ext) {
      case "PDF":
        return (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0 shadow-sm"
            style={{ background: "var(--brand-primary)" }}
          >
            PDF
          </div>
        );
      case "DOCX":
        return (
          <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-500/40 text-blue-400 flex items-center justify-center text-[10px] font-bold shrink-0">
            DOCX
          </div>
        );
      case "TXT":
        return (
          <div className="w-8 h-8 rounded-lg bg-emerald-600/30 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-[10px] font-bold shrink-0">
            TXT
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-lg bg-gray-700/50 border border-gray-600 text-gray-300 flex items-center justify-center text-[10px] font-bold shrink-0">
            FILE
          </div>
        );
    }
  };

  return (
    <div className="admin-ui flex h-screen w-full font-sans antialiased overflow-hidden" style={{ background: "var(--bg-page)", color: "var(--text-primary)" }}>
      

      {/* Shared Admin Sidebar with working React Router navigation */}
      <AdminSidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />


      {/* ── MAIN CONTENT AREA ── */}
      <main className="flex-1 flex flex-col h-full relative overflow-y-auto p-4 sm:p-6 lg:p-8" style={{ background: "var(--bg-page)", color: "var(--text-primary)" }}>
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-colors"
              title="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-[24px] font-bold text-white tracking-tight">
                Document Manager
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                {docs.length} documents · {totalChunks.toLocaleString()} total chunks
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </div>

        {/* ── UPLOAD SECTION (Glass Card Top of Page) ── */}
        <div className="rounded-2xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.10)] p-6 backdrop-blur-md mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <UploadCloud className="w-5 h-5" style={{ color: "var(--brand-primary)" }} />
              <span>Upload & Index Document</span>
            </h2>
            <span className="text-[11px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Admin Only</span>
            </span>
          </div>

          {/* DROPZONE AREA */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileSelect(e.dataTransfer.files[0]);
              }
            }}
            className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-all duration-200 cursor-pointer ${
              isDragOver 
                ? "border-[var(--brand-primary)] bg-[var(--bg-badge)]" 
                : "border-white/15 bg-white/[0.02] hover:border-white/30"
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.docx"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileSelect(e.target.files[0]);
                }
              }}
            />

            {/* Selected File State */}
            {selectedFile ? (
              <div className="flex items-center gap-4 bg-white/5 border border-white/10 p-4 rounded-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--bg-badge)", color: "var(--brand-primary)" }}>
                  <File className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white truncate">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                  }}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              /* Default Drag & Drop Prompt */
              <div className="text-center">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-md"
                  style={{
                    background: "var(--bg-badge)",
                    border: "1px solid var(--border-color)",
                    color: "var(--brand-primary)",
                  }}
                >
                  <UploadCloud className="w-8 h-8" />
                </div>
                <p className="text-sm font-bold text-white mb-1">
                  Drag and drop a file here
                </p>
                <p className="text-xs text-gray-400 mb-4">
                  PDF · TXT · DOCX · Max 50MB
                </p>
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-gray-200 hover:text-white hover:bg-white/10 transition-all"
                >
                  Browse files
                </button>
              </div>
            )}
          </div>

          {/* Form below dropzone (Appears after file selected) */}
          {selectedFile && (
            <div className="mt-6 space-y-4 animate-fade-in">
              {/* Specialty Tag Multiselect */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-2 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" style={{ color: "var(--brand-primary)" }} />
                  <span>Specialty tag (Multiselect):</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {SPECIALTY_OPTIONS.map(tag => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                          isSelected
                            ? "text-white border-transparent shadow-sm"
                            : "bg-white/5 text-gray-400 border-white/10 hover:text-white hover:bg-white/10"
                        }`}
                        style={isSelected ? { background: "var(--brand-primary)" } : {}}
                      >
                        {isSelected ? `✓ ${tag}` : `+ ${tag}`}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Full Width Index Document Button */}
              <button
                type="button"
                onClick={handleStartIndexing}
                disabled={uploading}
                className="w-full h-[48px] rounded-xl text-white font-semibold text-base shadow-md hover:opacity-95 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
                style={{ background: "var(--brand-primary)" }}
              >
                <span>Index Document</span>
              </button>
            </div>
          )}

          {/* Sequential Upload Progress Bar State */}
          {uploading && (
            <div className="mt-6 pt-4 border-t border-white/10 animate-fade-in">
              <div className="flex items-center justify-between text-xs font-medium mb-1.5">
                <span className="text-gray-300">
                  {INDEXING_STAGES[currentStageIdx]?.label}
                </span>
                <span className={`font-mono font-bold ${progressPct === 100 ? "text-emerald-400" : ""}`} style={progressPct !== 100 ? { color: "var(--brand-primary)" } : {}}>
                  {progressPct}%
                </span>
              </div>

              {/* Thin Progress Bar (1.5px tall) */}
              <div className="w-full h-[1.5px] bg-white/10 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full transition-all duration-500 ${
                    progressPct === 100 ? "bg-emerald-400" : ""
                  }`}
                  style={{ width: `${progressPct}%`, background: progressPct !== 100 ? "var(--brand-primary)" : undefined }}
                />
              </div>

              {/* Amber Warning Note */}
              <p className="text-xs text-amber-400 font-semibold flex items-center gap-1.5 mt-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>⚠ Do not close this page while indexing is in progress</span>
              </p>
            </div>
          )}

          {/* Upload Status Banner Messages */}
          {uploadSuccess && (
            <div className="mt-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{uploadSuccess}</span>
            </div>
          )}

          {uploadError && (
            <div className="mt-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold flex items-center gap-2 animate-fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

        </div>


        {/* ── DOCUMENT TABLE BELOW UPLOAD SECTION ── */}
        <div className="rounded-2xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.10)] backdrop-blur-md overflow-hidden shadow-xl mb-8">
          
          {/* Table Header Filter & Search */}
          <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/[0.02]">
            <div className="relative flex-1 w-full max-w-md">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents by name or specialty..."
                className="w-full h-10 pl-10 pr-4 text-sm text-white bg-white/5 border border-white/10 rounded-xl outline-none focus:border-[#E21B70] transition-all"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select
                value={specialtyFilter}
                onChange={(e) => setSpecialtyFilter(e.target.value)}
                className="h-10 px-3 text-xs text-gray-200 bg-[#160E2E] border border-white/10 rounded-xl outline-none focus:border-[#E21B70] transition-all cursor-pointer"
              >
                <option value="All">All Specialties</option>
                <option value="Cardiology">Cardiology</option>
                <option value="Endocrinology">Endocrinology</option>
                <option value="Oncology">Oncology</option>
                <option value="Neurology">Neurology</option>
                <option value="Microbiology">Microbiology</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-white/[0.02]">
                  <th className="py-4 px-5">Format</th>
                  <th className="py-4 px-5">Filename</th>
                  <th className="py-4 px-5">Specialty</th>
                  <th className="py-4 px-5">Chunks</th>
                  <th className="py-4 px-5">Size</th>
                  <th className="py-4 px-5">Date Added</th>
                  <th className="py-4 px-5">Uploaded by</th>
                  <th className="py-4 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs text-gray-200">
                {filteredDocs.map((doc, idx) => {
                  const isDeleting = deleteConfirmDoc?.id === doc.id;

                  return (
                    <React.Fragment key={doc.id}>
                      <tr className={`hover:bg-white/[0.03] transition-colors ${
                        idx % 2 === 0 ? "bg-transparent" : "bg-white/[0.02]"
                      }`}>
                        
                        {/* File Format Icon */}
                        <td className="py-4 px-5">
                          {getFileIcon(doc.ext)}
                        </td>

                        {/* Filename */}
                        <td className="py-4 px-5 font-bold text-white max-w-xs truncate">
                          {doc.filename}
                        </td>

                        {/* Specialty */}
                        <td className="py-4 px-5">
                          <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-white/5 border border-white/10 text-gray-300">
                            {doc.specialty}
                          </span>
                        </td>

                        {/* Chunks */}
                        <td className="py-4 px-5 font-mono text-white font-semibold">
                          {doc.chunks} vectors
                        </td>

                        {/* Size */}
                        <td className="py-4 px-5 text-gray-400">
                          {doc.size}
                        </td>

                        {/* Date Added */}
                        <td className="py-4 px-5 text-gray-400">
                          {doc.dateAdded}
                        </td>

                        {/* Uploaded by */}
                        <td className="py-4 px-5 text-gray-300 font-medium">
                          {doc.uploader}
                        </td>

                        {/* Delete Action Button */}
                        <td className="py-4 px-5 text-right">
                          <button
                            onClick={() => setDeleteConfirmDoc(doc)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors border border-white/5 hover:border-red-500/20"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>

                      {/* Inline Delete Confirmation Popover / Banner */}
                      {isDeleting && (
                        <tr className="bg-red-500/10 border-t border-b border-red-500/30">
                          <td colSpan={8} className="p-4">
                            <div className="flex items-center justify-between max-w-3xl mx-auto">
                              <div className="flex items-center gap-3">
                                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                                <div>
                                  <p className="text-sm font-bold text-white">
                                    Delete {doc.filename}?
                                  </p>
                                  <p className="text-xs text-red-200">
                                    This will remove all {doc.chunks} vector embeddings from Qdrant and rebuild the search index.
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setDeleteConfirmDoc(null)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleDeleteDoc(doc)}
                                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm"
                                >
                                  Delete permanently
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}
