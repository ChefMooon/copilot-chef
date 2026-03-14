"use client";

import * as Toast from "@radix-ui/react-toast";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
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
};

type ToastContextValue = {
  toast: (input: {
    title: string;
    description?: string;
    variant?: ToastVariant;
  }) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback(
    (input: {
      title: string;
      description?: string;
      variant?: ToastVariant;
    }) => {
      setItems((current) => [
        ...current,
        {
          id: Date.now() + Math.floor(Math.random() * 1000),
          title: input.title,
          description: input.description,
          variant: input.variant ?? "default",
        },
      ]);
    },
    []
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      <Toast.Provider swipeDirection="right">
        {children}
        {items.map((item) => (
          <Toast.Root
            className={cn(
              "grid w-[min(360px,calc(100vw-2rem))] gap-1 rounded-card border bg-white px-4 py-3 shadow-lg",
              item.variant === "error"
                ? "border-red-200 text-red-900"
                : "border-green/10 text-text"
            )}
            duration={3200}
            key={item.id}
            onOpenChange={(open) => {
              if (!open) {
                setItems((current) =>
                  current.filter((entry) => entry.id !== item.id)
                );
              }
            }}
            open
          >
            <Toast.Title className="text-sm font-bold">
              {item.title}
            </Toast.Title>
            {item.description ? (
              <Toast.Description className="text-sm text-text-muted">
                {item.description}
              </Toast.Description>
            ) : null}
          </Toast.Root>
        ))}
        <Toast.Viewport className="fixed bottom-4 right-4 z-[100] flex max-w-full flex-col gap-3 outline-none" />
      </Toast.Provider>
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
