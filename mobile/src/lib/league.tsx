/** Lig anahtarı (NFL / NCAA).
 *
 *  Web'de üst çubukta iki ayrı rota ağacı var (`/` ve `/ncaa`). Telefonda
 *  ikinci bir sekme takımı taşımak yerine aynı beş sekme lige göre içerik
 *  değiştiriyor; seçim başlıktaki anahtarla yapılıyor ve kalıcı.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from "react";

export type League = "nfl" | "ncaa";

const STORAGE_KEY = "statgrade.league";

interface LeagueValue {
  league: League;
  setLeague: (l: League) => void;
}

const LeagueContext = createContext<LeagueValue | null>(null);

export function LeagueProvider({ children }: { children: ReactNode }) {
  const [league, setLeagueState] = useState<League>("nfl");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v === "nfl" || v === "ncaa") setLeagueState(v);
    });
  }, []);

  const setLeague = useCallback((l: League) => {
    setLeagueState(l);
    void AsyncStorage.setItem(STORAGE_KEY, l);
  }, []);

  const value = useMemo(() => ({ league, setLeague }), [league, setLeague]);
  return <LeagueContext.Provider value={value}>{children}</LeagueContext.Provider>;
}

export function useLeague(): LeagueValue {
  const ctx = useContext(LeagueContext);
  if (!ctx) return { league: "nfl", setLeague: () => {} };
  return ctx;
}
