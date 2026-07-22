import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";

// ─── Context ──────────────────────────────────────────────────────────────────
const ToastContext = createContext(null);

const ICONS = {
  success: <CheckCircle className="w-4 h-4 text-emerald-400" />,
  error:   <XCircle    className="w-4 h-4 text-red-400"      />,
  warning: <AlertTriangle className="w-4 h-4 text-amber-400" />,
  info:    <Info       className="w-4 h-4 text-blue-400"     />,
};

const STYLES = {
  success: { border: "1px solid rgba(16,185,129,0.30)",  background: "rgba(16,185,129,0.12)"  },
  error:   { border: "1px solid rgba(239,68,68,0.30)",   background: "rgba(239,68,68,0.12)"   },
  warning: { border: "1px solid rgba(245,158,11,0.30)",  background: "rgba(245,158,11,0.12)"  },
  info:    { border: "1px solid rgba(59,130,246,0.30)",  background: "rgba(59,130,246,0.12)"  },
};

let _id = 0;

// ─── Provider ─────────────────────────────────────────────────────────────────
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const remove = useCallback((id) => {
    clearTimeout(timers.current[id]);
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const add = useCallback((message, type = "info") => {
    const id = ++_id;
    const duration = type === "error" ? 6000 : 3500;

    setToasts(prev => [...prev.slice(-4), { id, message, type }]);

    timers.current[id] = setTimeout(() => remove(id), duration);
    return id;
  }, [remove]);

  return (
    <ToastContext.Provider value={{ add, remove }}>
      {children}

      {/* Toast Container */}
      <div className="toast-container pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg animate-slide-right min-w-[280px] max-w-[380px]"
            style={{
              ...STYLES[toast.type] || STYLES.info,
              backdropFilter: "blur(12px)",
              background: `${(STYLES[toast.type] || STYLES.info).background}, var(--bg-card)`,
            }}
            role="alert"
          >
            <span className="shrink-0 mt-0.5">{ICONS[toast.type]}</span>
            <p className="flex-1 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              {toast.message}
            </p>
            <button
              onClick={() => remove(toast.id)}
              className="shrink-0 p-0.5 rounded hover:opacity-70 transition-opacity"
              style={{ color: "var(--text-muted)" }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Graceful fallback outside provider
    return {
      add: (msg, type) => console.log(`[Toast ${type}]:`, msg),
      remove: () => {},
    };
  }
  return ctx;
}

// Default export for convenience
export default ToastProvider;
