# NFL Tracker — Yol Haritası

> Amaç: Tarayıcıda çalışan, son 5 sezonun (2021–2025) ve 2026'dan itibaren gelecek tüm sezonların
> takım ve **özellikle oyuncu** istatistiklerini barındıran; tablolar, grafikler, görseller ve
> "key insights" tarzı anlamlı çıkarımlar üreten tam bir NFL nerd yuvası.

---

## Mimari Özet

```
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│  Veri Kaynakları    │ ──▶ │  Python Pipeline     │ ──▶ │  Statik Web App     │
│  nflverse (ana)     │     │  (GitHub Actions'ta  │     │  React + Vite       │
│  ESPN API (destek)  │     │   çalışır, JSON      │     │  (GitHub Pages'te   │
│  footballguys (ek)  │     │   üretir, commit'ler)│     │   yayınlanır)       │
└─────────────────────┘     └──────────────────────┘     └─────────────────────┘
```

- **Sunucu yok.** Veriler build zamanında hazır JSON dosyaları olarak repo'da durur,
  tarayıcı doğrudan fetch eder. Ücretsiz, bakımsız, hızlı.
- **Haftalık güncelleme:** GitHub Actions cron'u her **Salı 10:00 UTC** (MNF bittikten sonra)
  pipeline'ı çalıştırır, yeni haftanın verisini işleyip commit'ler. Site otomatik güncellenir.

### Veri kaynağı kararı (footballguys hakkında not)

Footballguys'ı inceledim: takım bazlı sayfaları (sezon istatistikleri, game log, redzone,
targets, snap counts) erişilebilir; ancak oyuncu bazlı toplu ve yapılandırılmış veri sunmuyor
(Game Log Dominator vb. araçları abonelik arkasında) ve HTML scraping kırılgan.
Bu yüzden **omurga olarak nflverse** kullanıyoruz: NFL'in resmi play-by-play verisinden üretilen,
1999'a kadar giden, haftalık oyuncu/takım istatistiklerini CSV olarak yayınlayan açık ve
güvenilir standart kaynak (PFF/PFR analizlerinin de temelidir). **ESPN API** canlı skor ve
oyuncu meta verisi için destek; **footballguys** ise insights fazında redzone/snap count gibi
tamamlayıcı veriler ve içerik ilhamı için ek kaynak olarak planda duruyor.

---

## Fazlar

### ✅ Faz 0 — Planlama ve iskelet (bu adım)
- [x] Kaynak erişim testleri (nflverse, ESPN, footballguys)
- [x] Yol haritası ve mimari karar
- [x] Repo yapısı: `pipeline/`, `web/`, `.github/workflows/`

### ✅ Faz 1 — Veri seti kurulumu (2021–2025 backfill)
- [x] Python pipeline: nflverse'ten haftalık oyuncu istatistikleri (hücum/savunma/kicking),
      haftalık takım istatistikleri, maç programı/sonuçları, oyuncu kimlik verisi
- [x] Dönüşüm: web'in tüketeceği kompakt JSON'lar → `web/public/data/`
  - `manifest.json` — mevcut sezonlar, son güncelleme, hafta sayıları
  - `seasons/{yıl}/player_weeks.json` — oyuncu × hafta satırları (REG+POST)
  - `seasons/{yıl}/player_season.json` — sezon toplamları + maç başı ortalamalar
  - `seasons/{yıl}/team_weeks.json`, `team_season.json`
  - `seasons/{yıl}/schedule.json` — skorlar, sonuçlar
  - `players/index.json` — oyuncu arama dizini (isim, pozisyon, takım, headshot)
- [x] GitHub Actions `update-stats.yml`: `workflow_dispatch` ile backfill çalıştır, doğrula

### ✅ Faz 2 — Haftalık güncelleme otomasyonu (2026+ sezonlar)
- [x] Aynı workflow'a **Salı cron'u** (`0 10 * * 2`): sezon boyunca o haftanın verisini işler,
      değişiklik varsa commit'ler
- [x] Manifest'te "son güncellenen hafta" bilgisi; arayüzde "Verilerin güncelliği" göstergesi

### 🔄 Faz 3 — Kallavi arayüz (ilk sürüm hazır, geliştirilecek)
- [x] React + Vite + TypeScript, koyu "nerd" teması
- [x] Sayfalar:
  - **Dashboard:** sezon özeti, haftanın öne çıkanları, lig liderleri
  - **Oyuncular:** pozisyon/takım/sezon filtreli, sıralanabilir istatistik tabloları
  - **Oyuncu detay:** kariyer görünümü, hafta hafta game log, sezon karşılaştırması
  - **Takımlar:** takım sezon istatistikleri, hücum/savunma sıralamaları
  - **Takım detay:** haftalık sonuçlar, kadro istatistikleri
  - **Maçlar:** haftalık skor tablosu ve sonuçlar
- [x] GitHub Pages deploy workflow'u (Pages'i Settings'ten bir kez etkinleştirmek gerekir)

### ✅ Faz 3.5 — Derin veri katmanı (kullanıcı istekleri)
- [x] Takım sayfasında oyuncu **game logs** ve **game logs against** sekmeleri
- [x] Oyuncu **red zone / inside-10** istatistikleri (pbp'den hesaplanır)
- [x] Oyuncu **snap counts** (haftalık, pfr→gsis id eşlemeli)
- [x] Oyuncu paylarının takım toplamına oranı (carry/target/yds share, haftalık+sezonluk)
- [x] Oyuncu **advanced** istatistikleri (Next Gen Stats: CPOE, RYOE, separation…)
- [x] Takım **savunma şeması** statsleri (man/zone oranı, coverage'a göre EPA,
      blitz oranı, box — participation + FTN kaynaklı)
- [x] Takım **advanced** statsleri (EPA/play, success rate, explosive, 3. down,
      RZ TD%, sack rate, turnover — lig ortalamalarıyla)

### 🔄 Faz 4 — Grafikler, görseller, raporlar (başladı)
- [x] Oyuncu trend grafikleri (hafta hafta, istatistik seçilebilir sütun grafiği)
- [x] Takım hücum/savunma scatter haritası (lig ortalaması referanslı)
- [x] Oyuncu snap count trend grafiği
- [ ] Oyuncu-oyuncu ve sezon-sezon karşılaştırma görselleri
- [ ] Takım hücum/savunma dağılım grafikleri, lig geneli scatter'lar
      (ör. EPA benzeri verimlilik eksenleri)
- [ ] Footballguys'tan redzone / snap count / target verilerinin entegrasyonu
- [ ] Paylaşılabilir "stat kartı" görselleri

### Faz 5 — Key Insights (PFF tarzı çıkarımlar)
- [ ] Kural tabanlı otomatik çıkarımlar: form trendleri (son 3 hafta vs sezon ortalaması),
      kullanım artışı (target/carry share), patlama/çöküş adayları, rakip savunma zayıflıkları
- [ ] Gelecek hafta maçları için eşleşme (matchup) analizi: rakibin pozisyona karşı
      verdiği istatistikler ("points allowed to WR" vb.)
- [ ] Haftalık otomatik "Insights" raporu (Salı pipeline'ı üretir, arayüz gösterir)

---

## Repo Yapısı

```
NFL-Tracker/
├── ROADMAP.md              # bu dosya
├── pipeline/               # Python veri pipeline'ı
│   ├── requirements.txt
│   ├── config.py           # sezonlar, URL'ler, kolon seçimleri
│   ├── sources.py          # nflverse/ESPN indirme katmanı
│   ├── transform.py        # JSON üretimi
│   └── run.py              # CLI: --backfill | --update
├── web/                    # React + Vite arayüz
│   └── public/data/        # pipeline çıktısı JSON'lar (commit'lenir)
└── .github/workflows/
    ├── update-stats.yml    # Salı cron + manuel backfill
    └── deploy.yml          # GitHub Pages deploy
```

## Güncelleme Takvimi

| Ne                            | Ne zaman                  | Nasıl                              |
|-------------------------------|---------------------------|-------------------------------------|
| 2021–2025 backfill            | bir kez (Faz 1)           | `workflow_dispatch` ile manuel     |
| 2026+ haftalık istatistikler  | her Salı 10:00 UTC        | Actions cron, otomatik commit      |
| Sezon dışı                    | değişiklik yoksa no-op    | cron çalışır ama commit üretmez    |
