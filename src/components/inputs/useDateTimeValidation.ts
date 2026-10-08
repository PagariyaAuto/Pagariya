import { useCallback, useRef } from "react";

/** Retain rejected edits until corrected; callers keep their existing popup. */
export default function useDateTimeValidation() {
  const errors = useRef(new Map<string, string>());
  const callbacks = useRef(new Map<string, (error: string | null) => void>());
  const field = useCallback((key: string) => {
    if (!callbacks.current.has(key)) {
      callbacks.current.set(key, error => {
        if (error) errors.current.set(key, error);
        else errors.current.delete(key);
      });
    }
    return callbacks.current.get(key)!;
  }, []);
  const getError = useCallback(() => errors.current.values().next().value as string | undefined, []);
  return { field, getError };
}
