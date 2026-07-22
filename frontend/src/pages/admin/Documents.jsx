import { useState } from "react";
import axios from "axios";
import Badge from "../../components/ui/Badge.jsx";

const MOCK_DOCS = [
  { name:"diabetes_management_ADA_2024.pdf",      specialty:"Endocrinology", chunks:203, size:"4.2MB", date:"Jul 12, 2025", uploader:"Admin" },
  { name:"hypertension_JNC8_guidelines.pdf",       specialty:"Cardiology",    chunks:156, size:"2.8MB", date:"Jul 10, 2025", uploader:"Admin" },
  { name:"oncology_breast_cancer_NCCN.pdf",        specialty:"Oncology",      chunks:389, size:"8.1MB", date:"Jul 8, 2025",  uploader:"Admin" },
  { name:"antibiotic_resistance_WHO_2024.txt",     specialty:"Infectious Dis.",chunks:87,  size:"0.4MB", date:"Jul 5, 2025",  uploader:"Admin" },
  { name:"cardiology_heart_failure_ESC.pdf",       specialty:"Cardiology",    chunks:278, size:"5.9MB", date:"Jul 3, 2025",  uploader:"Admin" },
];

const STAGES = [
  { label:"Uploading file...",               pct:15  },
  { label:"Splitting into chunks...",        pct:30  },
  { label:"Creating vector embeddings...",   pct:65  },
  { label:"Storing in Qdrant...",            pct:90  },
  { label:"Rebuilding BM25 index...",        pct:100 },
];

export default function Documents() {
  const [docs, setDocs]         = useState(MOCK_DOCS);
  const [file, setFile]         = useState(null);
  const [specialty, setSpecialty] = useState("");
  const [uploading, setUploading] = useState(false);
  const [stage, setStage]       = useState(0);
  const [progress, setProg]     = useState(0);
  const [done, setDone]         = useState(null);
  const [error, setError]       = useState("");
  const [drag, setDrag]         = useState(false);

  const handleFile = f => {
    if (!f) return;
    const allowed = [".pdf",".txt",".docx"];
    const ext = "." + f.name.split(".").pop().toLowerCase();
    if (!allowed.includes(ext)) { setError("Only PDF, TXT, DOCX files allowed."); return; }
    setFile(f); setError(""); setDone(null);
  };

  const startUpload = async () => {
    if (!file) return;
    setUploading(true); setStage(0); setProg(0); setDone(null); setError("");

    // Simulate stage progression while uploading
    const form = new FormData();
    form.append("file", file);
    if (specialty) form.append("specialty", specialty);

    const timer = setInterval(() => {
      setStage(s => { if (s < 4) { setProg(STAGES[s+1]?.pct || 100); return s+1; } return s; });
    }, 1200);

    try {
      const res = await axios.post("/api/admin/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 300000
      });
      clearInterval(timer);
      setProg(100); setStage(4);
      setDone(`✅ ${res.data.message}`);
      setDocs(p => [{ name:file.name, specialty:specialty||"General", chunks:res.data.chunks_created,
                      size:`${(file.size/1048576).toFixed(1)}MB`, date:"Just now", uploader:"Admin" }, ...p]);
      setFile(null);
    } catch (err) {
      clearInterval(timer);
      setError(err.response?.data?.error || "Upload failed. Check server logs.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="page-header">
        <div>
          <h1 className="page-title">Document Manager</h1>
          <p className="page-subtitle">{docs.length} documents · {docs.reduce((a,d)=>a+d.chunks,0).toLocaleString()} total chunks</p>
        </div>
      </div>

      {/* Upload zone */}
      <div className="glass-card p-6 mb-6">
        <h3 className="text-sm font-bold text-white mb-4">Upload & Index Document</h3>

        {/* Drop zone */}
        <div onDragOver={e => { e.preventDefault(); setDrag(true); }}
             onDragLeave={() => setDrag(false)}
             onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
             className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200
                         ${drag ? "border-[#E21B70]/60 bg-[#E21B70]/5" : "border-white/10 hover:border-white/20"}`}>
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <span className="text-3xl">📄</span>
              <div className="text-left">
                <p className="text-sm font-semibold text-white">{file.name}</p>
                <p className="text-xs text-gray-500">{(file.size/1048576).toFixed(1)} MB</p>
              </div>
              <button onClick={() => setFile(null)} className="text-gray-500 hover:text-red-400 ml-2">✕</button>
            </div>
          ) : (
            <>
              <span className="text-4xl block mb-3">📤</span>
              <p className="text-sm text-gray-300 mb-1">Drag and drop a file here</p>
              <p className="text-xs text-gray-600 mb-4">PDF · TXT · DOCX · Max 50MB</p>
              <label className="btn-secondary cursor-pointer inline-block">
                Browse files
                <input type="file" accept=".pdf,.txt,.docx" className="hidden"
                       onChange={e => handleFile(e.target.files[0])}/>
              </label>
            </>
          )}
        </div>

        {file && (
          <div className="mt-4 flex gap-3 items-end">
            <div className="flex-1">
              <label className="input-label">Specialty tag (optional)</label>
              <select value={specialty} onChange={e => setSpecialty(e.target.value)} className="input-base">
                <option value="">Select specialty...</option>
                {["Cardiology","Endocrinology","Oncology","Neurology","Infectious Disease",
                  "Pharmacology","Pediatrics","Emergency Medicine","General"].map(s =>
                  <option key={s}>{s}</option>)}
              </select>
            </div>
            <button onClick={startUpload} disabled={uploading} className="btn-primary py-3 px-8">
              {uploading ? "Indexing..." : "Index Document"}
            </button>
          </div>
        )}

        {/* Upload progress */}
        {uploading && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-400">{STAGES[stage]?.label}</p>
              <p className="text-xs text-gray-500 font-mono">{progress}%</p>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-primary rounded-full transition-all duration-700"
                   style={{ width: `${progress}%` }}/>
            </div>
            <p className="text-[10px] text-gray-600 mt-2">
              ⚠ Do not close this page while indexing is in progress
            </p>
          </div>
        )}

        {done  && <p className="text-sm text-emerald-400 mt-3 animate-fade-in">{done}</p>}
        {error && <p className="text-sm text-red-400 mt-3 animate-fade-in">❌ {error}</p>}
      </div>

      {/* Documents table */}
      <div className="table-wrapper overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              {["Document","Specialty","Chunks","Size","Date Added","Uploaded by","Actions"].map(h => (
                <th key={h} className="table-head">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {docs.map((d, i) => (
              <tr key={i} className={`table-row ${i%2===0?"":"bg-white/2"}`}>
                <td className="table-cell">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">
                      {d.name.endsWith(".pdf") ? "📕" : d.name.endsWith(".docx") ? "📘" : "📄"}
                    </span>
                    <p className="text-xs font-medium text-white truncate max-w-[200px]">{d.name}</p>
                  </div>
                </td>
                <td className="table-cell"><Badge variant="ghost">{d.specialty}</Badge></td>
                <td className="table-cell font-mono text-xs text-gray-300">{d.chunks.toLocaleString()}</td>
                <td className="table-cell text-gray-500 text-xs">{d.size}</td>
                <td className="table-cell text-gray-500 text-xs">{d.date}</td>
                <td className="table-cell text-gray-400 text-xs">{d.uploader}</td>
                <td className="table-cell">
                  <button onClick={() => setDocs(p => p.filter((_,j) => j!==i))}
                          className="btn-ghost text-xs hover:text-red-400">🗑 Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
