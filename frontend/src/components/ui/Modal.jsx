import { useEffect } from "react";

export default function Modal({ open, onClose, title, children, width = "max-w-lg" }) {
  useEffect(() => {
    const handler = e => { if (e.key === "Escape") onClose(); };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"
           onClick={onClose}/>

      {/* Panel */}
      <div className={`relative w-full ${width} glass-card shadow-modal
                       animate-fade-in rounded-2xl overflow-hidden`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5
                        border-b border-white/5">
          <h2 className="text-base font-bold text-white">{title}</h2>
          <button onClick={onClose}
                  className="w-8 h-8 rounded-lg flex items-center justify-center
                             text-gray-400 hover:text-white hover:bg-white/10
                             transition-colors text-xl leading-none">
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
