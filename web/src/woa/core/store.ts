/** Oturumların yüklenmesi ve otomatik kaydı.
 *
 *  Not alanları her tuş vuruşunda state'i günceller, IndexedDB'ye yazma
 *  gecikmelidir (400 ms). Bileşen sökülürken bekleyen yazma boşa gitmesin
 *  diye son hâl bir ref'te tutulup temizlikte kaydedilir.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { db } from "./db";
import type { WoaSession } from "./types";

const SAVE_DELAY = 400;

export function useSessions() {
  const [sessions, setSessions] = useState<WoaSession[] | null>(null);

  const refresh = useCallback(async () => {
    const rows = await db.sessions.orderBy("updatedAt").reverse().toArray();
    setSessions(rows);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const remove = useCallback(async (id: string) => {
    await db.sessions.delete(id);
    await refresh();
  }, [refresh]);

  return { sessions, refresh, remove };
}

export function useSession(id: string | undefined) {
  const [session, setSession] = useState<WoaSession | null>(null);
  const [loading, setLoading] = useState(true);
  const dirty = useRef(false);
  const latest = useRef<WoaSession | null>(null);
  latest.current = session;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      const found = id ? await db.sessions.get(id) : undefined;
      if (!alive) return;
      dirty.current = false;
      setSession(found ?? null);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [id]);

  useEffect(() => {
    if (!session || !dirty.current) return;
    const handle = setTimeout(() => {
      void db.sessions.put(session);
      dirty.current = false;
    }, SAVE_DELAY);
    return () => clearTimeout(handle);
  }, [session]);

  // Sökülürken bekleyen yazmayı tamamla.
  useEffect(() => () => {
    if (dirty.current && latest.current) void db.sessions.put(latest.current);
  }, []);

  const update = useCallback((fn: (s: WoaSession) => WoaSession) => {
    setSession((prev) => {
      if (!prev) return prev;
      dirty.current = true;
      return { ...fn(prev), updatedAt: Date.now() };
    });
  }, []);

  /** Bekleyen yazmayı hemen diske indirir — rapora geçmeden önce çağrılır. */
  const flush = useCallback(async () => {
    if (latest.current && dirty.current) {
      await db.sessions.put(latest.current);
      dirty.current = false;
    }
  }, []);

  return { session, loading, update, flush };
}

export async function saveNew(session: WoaSession): Promise<WoaSession> {
  await db.sessions.put(session);
  return session;
}
