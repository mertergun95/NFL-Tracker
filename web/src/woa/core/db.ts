import Dexie, { type Table } from "dexie";
import type { WoaSession } from "./types";

/** Analiz oturumları yalnızca cihazda durur — notlar kişiseldir, sunucumuz yok.
 *  Bahis takibinin veritabanından ayrı tutuldu: iki modülün şeması ve sürüm
 *  geçmişi birbirine karışmasın. */
export class WoaDb extends Dexie {
  sessions!: Table<WoaSession, string>;

  constructor(name = "woa") {
    super(name);
    this.version(1).stores({
      sessions: "id, updatedAt, status, gameId",
    });
  }
}

export const db = new WoaDb();
