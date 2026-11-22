import { useCallback, useEffect, useRef, useState } from "react";
import { getErrorMessage, isCancelled } from "@/services/api";

interface State<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/**
 * Loads data whenever `deps` change. The previous result stays visible while a new
 * request is in flight (`loading` is true, `data` is not null), and stale responses
 * are cancelled so a slow request can never overwrite a newer one.
 */
export function useApi<T>(fetcher: (signal: AbortSignal) => Promise<T>, deps: readonly unknown[]) {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    fetcherRef
      .current(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, error: null, loading: false });
      })
      .catch((err) => {
        if (controller.signal.aborted || isCancelled(err)) return;
        setState((s) => ({ ...s, error: getErrorMessage(err), loading: false }));
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}