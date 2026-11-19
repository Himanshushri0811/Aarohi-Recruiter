import React, { createContext, useContext, useState, useCallback } from 'react';
import * as ToastPrimitives from '@radix-ui/react-toast';
import {
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastViewport,
} from './Toast';

export interface ToastItem {
  id: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'success' | 'error' | 'warning' | 'ai' | 'destructive';
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastItem, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const handleOpenChange = (id: string, open: boolean) => {
    if (!open) {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      <ToastPrimitives.Provider swipeDirection="right">
        {children}
        {toasts.map((t) => {
          const mappedVariant = t.variant === 'destructive' ? 'error' : t.variant;
          return (
            <Toast
              key={t.id}
              variant={mappedVariant}
              onOpenChange={(open) => handleOpenChange(t.id, open)}
            >
              <div className="grid gap-1">
                {t.title && <ToastTitle>{t.title}</ToastTitle>}
                {t.description && <ToastDescription>{t.description}</ToastDescription>}
              </div>
              <ToastClose />
            </Toast>
          );
        })}
        <ToastViewport />
      </ToastPrimitives.Provider>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    // Return a fallback so calling showToast without provider doesn't crash
    return {
      showToast: (t) => {
        if (t.variant === 'error' || t.variant === 'destructive') {
          console.error(t.title, t.description);
        } else {
          console.log(t.title, t.description);
        }
      },
    };
  }
  return context;
}
