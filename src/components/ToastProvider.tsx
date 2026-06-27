"use client";

// ───────────────────────────────────────────────────────────────
// ToastProvider — app-wide, non-blocking feedback (success/error/info).
// Toasts are announced to assistive tech via an aria-live region.
// ───────────────────────────────────────────────────────────────

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type ToastKind = "success" | "error" | "info";

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  /** optional action, e.g. a "Top up" link */
  action?: { label: string; href?: string; onClick?: () => void };
  duration?: number; // ms; 0 = sticky
}

interface ToastContextValue {
  toast: (t: Omit<Toast, "id">) => void;
  success: (message: string, action?: Toast["action"]) => void;
  error: (message: string, action?: Toast["action"]) => void;
  info: (message: string, action?: Toast["action"]) => void;
  dismiss: (id: number) => void;
}

const Ctx = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = ++idRef.current;
      const next: Toast = { id, duration: 4500, ...t };
      setToasts((ts) => [...ts.slice(-3), next]); // keep at most 4
      if (next.duration && next.duration > 0) {
        setTimeout(() => dismiss(id), next.duration);
      }
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (message, action) => toast({ kind: "success", message, action }),
      error: (message, action) => toast({ kind: "error", message, action, duration: 7000 }),
      info: (message, action) => toast({ kind: "info", message, action }),
      dismiss,
    }),
    [toast, dismiss]
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const Icon = toast.kind === "success" ? CheckCircle2 : toast.kind === "error" ? AlertTriangle : Info;
  const tone =
    toast.kind === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : toast.kind === "error"
      ? "border-red-200 bg-red-50 text-red-900"
      : "border-ink-100 bg-paper text-ink-900";

  return (
    <motion.div
      role="status"
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border px-3.5 py-3 shadow-sm ${tone}`}
    >
      <Icon size={18} className="mt-0.5 shrink-0 opacity-80" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="whitespace-pre-line">{toast.message}</p>
        {toast.action && (
          <a
            href={toast.action.href}
            onClick={toast.action.onClick}
            target={toast.action.href ? "_blank" : undefined}
            rel={toast.action.href ? "noreferrer" : undefined}
            className="mt-1 inline-block font-medium underline"
          >
            {toast.action.label}
          </a>
        )}
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="-mr-1 -mt-1 rounded p-1 opacity-50 hover:opacity-100"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}

export function useToast(): ToastContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useToast must be used within <ToastProvider>");
  return v;
}
