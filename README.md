# 🏈 NFL Tracker

Tarayıcıda çalışan NFL istatistik takipçisi: son 5 sezonun (2021–2025) ve 2026'dan
itibaren her yeni sezonun takım/oyuncu istatistikleri, tablolar ve grafiklerle.
Plan ve fazlar için [ROADMAP.md](ROADMAP.md).

## Nasıl çalışır?

- **Veri:** `pipeline/` içindeki Python pipeline'ı [nflverse](https://github.com/nflverse/nflverse-data)
  verisini indirir, kompakt JSON'lara dönüştürüp `web/public/data/` altına yazar.
- **Otomasyon:** `.github/workflows/update-stats.yml` her **Salı 10:00 UTC**
  mevcut sezonu günceller ve değişiklikleri commit'ler. Geçmiş sezonlar için
  Actions sekmesinden `Update NFL Stats` workflow'unu `backfill` moduyla çalıştırın.
- **Arayüz:** `web/` içinde React + Vite. Veriler statik JSON olarak fetch edilir,
  sunucu gerekmez.
- **Mobil uygulama:** `mobile/` içinde React Native + Expo. Kendi verisini
  taşımaz; yayındaki `https://statgrade.com/data/` JSON'larını okur, yani Salı
  güncellemesi mağaza sürümü gerektirmeden uygulamaya da yansır. Ayrıntı:
  [mobile/README.md](mobile/README.md).

## Yerelde çalıştırma

```bash
cd web
npm install
npm run dev      # http://localhost:5173
```

Mobil uygulama:

```bash
cd mobile
npm install
npx expo start   # QR kodu Expo Go ile okutun
```

## Yayınlama (GitHub Pages)

1. Repo **Settings → Pages → Source**: "GitHub Actions" seçin (bir kez).
2. `deploy.yml` her push'ta siteyi otomatik yayınlar.

## Veri modeli

`web/public/data/` altında:

| Dosya | İçerik |
|---|---|
| `manifest.json` | sezonlar, son güncelleme zamanı |
| `players/index.json` | oyuncu arama dizini (isim, poz, takım, boy/kilo, kolej…) |
| `seasons/{yıl}/player_weeks.json` | oyuncu × hafta istatistikleri (REG+POST) |
| `seasons/{yıl}/player_season.json` | oyuncu sezon toplamları (REG) |
| `seasons/{yıl}/team_weeks.json` / `team_season.json` | takım istatistikleri |
| `seasons/{yıl}/schedule.json` | fikstür ve skorlar |

JSON biçimi kolonsaldır: `{"columns": [...], "rows": [[...], ...]}`.

## Kaynaklar, atıf ve lisans

### Veri

- **NFL verisi:** [nflverse-data](https://github.com/nflverse/nflverse-data),
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) altında.
  Veri bu projede **değiştirilmiştir**: haftalık satırlar toplulaştırılmış,
  pay/oran kolonları türetilmiş ve kompakt kolonsal JSON'a dönüştürülmüştür.
  nflverse veriyi "olduğu gibi" sunar, herhangi bir garanti vermez.
- **NCAA verisi ve logoları, oyuncu görselleri:** ESPN ve NFL'in genel
  erişime açık uçları üzerinden gösterilir (kopyalanmaz, doğrudan bağlanır).
- **Fikstür/skorlar:** [nfldata](https://github.com/nflverse/nfldata) aynası.

### Marka ve telif uyarısı

StatGrade **bağımsız ve ticari olmayan** bir projedir. NFL, herhangi bir NFL
takımı veya NCAA ile **bağlantılı değildir**; onlar tarafından onaylanmamış
veya desteklenmemiştir. Takım adları, logoları ve oyuncu görselleri ilgili
sahiplerinin mülkiyetindedir ve burada yalnızca **tanımlama amacıyla**
kullanılmaktadır.

**Mobil uygulamada logo ve oyuncu görseli hiç yoktur.** Web'de bunlar
kaynağından gösteriliyor; mağazaya çıkan bir pakette marka riski yaratacağı
için uygulama takımları yalnızca kısaltma + renk rozetiyle (kendi çizimimiz)
gösterir.

İstatistiklerin kendisi olgusal veridir; ABD içtihadında spor istatistikleri
telif korumasına tabi değildir (*NBA v. Motorola*, 2. Daire; *C.B.C.
Distribution v. MLB Advanced Media*, 8. Daire 2007). Buna karşılık **logolar
ve görseller** marka/telif kapsamındadır — bu yüzden hiçbiri repoda
barındırılmaz, yalnızca kaynağından gösterilir.

### Kod lisansı

Bu depodaki **kod** için bkz. [LICENSE](LICENSE). Lisans yalnızca bu projenin
kendi kodunu kapsar; yukarıdaki üçüncü taraf veri ve görselleri kapsamaz.
