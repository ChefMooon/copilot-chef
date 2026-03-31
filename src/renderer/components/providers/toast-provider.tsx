"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

import { cn } from "@/lib/utils";

type ToastVariant = "default" | "error";

type ToastItem = {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
  action?: {
    label: string;
    onClick: () => void | Promise<void>;
  };
};

type ToastContextValue = {
  toast: (input: {
    title: string;
    description?: string;
    variant?: ToastVariant;
    duration?: number;
    action?: {
      label: string;
      onClick: () => void | Promise<void>;
    };
  }) => void;
  dismissAll: () => void;
  setDragging: (isDragging: boolean) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }

    setItems((current) => current.filter((entry) => entry.id !== id));
  }, []);

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) {
        clearTimeout(timer);
      }
      timersRef.current.clear();
    };
  }, []);

  const toast = useCallback(
    (input: {
      title: string;
      description?: string;
      variant?: ToastVariant;
      duration?: number;
      action?: {
        label: string;
        onClick: () => void | Promise<void>;
      };
    }) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      const duration = input.duration ?? 3200;

      setItems((current) => [
        ...current,
        {
          id,
          title: input.title,
          description: input.description,
          variant: input.variant ?? "default",
          duration,
          action: input.action,
        },
      ]);

      const timer = setTimeout(() => {
        removeToast(id);
      }, duration);
      timersRef.current.set(id, timer);
    },
    [removeToast]
  );

  const dismissAll = useCallback(() => {
    for (const timer of timersRef.current.values()) {
      clearTimeout(timer);
    }
    timersRef.current.clear();
    setItems([]);
  }, []);

  const setDragging = useCallback((dragging: boolean) => {
    setIsDragging(dragging);
  }, []);

  const value = useMemo(
    () => ({ toast, dismissAll, setDragging }),
    [toast, dismissAll, setDragging]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className={cn(
          "fixed left-4 z-[600] flex max-w-full flex-col gap-3 outline-none transition-all duration-200",
          isDragging ? "bottom-24" : "bottom-4"
        )}
        role="region"
      >
        {items.map((item) => (
          <div
            className={cn(
              "relative grid w-[min(360px,calc(100vw-2rem))] gap-1 rounded-card border bg-white px-4 py-3 pr-10 shadow-lg",
              item.variant === "error"
                ? "border-red-200 text-red-900"
                : "border-green/10 text-text"
            )}
            data-duration={item.duration}
            key={item.id}
            role="status"
          >
            <button
              aria-label="Close toast"
              className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded text-text-muted transition-colors hover:bg-black/5 hover:text-text"
              onClick={() => {
                removeToast(item.id);
              }}
              type="button"
            >
              x
            </button>
            <p className="text-sm font-bold">{item.title}</p>
            {item.description ? (
              <p className="text-sm text-text-muted">{item.description}</p>
            ) : null}
            {item.action ? (
              <button
                className="relative mt-1 inline-flex h-8 min-w-20 items-center justify-center overflow-hidden rounded-md border border-green/35 bg-green-pale px-2.5 text-xs font-bold text-green transition-colors hover:bg-green hover:text-white"
                onClick={() => {
                  removeToast(item.id);
                  void item.action?.onClick();
                }}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-0 left-0 h-0.5 w-full origin-left scale-x-0 bg-green/45"
                  style={{
                    animation: `toast-progress-fill ${item.duration}ms linear forwards`,
                  }}
                />
                <span className="relative z-10 text-center">{item.action.label}</span>
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }

  return context;
}
