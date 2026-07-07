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

## Yerelde çalıştırma

```bash
cd web
npm install
npm run dev      # http://localhost:5173
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
