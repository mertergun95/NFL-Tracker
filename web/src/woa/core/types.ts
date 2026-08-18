/** WoA — analiz oturumunun veri modeli.
 *
 *  Bir oturum tek bir maça aittir. Maç adımları `steps`, oyuncu analizleri
 *  `players[].steps` altında durur; ikisi de aynı `StepState` şeklini kullanır
 *  ki rapor ve ilerleme hesabı tek kod yolundan geçsin.
 */

export type Phase = "game" | "player";

export interface StepState {
  /** Tek notluk adımlar (M8 ve tüm oyuncu adımları). */
  note?: string;
  /** İki notluk maç adımları: deplasman / ev. */
  away?: string;
  home?: string;
  /** Kullanıcı bu adımı bilinçli olarak geçti. */
  skipped?: boolean;
  /** Dış kaynak checklist'i: kaynak id → bakıldı mı. */
  checks?: Record<string, boolean>;
  /** Yapısal alanlar: alan anahtarı → değer (hep dize, biçim serbest). */
  values?: Record<string, string>;
}

export interface PlayerEntry {
  /** Oturum içi kayıt id'si — aynı oyuncu iki kez eklenmesin diye playerId ayrı. */
  id: string;
  playerId: string;
  name: string;
  position: string;
  team: string;
  addedAt: number;
  steps: Record<string, StepState>;
}

export interface WoaSession {
  id: string;
  createdAt: number;
  updatedAt: number;
  finishedAt?: number;
  status: "active" | "done";

  /** Analiz edilen maç. */
  season: number;
  week: number;
  gameId: string;
  away: string;
  home: string;
  gameday?: string;
  gametime?: string;
  /** İstatistiklerin geldiği sezon (projections.data_season) — maç sezonundan farklı. */
  dataSeason: number;

  steps: Record<string, StepState>;
  players: PlayerEntry[];
}

/** Adım durumu: rapor ve stepper aynı üç değeri kullanır. */
export type StepStatus = "empty" | "filled" | "skipped";
