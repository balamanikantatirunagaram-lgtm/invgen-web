/** Toast bus: `toast(msg)` notifies mounted <Toaster/> instances. */

type Listener = (msg: string) => void;

const listeners = new Set<Listener>();

export function toast(msg: string): void {
  for (const l of listeners) l(msg);
}

export function subscribeToast(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
