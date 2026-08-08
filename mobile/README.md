# 📱 StatGrade Mobile

StatGrade'in iOS/Android uygulaması. React Native + Expo (SDK 57) ile yazıldı,
yönlendirme `expo-router` ile dosya tabanlı.

## Veri nereden geliyor?

Uygulama **kendi içinde veri taşımaz**. `pipeline/` her Salı 10:00 UTC'de
nflverse'ten istatistikleri çekip `web/public/data/` altına yazıyor, GitHub
Pages bunu `https://statgrade.com` üzerinde yayınlıyor. Uygulama da doğrudan
o statik JSON'ları okuyor:

```
pipeline (Salı 10:00 UTC)
   └─> web/public/data/*.json  ──git──>  GitHub Pages  ──>  https://statgrade.com/data/...
                                                                    │
                                              ┌─────────────────────┴──────────────┐
                                              ▼                                    ▼
                                        web arayüzü                        mobil uygulama
```

Bunun pratik sonucu: **Salı sabahı veri yenilendiğinde uygulama da yenilenir**,
mağazaya yeni sürüm göndermek gerekmez. Sürüm yalnızca arayüz değişince gerekir.

Veri kökü `app.json` içindeki `extra.dataBaseUrl` ile ayarlanır. Geliştirirken
yerel pipeline çıktısına bakmak için:

```bash
cd web/public && python3 -m http.server 8090          # veriyi yerelde sun
EXPO_PUBLIC_DATA_BASE_URL=http://<makine-ip>:8090 npx expo start
```

### Önbellek ve çevrimdışı

`src/lib/cache.ts` her JSON'u cihazın cache dizinine yazar (sezon dosyaları
5 MB'a kadar çıktığı için AsyncStorage değil, dosya sistemi kullanılır):

1. bellekte varsa oradan,
2. diskte 6 saatten taze kopya varsa ağa çıkmadan diskten,
3. yoksa indirip diske yazarak,
4. ağ yoksa bayat kopyayı vererek — uçak modunda da açılır.

Aşağı çekmek (pull-to-refresh) önbelleği atlayıp yeniden indirir.
Ayarlar → "Önbelleği temizle" diski boşaltır.

## Lig anahtarı: NFL ↔ NCAA

Web'de iki ayrı rota ağacı var (`/` ve `/ncaa`). Telefonda ikinci bir sekme
takımı taşımak yerine **aynı beş sekme lige göre içerik değiştiriyor**;
seçim başlıktaki NFL/NCAA anahtarıyla yapılıyor ve kalıcı
(`src/lib/league.tsx`). Sekme dosyaları ince birer yönlendirici, gerçek
ekranlar `src/screens/nfl/` ve `src/screens/ncaa/` altında.

## Ekranlar

### NFL

| Sekme / rota | İçerik |
|---|---|
| Özet (`/`) | Sıradaki maçlar, geçen haftanın yıldızları ve skorları, değişim akışı, sezon liderleri |
| Oyuncular (`/players`) | Sezon toplamları; pozisyon sekmeleri, arama, sıralanabilir tablo |
| Projeksiyon (`/projections`) | Haftalık projeksiyonlar; kart görünümünde taban–tavan bandı, tablo görünümünde tüm kolonlar |
| Maçlar (`/games`) | Hafta hafta fikstür ve skorlar |
| Daha (`/more`) | Aşağıdaki tüm ekranların girişi + ayarlar |
| `/player/[id]` | Künye, bu haftanın projeksiyonu, sezon toplamı, maç maç grafik + tablo, red zone, snap, kariyer |
| `/team/[abbr]` | Kadro, fikstür, "bu savunmaya karşı" loglar, advanced |
| `/game/[season]/[gameId]` | Skor, takım karşılaştırması, iki takımın box score'u |
| `/teams`, `/standings`, `/depth`, `/injuries` | Lig geneli |
| `/matchups` | Yaklaşan haftanın maçları: güç sıralamaları, savunma şeması, pozisyona verilen, öne çıkan projeksiyonlar |
| `/props` | Prop Finder: çizgiyi artır/azalt, L5/L10/L20 + ev/deplasman tutma oranları, son 20 maç grafiği, alternatif çizgiler |
| `/compare` | En fazla 3 oyuncu; sezon toplamları (en iyi değer vurgulu) ve çok serili haftalık grafik |
| `/charts` | Tek statta yatay sıralama çubukları ya da iki statın dağılımı (noktaya dokun → kim olduğu) |
| `/insights`, `/accuracy` | Haftalık notlar ve projeksiyon karnesi |

### NCAA

| Rota | İçerik |
|---|---|
| Özet / Oyuncular / Projeksiyon / Maçlar | Aynı sekmeler, NCAA verisiyle |
| `/ncaa/player/[id]`, `/ncaa/team/[abbr]`, `/ncaa/game/[season]/[gameId]` | Detaylar |
| `/ncaa/teams`, `/ncaa/standings`, `/ncaa/rosters`, `/ncaa/accuracy` | Konferans bazlı tablolar, kadrolar, karne |

NCAA tarafında sakatlık raporu, derinlik listesi ve advanced/şema metrikleri
**yok** — ESPN box score'ları bunları vermiyor. Hafta seçicide bowl/playoff
maçları numara yerine tek "Bowl/Playoff" kovasında toplanır.

Dil (EN/TR/DE) ve tema (sistem/koyu/açık) Daha → Ayarlar'dan değişir.

## Web ile ortak kod

`locales.ts`, `columns.ts`, `schedule.ts` ve `projText.ts` DOM'a dokunmayan
saf modüllerdir ve web ile **birebir aynıdır**; `web/src/lib/`'den kopyalanır.
Web tarafında biri değişince:

```bash
npm run sync-shared     # web -> mobile kopyala
npm run check-shared    # farklıysa hata verir (CI bunu koşar)
```

Mobile'a özgü metinler `src/lib/locales.mobile.ts` içindedir ve sözlüğün
üstüne eklenir. `i18n`, `theme`, `data`, `hooks` ve `teams` modülleri ise
mobil için yeniden yazılmıştır (AsyncStorage, Appearance, dosya önbelleği,
logosuz takım rozeti).

## Görsel varlıklar ve lisans

Uygulamada **takım logosu ve oyuncu fotoğrafı yoktur**. Web sürümü bunları
ESPN/NFL uçlarından gösteriyor; mağazaya çıkan bir pakette bu marka/telif
riski yaratır. Yerine takımın kısaltması, takım renginden türetilen kendi
rozetimizle çizilir (`src/components/TeamBadge.tsx`). NCAA'da 250+ okulun
resmî rengi elimizde olmadığı için zemin rengi kısaltmadan deterministik
olarak türetilir — aynı okul her yerde aynı rengi alır, hiçbir okulun resmî
rengi iddia edilmez (`src/components/NcaaBadge.tsx`). İkonlar da elle
üretilir (`scripts/make-icons.py`), sekme ikonları SVG olarak kod içinde
çizilir — pakette üçüncü taraf görsel yoktur.

İstatistikler olgusal veridir ve nflverse'ten gelir (CC BY 4.0, atıf her
ekranın altında). Takım adları yalnızca veriyi tanımlamak için geçer.
StatGrade bağımsız ve ticari olmayan bir projedir; NFL, herhangi bir NFL
takımı veya NCAA ile bağlantılı değildir.

## Geliştirme

```bash
cd mobile
npm install
npx expo start          # QR kodu Expo Go ile okutun
npm run typecheck       # tsc --noEmit
```

İkonları yeniden üretmek için (kalın bir sans font yolu verilebilir):

```bash
python3 scripts/make-icons.py [BOLD_SANS_FONT.ttf]
```

## Derleme (EAS)

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile preview   # APK
eas build --platform ios --profile production
```

`app.json` içinde paket kimlikleri `com.statgrade.app` olarak tanımlıdır.
Mağaza gönderiminde uygulamanın NFL ile bağlantısı olmadığını belirten
açıklama metni kullanılmalıdır (Daha → Hakkında ekranındaki metinle aynı).
