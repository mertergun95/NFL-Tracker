#!/usr/bin/env node
/** Web ile mobil arasında birebir paylaşılan saf modülleri eşitler.
 *
 *  Bu dosyalar (çeviri sözlüğü, kolon etiketleri, hafta etiketleri,
 *  projeksiyon yardımcıları) DOM'a dokunmuyor, o yüzden iki tarafta da
 *  aynen çalışıyor. Monorepo paketi kurmak yerine kopyalanıyorlar; sessizce
 *  ayrışmasınlar diye kopya CI'da denetleniyor.
 *
 *      node scripts/sync-shared.mjs           # web -> mobile kopyala
 *      node scripts/sync-shared.mjs --check   # farklıysa hata ver (CI)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webLib = join(here, "..", "..", "web", "src", "lib");
const mobileLib = join(here, "..", "src", "lib");

const SHARED = ["locales.ts", "columns.ts", "schedule.ts", "projText.ts"];
const check = process.argv.includes("--check");

let drifted = 0;
for (const name of SHARED) {
  const source = readFileSync(join(webLib, name), "utf8");
  const targetPath = join(mobileLib, name);
  let current = "";
  try {
    current = readFileSync(targetPath, "utf8");
  } catch {
    current = "";
  }
  if (source === current) continue;

  if (check) {
    console.error(`ayrışmış: src/lib/${name} — "npm run sync-shared" çalıştırın`);
    drifted++;
  } else {
    writeFileSync(targetPath, source);
    console.log(`güncellendi: src/lib/${name}`);
  }
}

if (check && drifted > 0) process.exit(1);
if (!check) console.log("paylaşılan modüller güncel");
