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

### ✅ Faz 4 — Grafikler, görseller, raporlar
- [x] Oyuncu trend grafikleri (hafta hafta, istatistik seçilebilir sütun grafiği)
- [x] Takım hücum/savunma scatter haritası (lig ortalaması referanslı)
- [x] Oyuncu snap count trend grafiği
- [x] Oyuncu karşılaştırma sayfası (3'e kadar oyuncu, sezon tablosu + haftalık overlay)
- [x] Lig Grafikleri sayfası (eksenleri seçilebilir dağılım grafikleri)
- [x] Paylaşılabilir PNG stat kartı (oyuncu sayfasından indirme)
- [ ] Oyuncu-oyuncu ve sezon-sezon karşılaştırma görselleri
- [ ] Takım hücum/savunma dağılım grafikleri, lig geneli scatter'lar
      (ör. EPA benzeri verimlilik eksenleri)
- [ ] Footballguys'tan redzone / snap count / target verilerinin entegrasyonu
- [ ] Paylaşılabilir "stat kartı" görselleri

### ✅ Faz 5 — Key Insights (PFF tarzı çıkarımlar)
- [x] Kural tabanlı otomatik çıkarımlar: form trendleri (son 3 hafta vs sezon ortalaması),
      kullanım artışı (target/carry share), takım güç profili (EPA sıralamaları)
- [x] Gelecek hafta maçları için eşleşme (matchup) analizi: EPA sıralama uyuşmazlıkları
      + pozisyona karşı verilen PPR ("points allowed to WR/RB/TE") ve takip edilecek oyuncular
- [x] Haftalık otomatik "Insights" raporu (Salı pipeline'ı `insights.json` üretir,
      arayüzdeki Insights sayfası gösterir; sezon içinde her hafta kendini yeniler)

### ✅ Faz 5.5 — Derinleştirme (kullanıcı istekleri, 2. tur)
- [x] Grafiklerde noktaya tıklayınca sağdan kayan **oyuncu künyesi** (drawer)
- [x] **Maç detay** sayfası: skor, takım karşılaştırması, iki takımın oyuncu istatistikleri
- [x] **Haftalık projeksiyonlar** (ağırlıklı form + rakip pozisyon-zafiyeti çarpanı)
- [x] Oyuncuların **hücum şeması splitleri** (play action / blitz / shotgun / box / screen)
      + insights'ta şema notları (blitze karşı QB profilleri, blitz-ağır eşleşmeler)
- [x] Takımlar sayfası: kategori sekmeli birleşik **karşılaştırma tabloları**
- [x] **Deep Charts**: oyuncu (sezon/red zone/NGS) + takım modları, serbest eksen seçimi
- [x] Dashboard lider kartları **Top 30'a genişletilebilir**
- [x] Karşılaştırma v2: oyuncu başına **ayrı sezon**, en iyi değer vurgusu, kümülatif mod

### ✅ Faz 5.6 — Kadrolar ve grafik zenginleştirme (kullanıcı istekleri, 3. tur)
- [x] **Güncel kadrolar + depth chart** sayfası (2026 resmi derinlik şeması,
      logo ızgarasından takım seçimi, Hücum/Savunma/ST); oyuncu dizininde
      güncel takım (offseason transferleri)
- [x] **Takım logoları** (ESPN CDN) tablolarda, başlıklarda, maç kartlarında
- [x] Deep Charts: eksen seçimine göre **"grafik nasıl okunur" rehberi**
- [x] Künyede **sıradaki rakip + haftalık projeksiyon**
- [x] **Sıralama (yatay bar)** görünümü — scatter'a alternatif
- [x] Grafikte **arama**: oyuncu/takım yazınca turuncu halka + etiketle vurgulanır
- [x] CI: pipeline değişikliğinde otomatik veri koşusu + log commit'i (teşhis)

### ✅ Faz 5.7 — Matchup merkezi ve analitik derinlik (kullanıcı istekleri, 4. tur)
- [x] **Matchuplar sayfası**: haftalık maç bazlı analiz — güç karşılaştırması
      (lig sırası çipleriyle), savunma şemaları yan yana, pozisyonlara verilen
      gerçek istatistikler, iki tarafın projeksiyon liderleri
- [x] **Puan Durumu** sayfası (8 divizyon tablosu, averaj renkli)
- [x] Takım sayfasında **2026 fikstürü**
- [x] Insights **gerçek istatistik bazlı** (rec/yds/TD verilen + form karşılaştırması)
      ve **coverage bazlı** (man/zone-ağır savunmalara karşı eşleşme notları)
- [x] Deep Charts: **lig ortalaması çizgileri + eğilim doğrusu + korelasyon**,
      **hafta aralığı** filtresi (W nazaran client-side toplama)
- [x] Projeksiyonlar **maça göre** görünüm
- [x] pos_allowed.json + next_schedule.json pipeline çıktıları

### ✅ Faz 5.8 — Sakatlık sistemi ve projeksiyon v2 (kullanıcı istekleri, 5. tur)
- [x] **Sakatlık takibi**: resmi NFL raporları (nflverse injuries) her Salı çekilir;
      Sakatlıklar sayfası (takım filtreli, renkli durum rozetleri), oyuncu
      sayfasında sakatlık geçmişi, künyede güncel durum
- [x] **Projeksiyon v2**: güncel kadro bazlı (transferler dahil) ×
      matchup × şema uyumu (blitz/box/coverage splitleri) × snap trendi ×
      sakatlık (Out/Doubtful hariç, Questionable −%10, bayat rapor koruması)
- [x] Insights'ta oyuncular **güncel takımlarıyla** anılır
- [x] Haftalık grafiklerde **3 haftalık hareketli ortalama eğrisi + sezon
      ortalaması çizgisi**; renkli **trend alarmları** (🔥/🧊); künyede trend
      renkli **sparkline**

### ✅ Faz 5.9 — Gerçek stat projeksiyonları, maç günü sakatlık ve karne (6. tur)
- [x] **Projeksiyon v3**: PPR değil GERÇEK istatistik tahminleri — QB
      att/cmp/pas yds/TD/int, RB koşu/yds/TD/tgt/rec, WR-TE tgt/rec/yds/TD;
      her stat rakibin o pozisyona o statta verdiğine göre kendi çarpanıyla
- [x] **Maç günü sakatlık güncellemesi**: ayrı workflow, kickoff'a ~4 ve ~2
      saat kala injuries + projeksiyonları tazeler (maç yoksa no-op);
      diğer istatistikler Salı cron'unda kalır
- [x] **Projeksiyon Karnesi** sayfası: son 4 tamamlanmış hafta geriye dönük
      test — stat bazında MAE/bias/korelasyon tablosu, tahmin-vs-gerçek
      scatter, oyuncu detay tablosu; sezon boyunca her Salı kendini yeniler
- [x] NaN/JSON güvenliği: tarayıcıda parse hatasına yol açan pandas NaN
      sızıntısı kapatıldı (allow_nan=False korumasıyla)

### ✅ Faz 5.10 — Kadro doğruluğu, akan dashboard ve karne detayı (7. tur)
- [x] Projeksiyonlar **sıkı güncel-kadro modu**: kadroda olmayan oyuncu (FA/
      emekli) projeksiyona girmez; roster+depth birleşik current_teams.json
- [x] **Dashboard v2**: haftanın yıldızları şeridi (headshot kartları, gerçek
      stat satırları), hafta skorları, istatistiksel değişim akışı, altta
      genişletilebilir Stats Leaders
- [x] Oyuncu isimlerinin yanında **pozisyon alt-simgesi** (tüm sayfalarda)
- [x] Takımlar haritası **tam konfigüre edilebilir**: tüm takım statları +
      izin verilen pas/koşu/rec (pozisyona göre) + savunma şeması eksenleri,
      hazır kombinasyon pilleri
- [x] Karne **maça göre** görünüm: seçilen maçtaki her oyuncu için tahmin vs
      gerçekleşen kompakt satırlar

### ✅ Faz 5.11 — ML projeksiyon motoru (8. tur)
- [x] Veri seti 8 sezona genişletildi (2018–2025, arayüzde de seçilebilir)
- [x] ml.py: sızıntısız özellik seti + stat başına gradient boosting
      (44k satırla her Salı yeniden eğitilir); canlı projeksiyonlar ML'den,
      sezgisel model fallback; önceki-sezon özellikleri W1-4 soğuk
      başlangıcını çözer
- [x] Karne iki motoru walk-forward yan yana ölçer (ML/Sezgisel seçici);
      ML çoğu statta önde (pas TD r 0.24→0.36, koşu yd r 0.60→0.63)

### ✅ Faz 5.12 — Oyuncu sayfasında projeksiyon karnesi (9. tur)
- [x] Oyuncu sayfası başlığının altında "Bu Haftanın Projeksiyonu" kartı
      (rakip, pozisyona göre gerçek stat satırı, sakatlık rozeti, motor bilgisi)
- [x] "Projeksiyon Karnesi" bölümü: geçmiş her hafta için tahmin vs
      gerçekleşen tablo + birincil statta MAE ve isabet yüzdesi özeti
- [x] proj_eval.json artık son haftanın değil 13 değerlendirme haftasının
      tamamının oyuncu detayını taşır (~2.8k satır)
- [x] Karne sayfasına hafta seçici eklendi (W6–W18 arası her hafta
      tahmin-vs-gerçek incelenebilir)

### ✅ Faz 5.13 — NCAA Tracker (10. tur)
- [x] pipeline/ncaa.py: ESPN CFB API'den FBS fikstürü + maç box score'ları
      (oyuncu pas/koşu/hava topu, takım istatistikleri) — kolon adları NFL
      ile ortak, etiketler/grafikler yeniden kullanılır
- [x] Son 4 sezon (2022–2025) backfill; Salı güncellemesi NCAA'yi de
      artımlı tazeler (yalnızca yeni biten maçların box score'u çekilir)
- [x] Arayüzde NFL | NCAA lig seçici; NCAA sayfaları: Dashboard (liderler),
      Oyuncular, Oyuncu detayı (kariyer + eşikli haftalık grafik), Takımlar,
      Takım detayı (fikstür + kadro), Maçlar, Maç detayı (box score),
      Puan Durumu (konferansa göre)
- [x] Pozisyonlar box score hacminden türetilir (ESPN pozisyon vermez)

### ✅ Faz 5.14 — NCAA v2: projeksiyonlar, 2026 kadro/fikstür, dashboard (11. tur)
- [x] ESPN roster API: 13.5k oyuncu gerçek pozisyon + sınıf; Kadrolar sayfası;
      oyuncu indeksindeki hacim-türetimli pozisyonlar gerçekleriyle düzeltildi
- [x] 2026 fikstürü (946 maç): Maçlar sayfasında sezon olarak, takım
      detayında ve dashboard'da açılış maçları olarak
- [x] NCAA haftalık projeksiyonlar (sezgisel: son sezon form ortalaması ×
      rakip savunma çarpanı; güncel kadro/transfer portal esaslı, 1.689
      oyuncu, hedef 2026 W1); Projeksiyonlar sayfası + oyuncu sayfası kartı
- [x] Dashboard v2: son haftanın öne çıkan performansları + skorlar +
      yeni sezon fikstürü akışı; liderler alta "Stats Leaders" olarak taşındı

### ✅ Faz 5.15 — NCAA karnesi, maç görünümü ve Berlin saatleri (12. tur)
- [x] NCAA Karne: W6–W15 geriye dönük test (canlı motorla aynı formül),
      haftalık MAE/bias/korelasyon + hafta seçici + stat/maç görünümleri;
      oyuncu sayfasında tahmin-vs-gerçek geçmiş tablosu
- [x] NCAA Projeksiyonlar'a maça göre görünüm (maç pill'leri + iki takımın
      oyuncuları kompakt tahmin satırlarıyla)
- [x] Maç saatleri Almanya (Europe/Berlin) saatiyle: NFL (ET→DE, DST'ye
      duyarlı) ve NCAA (UTC kickoff→DE) — Maçlar kartları, maç detayları,
      fikstürler ve dashboard akışında

### ✅ Faz 5.16 — NFL Prop Finder (13. tur)
- [x] /props sayfası (propfinder.app tarzı): oyuncu arama ya da takım seçimi,
      stat + ayarlanabilir çizgi (±0.5/±adım butonları, varsayılan son 10
      maç medyanı)
- [x] Hit-rate kartları: Son 5/10/20, sezon bazlı (son 3 sezon), Ev/Deplasman,
      seçilebilir rakip kırılımı; %60+/%40- yeşil/kırmızı renklendirme,
      seri (streak) rozeti
- [x] Çizgiye göre yeşil/kırmızı son 20 maç grafiği (PropBarChart) +
      alternatif çizgiler tablosu
- [x] Takım propları: atılan/yenilen/toplam sayı (schedule'dan), pas/koşu/
      toplam yard, sack'ler

### ✅ Faz 5.17 — Çok dilli arayüz: EN / TR / DE (14. tur)
- [x] lib/i18n.tsx: dil bağlamı + `useT()` hook'u + hook'suz `translate()`;
      seçim localStorage'da saklanır, ilk açılışta tarayıcı diline göre gelir
- [x] lib/locales.ts: ~300 arayüz metni üç dilde ({var} yer tutucularıyla)
- [x] columns.ts: ~120 istatistik etiketi üç dilli; yüzde biçimi dile göre
      (TR "%60", EN "60%", DE "60 %"); "allowed_*" ve proj/act önekleri de çevrilir
- [x] Tüm NFL ve NCAA sayfaları + ortak bileşenler (tablolar, grafik notları,
      oyuncu künyesi, hata/boş durum mesajları) çeviri anahtarlarına taşındı
- [x] Üst çubuğun sağ üst köşesinde EN | TR | DE seçici

### ✅ Faz 5.18 — Insights motoru çok dilli + "Charts" adlandırması (15. tur)
- [x] pipeline/i18n.py: şablon sözlüğü + `tr()`, `pct()`, `join()`, `concat()`
      yardımcıları; her insight metni üç dilde birden üretilir
- [x] insights.py'nin tüm metin üreten yerleri (form, kullanım, matchup,
      şema/coverage, blitz, takım gücü) ve karne "method" alanı şablonlara
      taşındı; insights.json'da title/detail artık {en, tr, de} sözlüğü
- [x] Arayüz: `localized()` yardımcısı ile Insights sayfası, Dashboard akışı
      ve Karne açıklaması seçili dilde gösterir (eski düz-dize verisiyle de
      geriye dönük uyumlu)
- [x] "Deep Charts" → "Charts" / "Grafikler" / "Charts" (nav + sayfa başlığı)

### ✅ Faz 5.19 — Projeksiyon gerçekçiliği: rol ve takım hacmi (16. tur)
- [x] Hata: ML motoru her oyuncuyu bağımsız projekte ettiği için bir takımın
      2–4 QB'sine birden başlangıç seviyesi tahmin veriliyor, takım toplam
      hacmi gerçekçi ortalamayı 1.5–2× aşıyordu (NE 62 pas denemesi, NO 54 koşu)
- [x] `apply_role_and_volume()`: (1) takım başına tek QB — depth chart sırası,
      yoksa hacim; (2) pozisyon başına gerçekçi rotasyon (QB1, 3 RB, 5 WR,
      2 TE); (3) takımın maç başı attempts/carries/targets bütçesini aşan
      toplamlar oransal kırpılır (bağlı yard/TD'ler de aynı oranda, böylece
      verimlilik korunur; bütçenin altı büyütülmez)
- [x] Aynı düzeltme geriye dönük teste de uygulanır — orada bugünün depth
      chart'ı yerine yalnızca o haftadan önceki hacim verisi kullanılır
- [x] NCAA projeksiyonlarında da takım başına tek QB (132/132 takım)

### ✅ Faz 5.20 — Kendi domainine taşıma hazırlığı (17. tur)
- [x] Kod tarafında değişiklik gerekmediği doğrulandı: Vite `base: './'`
      göreli varlık yolları üretiyor, arayüz HashRouter kullanıyor → site
      hem `/NFL-Tracker/` altında hem kök dizinde birebir çalışıyor
- [x] `docs/CUSTOM_DOMAIN.md`: registrar önerisi, kök domain için A/AAAA
      kayıtları, www CNAME, GitHub ayarı ve HTTPS adımları
- [x] `scripts/check-domain.sh`: DNS kayıtları, HTTPS, HTTP→HTTPS
      yönlendirmesi ve veri dosyalarını doğrulayan betik (dig yoksa
      python3 ile çözümler)
- [x] Not: Actions ile yayınlandığı için depoya `CNAME` dosyası gerekmiyor
      (GitHub bu yöntemde onu yok sayar)

### Faz 6 — Fikirler (gelecek)
- [ ] Oyuncu bazlı kariyer trend sayfaları (sezonlar arası çizgi grafikler)
- [ ] Haftalık e-posta/Slack özeti, insights arşivi
- [ ] ESPN canlı skor entegrasyonu (maç günü modu)

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
