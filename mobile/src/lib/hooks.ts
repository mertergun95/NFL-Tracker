import { useCallback, useEffect, useRef, useState } from "react";
import type { LoadOptions } from "./cache";
import { clearMemory } from "./cache";

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/** Web'deki useAsync'in mobil sürümü; ek olarak "reload(force)" verir. */
export function useAsync<T>(
  fn: (o: LoadOptions) => Promise<T>,
  deps: unknown[],
): AsyncState<T> & { reload: (force?: boolean) => Promise<void> } {
  const [state, setState] = useState<AsyncState<T>>({
    data: null, error: null, loading: true,
  });
  const alive = useRef(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async (force = false) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const d = await fnRef.current({ force });
      if (alive.current) setState({ data: d, error: null, loading: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (alive.current) setState({ data: null, error: msg, loading: false });
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void run(false);
    return () => { alive.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, reload: run };
}

/** Aşağı çekerek yenileme: bellek önbelleğini boşaltıp tüm yükleyicileri
 *  "force" ile yeniden çalıştırır. */
export function useRefresh(reloaders: ((force?: boolean) => Promise<void>)[]) {
  const [refreshing, setRefreshing] = useState(false);
  const ref = useRef(reloaders);
  ref.current = reloaders;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    clearMemory();
    try {
      await Promise.all(ref.current.map((r) => r(true)));
    } finally {
      setRefreshing(false);
    }
  }, []);

  return { refreshing, onRefresh };
}

/** Arama kutusu için gecikmeli değer — her tuşta 3000 satır filtrelenmesin. */
export function useDebounced<T>(value: T, delay = 220): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}
