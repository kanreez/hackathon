import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Runs an async function and tracks loading / error / data.
 *
 *   const { data, loading, error, reload } = useAsync(() => listItems(), []);
 *
 * `deps` works like useEffect's dependency list: the function re-runs when they change.
 * Call reload() for pull-to-refresh or after saving.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  const run = useCallback(async (mode: "load" | "refresh" = "load") => {
    if (mode === "refresh") setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setData(await fnRef.current());
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return {
    data,
    setData,
    loading,
    refreshing,
    error,
    reload: () => run("load"),
    refresh: () => run("refresh"),
  };
}
