import { useState } from "react";
import axios from "axios";

export default function UploadPDF({ onUploadSuccess }) {
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState(null); // { type: "success"|"error", message }

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowed = [".pdf", ".txt", ".docx"];
    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (!allowed.includes(ext)) {
      setStatus({ type: "error", message: "Only PDF, TXT, DOCX files allowed." });
      return;
    }

    setUploading(true);
    setStatus({ type: "info", message: `Uploading ${file.name}...` });

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await axios.post("/api/research/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 300000  // 5 min for large PDFs
      });

      setStatus({
        type: "success",
        message: `✅ ${res.data.message} (${res.data.chunks_created} chunks)`
      });

      // Notify parent so it can refresh document list if needed
      if (onUploadSuccess) onUploadSuccess(file.name);

    } catch (err) {
      const msg = err.response?.data?.error || "Upload failed. Check server logs.";
      setStatus({ type: "error", message: `❌ ${msg}` });
    } finally {
      setUploading(false);
      // Reset file input so same file can be re-uploaded
      e.target.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className={`
        cursor-pointer inline-flex items-center gap-2 text-xs font-medium
        border border-dashed rounded-lg px-3 py-2 transition-colors
        ${uploading
          ? "border-gray-200 text-gray-400 cursor-not-allowed"
          : "border-primary/40 text-primary hover:border-primary hover:bg-primary/5"
        }
      `}>
        {uploading ? (
          <>
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10"
                stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Indexing...
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload PDF / TXT / DOCX
          </>
        )}
        <input
          type="file"
          accept=".pdf,.txt,.docx"
          onChange={handleFileChange}
          disabled={uploading}
          className="hidden"
        />
      </label>

      {/* Status message */}
      {status && (
        <p className={`text-xs px-1 ${
          status.type === "success" ? "text-green-600" :
          status.type === "error" ? "text-red-500" :
          "text-gray-500"
        }`}>
          {status.message}
        </p>
      )}
    </div>
  );
}
