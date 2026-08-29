import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Icons } from "../utils/icons";

type ToastVariant = "success" | "error" | "warning";

type ToastOptions = {
  message: string;
  variant?: ToastVariant;
  persistent?: boolean;
  duration?: number;
};

type ToastItem = {
  id: number;
  message: string;
  variant: ToastVariant;
  persistent: boolean;
  duration: number;
  createdAt: number;
  exiting: boolean;
};

type ToastContextValue = {
  showToast: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;
const MAX_TOASTS = 4;
const DEFAULT_DURATION = 5000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<number, { timer: number; remaining: number; startedAt: number }>>(new Map());

  const clearTimer = useCallback((id: number) => {
    const entry = timersRef.current.get(id);
    if (entry) {
      clearTimeout(entry.timer);
      timersRef.current.delete(id);
    }
  }, []);

  const startTimer = useCallback((id: number, duration: number) => {
    clearTimer(id);
    const timer = window.setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        timersRef.current.delete(id);
      }, 200);
    }, duration);
    timersRef.current.set(id, { timer, remaining: duration, startedAt: Date.now() });
  }, [clearTimer]);

  const pauseTimer = useCallback((id: number) => {
    const entry = timersRef.current.get(id);
    if (entry) {
      clearTimeout(entry.timer);
      const elapsed = Date.now() - entry.startedAt;
      const remaining = Math.max(0, entry.remaining - elapsed);
      timersRef.current.set(id, { timer: 0, remaining, startedAt: 0 });
    }
  }, []);

  const resumeTimer = useCallback((id: number) => {
    const entry = timersRef.current.get(id);
    if (entry && entry.remaining > 0) {
      const timer = window.setTimeout(() => {
        setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
          timersRef.current.delete(id);
        }, 200);
      }, entry.remaining);
      timersRef.current.set(id, { timer, remaining: entry.remaining, startedAt: Date.now() });
    }
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "success") => {
      const id = nextId++;
      const toast: ToastItem = {
        id,
        message,
        variant,
        persistent: false,
        duration: DEFAULT_DURATION,
        createdAt: Date.now(),
        exiting: false,
      };

      setToasts((prev) => {
        let next = [...prev, toast];
        if (next.length > MAX_TOASTS) {
          const removable = next.findIndex((t) => !t.persistent);
          if (removable !== -1) {
            next.splice(removable, 1);
          } else {
            next.shift();
          }
        }
        return next;
      });

      startTimer(id, DEFAULT_DURATION);
    },
    [startTimer],
  );

  const dismissToast = useCallback((id: number) => {
    clearTimer(id);
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 200);
  }, [clearTimer]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((entry) => clearTimeout(entry.timer));
      timersRef.current.clear();
    };
  }, []);

  const variantIcon = {
    success: Icons.Success,
    error: Icons.Error,
    warning: Icons.Warning,
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="toast-queue"
        role="status"
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map((toast) => {
          const Icon = variantIcon[toast.variant];
          return (
            <div
              key={toast.id}
              className={`toast-queue__toast toast-queue__toast--${toast.variant}${toast.exiting ? " toast-queue__toast--exiting" : ""}`}
              onMouseEnter={() => pauseTimer(toast.id)}
              onMouseLeave={() => resumeTimer(toast.id)}
              onFocus={() => pauseTimer(toast.id)}
              onBlur={() => resumeTimer(toast.id)}
            >
              <span className="toast-queue__icon">
                <Icon size={18} />
              </span>
              <span className="toast-queue__message">{toast.message}</span>
              <button
                className="toast-queue__close"
                onClick={() => dismissToast(toast.id)}
                aria-label={`Dismiss notification: ${toast.message}`}
              >
                <Icons.Close size={16} />
              </button>
              {!toast.persistent && !toast.exiting && (
                <span className="toast-queue__progress" />
              )}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
