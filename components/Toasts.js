'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertIcon, CheckIcon, CloseIcon, InfoIcon } from './icons';

const ToastContext = createContext(() => {});
export const useNotify = () => useContext(ToastContext);

const TONE = {
  error: { icon: AlertIcon, cls: 'text-bad' },
  warn: { icon: AlertIcon, cls: 'text-warn' },
  success: { icon: CheckIcon, cls: 'text-good' },
  info: { icon: InfoIcon, cls: 'text-accent' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const notify = useCallback(
    ({ tone = 'info', title, body, duration = 5200 }) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((t) => [...t.slice(-2), { id, tone, title, body }]);
      timers.current[id] = setTimeout(() => dismiss(id), duration);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] sm:items-end lg:pb-4"
        role="region"
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map((t) => {
          const { icon: Icon, cls } = TONE[t.tone] || TONE.info;
          return (
            <div
              key={t.id}
              className="animate-rise pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-line-strong bg-raised/95 px-3.5 py-3 shadow-2xl shadow-black/50 backdrop-blur"
            >
              <Icon className={`mt-0.5 shrink-0 ${cls}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-ink">{t.title}</p>
                {t.body && <p className="mt-0.5 whitespace-pre-line text-[12.5px] leading-snug text-muted">{t.body}</p>}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="-mr-1 rounded-md p-1 text-faint transition hover:bg-hover hover:text-ink"
                aria-label="Dismiss"
              >
                <CloseIcon size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
