/** Disk önbelleği.
 *
 * Sezon dosyaları 5 MB'a kadar çıkıyor; AsyncStorage bu boyutta güvenilir
 * değil (Android'de toplam kota sınırlı). Bu yüzden ham JSON metni cache
 * dizinine dosya olarak yazılır. Kural:
 *
 *  1. Bellekte varsa oradan ver (aynı oturumda tekrar ayrıştırma yok).
 *  2. Diskte taze kopya varsa onu ver, ağa çıkma.
 *  3. Aksi halde indir, diske yaz.
 *  4. Ağ yoksa bayat kopyayı ver — uçakta da açılsın.
 */
import { Directory, File, Paths } from "expo-file-system";
import { CACHE_TTL_MS, DATA_URL, FETCH_TIMEOUT_MS } from "./config";

const DIR_NAME = "statgrade-data";
const memory = new Map<string, unknown>();

/** Kaynağın en son ne zaman (ve nereden) geldiği — "Veri tazeliği" satırı. */
export interface Freshness {
  fetchedAt: number | null;
  fromCache: boolean;
}
const freshness = new Map<string, Freshness>();
export const freshnessOf = (path: string): Freshness | undefined => freshness.get(path);

function cacheDir(): Directory {
  const dir = new Directory(Paths.cache, DIR_NAME);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** "seasons/2025/player_weeks.json" -> "seasons_2025_player_weeks.json" */
const fileNameFor = (path: string) => path.replace(/[^a-zA-Z0-9._-]/g, "_");

function cacheFile(path: string): File {
  return new File(cacheDir(), fileNameFor(path));
}

function readDisk(path: string): { text: string; age: number } | null {
  try {
    const f = cacheFile(path);
    if (!f.exists) return null;
    const mtime = f.modificationTime;
    return {
      text: f.textSync(),
      age: mtime ? Date.now() - mtime * (mtime < 1e12 ? 1000 : 1) : Infinity,
    };
  } catch {
    return null;
  }
}

function writeDisk(path: string, text: string): void {
  try {
    const f = cacheFile(path);
    f.create({ intermediates: true, overwrite: true });
    f.write(text);
  } catch {
    // Disk dolu olabilir; önbellek olmaması ölümcül değil.
  }
}

async function download(path: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${DATA_URL}/${path}`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export interface LoadOptions {
  /** true ise önbellek atlanır (aşağı çekerek yenileme). */
  force?: boolean;
}

/** Bir JSON kaynağını getirir; önbellek ve çevrimdışı geri dönüşle. */
export async function getJson<T>(path: string, opts: LoadOptions = {}): Promise<T> {
  if (!opts.force && memory.has(path)) return memory.get(path) as T;

  const disk = opts.force ? null : readDisk(path);
  if (disk && disk.age < CACHE_TTL_MS) {
    const parsed = JSON.parse(disk.text) as T;
    memory.set(path, parsed);
    freshness.set(path, { fetchedAt: Date.now() - disk.age, fromCache: true });
    return parsed;
  }

  try {
    const text = await download(path);
    const parsed = JSON.parse(text) as T;
    memory.set(path, parsed);
    freshness.set(path, { fetchedAt: Date.now(), fromCache: false });
    writeDisk(path, text);
    return parsed;
  } catch (err) {
    // Ağ yok: bayat da olsa diskteki kopya, hiç veri olmamasından iyidir.
    const stale = disk ?? readDisk(path);
    if (stale) {
      const parsed = JSON.parse(stale.text) as T;
      memory.set(path, parsed);
      freshness.set(path, { fetchedAt: Date.now() - stale.age, fromCache: true });
      return parsed;
    }
    throw err;
  }
}

/** Bellek önbelleğini boşaltır (yenile hareketi). */
export function clearMemory(): void {
  memory.clear();
}

/** Disk önbelleğini siler — Ayarlar ekranındaki "önbelleği temizle". */
export function clearDisk(): void {
  try {
    const dir = new Directory(Paths.cache, DIR_NAME);
    if (dir.exists) dir.delete();
  } catch {
    // yoksay
  }
  memory.clear();
  freshness.clear();
}

/** Diskte tutulan önbelleğin toplam boyutu (bayt). */
export function cacheSize(): number {
  try {
    const dir = new Directory(Paths.cache, DIR_NAME);
    if (!dir.exists) return 0;
    return dir
      .list()
      .reduce((sum, entry) => sum + (entry instanceof File ? (entry.size ?? 0) : 0), 0);
  } catch {
    return 0;
  }
}
