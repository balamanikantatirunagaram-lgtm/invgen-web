import { useEffect, useState } from 'react';
import { subscribeToast } from './toastBus';

/** Renders toasts fired via `toast(msg)` from toastBus. Mount once in AppShell. */
export function Toaster() {
  const [items, setItems] = useState<{ id: number; msg: string }[]>([]);

  useEffect(() => {
    return subscribeToast((msg: string) => {
      const id = Date.now() + Math.random();
      setItems((prev) => [...prev.slice(-2), { id, msg }]);
      setTimeout(() => {
        setItems((prev) => prev.filter((i) => i.id !== id));
      }, 4000);
    });
  }, []);

  if (items.length === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] space-y-2 w-max max-w-[90vw]">
      {items.map((i) => (
        <div
          key={i.id}
          className="bg-ink text-surface text-sm font-medium px-5 py-3 rounded-xl shadow-xl"
        >
          {i.msg}
        </div>
      ))}
    </div>
  );
}
