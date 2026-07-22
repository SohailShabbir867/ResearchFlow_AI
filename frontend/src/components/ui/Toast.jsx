import { useState, useEffect, createContext, useContext, useCallback } from "react";

const ToastContext = createContext(null);

const icons = {
  success: "✓",
  error:   "✕",
  warning: "⚠",
  info:    "ℹ",
};

const styles = {
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  error:   "border-red-500/30 bg-red-500/10 text-red-300",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  info:    "border-blue-500/30 bg-blue-500/10 text-blue-300",
};

function ToastItem({ id, type = "info", message, onRemove }) {
  useEffect(() => {
    const t = setTimeout(() => onRemove(id), type === "error" ? 6000 : 3500);
    return () => clearTimeout(t);
  }, [id, type, onRemove]);

  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border
                     backdrop-blur-md glass-card min-w-[280px] max-w-[360px]
                     animate-fade-in ${styles[type]}`}>
      <span className="text-lg leading-none mt-0.5 shrink-0">{icons[type]}</span>
      <p className="text-sm font-medium text-gray-100 flex-1">{message}</p>
      <button onClick={() => onRemove(id)}
              className="text-gray-500 hover:text-gray-300 text-lg leading-none shrink-0">
        ×
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const remove = useCallback(id => setToasts(p => p.filter(t => t.id !== id)), []);
  const add = useCallback((message, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, message, type }]);
  }, []);

  return (
    <ToastContext.Provider value={{ add }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map(t => <ToastItem key={t.id} {...t} onRemove={remove}/>)}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
