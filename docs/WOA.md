# WoA — Way of Analysis

Kullanıcıyı bir maçı (ve o maçtaki oyuncuları) analiz ederken adım adım
yönlendiren rehber. Serbest not defteri değil: sırayı dayatır, hiçbir adımın
atlanmadığından emin olur, sonunda rapor üretir.

**Odak: bahis.** Her adım "çizgiye göre bu ne diyor?" sorusuna hizmet eder.

---

## 1. Akış

```
Maç seç → MAÇ ANALİZİ (M1…M8) → 🔓 OYUNCU ANALİZİ (oyuncu başına P1…P6) → RAPOR
                                     ▲                                      ▲
                        M1,M2,M4,M8 tamamlanmadan açılmaz    istenen anda bitirilebilir
```

- **Kilit adımlar** (🔒): M1, M2, M4, M8 — oyuncu analizini bunlar açar.
  Gerekçe: bir oyuncunun değeri maç senaryosundan türer; senaryo yoksa oyuncu
  notu havada kalır.
- **Atlanabilir adımlar**: M3, M5, M6, M7 ve P2, P4, P5. Atlanan adım raporda
  "kapsanmadı" olarak görünür — eksik değil, bilinçli tercih.
- Kullanıcı **istediği anda** "Analizi bitir" der; o ana kadarki notlar rapora döner.

## 2. Maç analizi adımları

Her adım kartı üç katmandan oluşur:
1. **Neden bakıyoruz** (tek satır),
2. **StatGrade verisi** — gömülü canlı tablo/grafik, sayfayı terk etmeden,
3. **Dış kaynak checklist'i** — derin link + "ne getireceksin" etiketi + yapısal alan,
4. Altta **iki sütun not**: away | home.

| # | Adım | StatGrade verisi | Notun cevabı |
|---|---|---|---|
| M1 🔒 | Künye & çizgi | `next_schedule`: roof, surface, `away_rest`/`home_rest`, `div_game`, kickoff; geçmiş H2H | Çizgi neyi ima ediyor? Implied team total'lar? |
| M2 🔒 | Sağlık & kadro | `injuries` (report + practice status), `depth_charts`, `snap_counts` trendi | Kim yok, yerine kim, çizgi bunu fiyatlamış mı? |
| M3 | Form & güç | `power` (rank + `prev_rank` yön oku), son 3 hafta EPA trendi (`team_weeks`), `sos` | Kim gerçekten iyi, kim skorla kandırıyor? |
| M4 🔒 | Verimlilik çaprazı | `team_advanced` → iki tablo: *Away OFF vs Home DEF*, *Home OFF vs Away DEF*. EPA/play, success rate, explosive rate, pass/rush EPA, 3rd down, RZ TD%, sack rate, turnover | Her takım nerede avantajlı? |
| M5 | Tempo & pas eğilimi | `off_plays`, `off_pass_rate`, ppg/papg | Beklenen oyun sayısı → total'e etkisi? |
| M6 | Şema eşleşmesi | `team_scheme`: man/zone rate, `epa_vs_man`/`epa_vs_zone`, `blitz_rate`, `avg_box`, `avg_pass_rushers` | Savunmanın eğilimi hücumun zayıf yönüne mi denk geliyor? |
| M7 | Hat savaşı | `off_sack_rate`, `def_sack_rate`, rush EPA, `avg_box` | Kim kimi eziyor? |
| M8 🔒 | Tez & senaryo | M1–M7 birikimi otomatik özetlenir | Kim önde olur, kim pas atmak zorunda kalır? Skor tahmini, spread/total lean + güven (1–5) |

M8 sadece bir not değil: yazılan senaryo, oyuncu kartlarında hatırlatma olarak
görünür ("ev sahibi önde kapatır" tezi → deplasman WR'ının hacmi yukarı,
RB'si aşağı).

## 3. Oyuncu analizi adımları

Takım kadrosundan (`depth_charts`) seçilen her oyuncu için ayrı kart. İçerik
pozisyona göre değişir.

| # | Adım | StatGrade verisi |
|---|---|---|
| P1 🔒 | Rol & hacim | `snap_counts` (offense_pct trendi), `player_weeks` hedef/koşu payı, `player_redzone` (rz_/i10_ payları) |
| P2 | Verimlilik | NGS — WR: `avg_separation`, `avg_cushion`, `avg_intended_air_yards`, `percent_share_of_intended_air_yards`, `avg_yac_above_expectation`; RB: `rush_yards_over_expected_per_att`, `percent_attempts_gte_eight_defenders`; QB: `avg_time_to_throw`, `completion_percentage_above_expectation`, `aggressiveness`. Ayrıca `player_scheme` splitleri: `play_action`, `vs_blitz`, `heavy_box`/`light_box`, `shotgun`/`under_center`, `screen` |
| P3 🔒 | Eşleşme | `pos_allowed` (rakibin bu pozisyona verdiği + rank) + M6'daki şema notu |
| P4 | Bağlam & sağlık | `injuries`, `depth_charts` önü/arkası, eksik takım arkadaşı, M8 senaryo hatırlatması |
| P5 | Projeksiyon & çizgi | `projections` + `proj_eval` (kendi isabet geçmişimiz) + `agent` boom/bust + PropFinder çizgi kıyası |
| P6 🔒 | Karar | — (lean: over/under/pas, güven 1–5, gerekçe) |

> **Bilinen boşluk:** oyuncu bazında man/zone karşısı üretim bizde **yok**
> (`player_scheme` splitleri play action / blitz / box / shotgun / screen).
> Man/zone yalnızca takım seviyesinde (`team_scheme`). Bu boşluğu P3'te PFF
> WR/CB Matchup Chart ve Hashtag CB Coverage dolduruyor.

## 4. Dış kaynaklar

Karar: **PFF ve Hashtag'ten otomatik veri çekilmez.** Login duvarı, ToS riski ve
kırılgan scraping. WoA derin link verir, kullanıcı bakar ve yapısal alanı
doldurur. Otomatik gelen her şey kendi verimizden.

### Araç envanteri

**PFF** (Premium / PFF+)

| Araç | Yol |
|---|---|
| Greenline (model vs piyasa) | `/greenline` |
| Player Props | `/betting/player-props` |
| First TD Finder | `/betting/first-touchdown` |
| Key Insights | `/betting/key-insights` |
| Best Game Bets | `/betting/best-game-bets` |
| NFL Power Rankings | `/betting/nfl-power-rankings` |
| Player Grades | `/grades` |
| Premium Stats 2.0 (facet grade'leri: receiving, run block, pass block, pass rush, coverage) | `premium.pff.com/nfl/teams` |
| WR/CB Matchup Chart (haftalık, **perşembe** güncellenir) | `/tools/wr_cb_matchup_chart` |
| Matchups (QB/RB/WR/TE — grade + sakatlık + OL/DL kalitesi + hedef payı) | `/tools/matchups` |
| Fantasy Projections / Stats / Red Zone Reports | `/fantasy/projections`, `/fantasy/stats` |

**Hashtag Football** (HASHTAG+)

| Araç | Yol |
|---|---|
| Target Shares | `/nfl-target-shares` |
| Snap Shares | `/nfl-snap-shares` |
| Carries | `/nfl-carries` |
| Reception Rate | `/nfl-reception-rate` |
| CB Coverage | `/nfl-cornerback-coverage` |
| QB Efficiency | `/nfl-qb-efficiency` |
| RB Elusiveness | `/nfl-rb-elusiveness` |
| RB Workload | `/nfl-rb-workload` |
| Slot Production | `/nfl-slot-production` |
| Consistency (boom/bust — over/under için) | `/fantasy-football-consistency` |
| Injury Database | `/nfl-injury` |
| Projections | `/fantasy-football-projections` |

**Kapsam dışı:** draft, dynasty, ADP, mock draft, trade calculator, waiver —
sezon öncesi ve lig yönetimi araçları, haftalık bahis analizine girmiyor.
**FootballGuys** (ücretsiz): haftalık maç önizlemesi ve start/sit görüşü,
yalnızca link seviyesinde.

### Adım × araç bağlaması

| Adım | PFF | Hashtag | Getirilecek yapısal veri |
|---|---|---|---|
| M1 | Greenline, Key Insights | — | Greenline spread/total → bizim çizgiyle farkı hesaplanır |
| M2 | Premium Stats (eksik oyuncunun grade'i) | Injury DB | Eksik oyuncu + grade + yedeğinin grade'i |
| M3 | NFL Power Rankings | Consistency | PFF sırası vs bizim `power` sıramız |
| M4 | Premium Stats takım off/def grade | — | Off/def team grade (0–100) × 2 |
| M5 | — | Snap Shares | Beklenen oyun sayısı, PROE notu |
| M6 | Premium Stats coverage grade | CB Coverage | Man/zone eğilimi + CB kalite notu |
| M7 | Premium Stats pass block / pass rush grade | — | OL pass-block, DL pass-rush grade × 2 |
| M8 | Greenline, Best Game Bets, Key Insights | — | Bizim lean vs Greenline lean |
| P1 | Fantasy Stats, Red Zone Reports | Target Shares, Snap Shares, Carries, RB Workload | Hedef payı %, snap %, RZ payı |
| P2 | Premium Stats oyuncu facet grade | QB Efficiency, RB Elusiveness, Slot Production, Reception Rate | Facet grade + imza metrik |
| P3 | WR/CB Matchup Chart, Matchups | CB Coverage | Matchup advantage, gölge CB var mı |
| P4 | Matchups | Injury DB | Durum + hacim devri |
| P5 | Player Props, Fantasy Projections, First TD Finder | Projections, Consistency | PFF prop tahmini vs piyasa vs bizim projeksiyon |
| P6 | — | — | — |

### Abonelik kullanımı ölçülür

Dış kaynaklar adım kartında **onay kutulu checklist**tir. Raporun sonunda
**abonelik kullanım paneli** durur: "Bu analizde 9 PFF aracından 6'sı, 7 Hashtag
aracından 4'ü kullanıldı — kullanılmayanlar: …". Amaç: ödenen aboneliğin
kullanılmadığı analizlerin gözle görülür olması.

İki uyarı mekanizması:
- WR/CB chart perşembe güncellendiği için daha erken açıldığında "geçen haftanın
  verisi olabilir" rozeti.
- Greenline ile kullanıcının tezi ters düştüğünde M8'de kırmızı uyarı.

## 5. Arayüz

Tam sayfa oturum kabuğu (`#/woa`), BetTracker gibi kendi düzeni:

```
┌─ İlerleme: Maç 5/8 ───────────────────── [Analizi bitir] ─┐
│ STEPPER    │  ADIM KARTI              │  CANLI RAPOR      │
│ ▸ Bağlam   │  "Neden bakıyoruz"       │  önizleme         │
│  ✓ M1      │  ┌ StatGrade verisi ───┐ │  M1 ✓             │
│  ✓ M2      │  │  tablo / grafik     │ │  M2 ✓             │
│  ○ M3 atla │  └─────────────────────┘ │  M4 ●             │
│ ▸ Eşleşme  │  ☐ PFF Premium Stats     │                   │
│  ● M4      │  ☐ Hashtag CB Coverage   │  kaynak: 4/9      │
│ ▸ Karar    │  ┌ NOT: LAR ┐┌ NOT: SF ┐ │                   │
│  ○ M8      │  └──────────┘└──────────┘│                   │
│ ─────────  │      [Kaydet + sonraki ⏎]│                   │
│ 🔒 Oyuncu  │                          │                   │
└────────────┴──────────────────────────┴───────────────────┘
```

- Notlar otomatik kaydedilir (debounce), `Ctrl+Enter` → kaydet + sonraki adım.
- Mobilde tek sütun sihirbaz; veri paneli katlanabilir.
- Oyuncu sekmesi: takım → depth chart'tan oyuncu seç → o oyuncu için 6 adımlık
  kısa akış. Birden çok oyuncu aynı anda analiz edilebilir, kartlar listede birikir.

## 6. Veri ve rapor

- Depolama **Dexie** (BetTracker'ın altyapısı), veri yalnızca cihazda.
- Oturum modeli: `{ id, season, week, gameId, home, away, status, steps{}, players[], verdict }`.
- Rapor: yazdırılabilir HTML + `.md` indirme + panoya kopyalama. İçeriği: künye,
  maç tezi, takım notları, oyuncu kartları, kapsanmayan adımlar, abonelik
  kullanım paneli.
- Geçmiş oturumlar listelenir ve tekrar açılabilir.
- İleride: "bu analizden BetTracker'a bahis oluştur" köprüsü.
