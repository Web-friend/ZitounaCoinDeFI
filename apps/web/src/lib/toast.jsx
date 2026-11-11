import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";

const ToastContext = createContext(null);

const TONE = {
  success: { icon: CheckCircle2, className: "border-ok/30 bg-ok-soft text-ok" },
  error: { icon: TriangleAlert, className: "border-rust/30 bg-rust-soft text-rust" },
  info: { icon: Info, className: "border-olive/20 bg-olive-light/70 text-olive-deep" },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (message, tone = "info", options = {}) => {
      const id = nextId.current++;
      const title = typeof message === "string" ? message : message.title;
      const description = typeof message === "string" ? options.description : message.description;
      setToasts((current) => [...current.slice(-3), { id, title, description, tone }]);
      const ttl = options.duration ?? (tone === "error" ? 9_000 : 5_000);
      setTimeout(() => dismiss(id), ttl);
      return id;
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      push,
      success: (message, options) => push(message, "success", options),
      error: (message, options) => push(message, "error", options),
      info: (message, options) => push(message, "info", options),
      dismiss,
    }),
    [dismiss, push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6">
        {toasts.map((toast) => {
          const tone = TONE[toast.tone] ?? TONE.info;
          const Icon = tone.icon;
          return (
            <div
              key={toast.id}
              role="status"
              className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur ${tone.className}`}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug">{toast.title}</p>
                {toast.description ? (
                  <p className="mt-0.5 break-words text-xs opacity-80">{toast.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="rounded p-1 opacity-60 transition hover:opacity-100"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
