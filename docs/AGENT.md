# NFL Agent

Her Salı, projeksiyonlar üretildikten sonra çalışan haftalık köşe yazarı.
Gelecek hafta için **boom** (projeksiyonunu farkla aşması beklenen) ve **bust**
(belirgin biçimde altında kalması beklenen) adaylarını seçer, her biri için bir
gerekçe yazar ve haftanın bültenini üretir.

- Kod: `pipeline/agent.py`
- Çıktı: `web/public/data/agent.json`
- Site: `/#/agent` · Uygulama: **Daha → NFL Agent** (ve özet ekranındaki kart)

## Temel ilke: model sinyal üretmez, sinyali anlatır

Bütün rakamlar Python tarafında hesaplanır. Dil modeline yalnızca hesaplanmış
bir **kanıt paketi** gider ve sistemi kuralı nettir: *kanıtta birebir geçmeyen
hiçbir sayıyı yazma.* Sitede gösterilen değerler de metinden değil, aynı
paketten okunur — yani modelin uydurabileceği bir sayı ekranda yer almaz.

Anahtar (`ANTHROPIC_API_KEY`) tanımlı değilse ya da çağrı düşerse metin kural
tabanlı yedekten üretilir (`engine: "rules"`); sayfa ve Salı cron'u çalışmaya
devam eder, yalnızca bülten boş kalır.

## Akış

```
1. Aday havuzu   projections.json → proj_ppr ≥ 6.0 olan QB/RB/WR/TE
                 + pozisyon içi projeksiyon sırası (QB 20, RB 36, WR 48, TE 18)
                 "Out" raporlanan oyuncular elenir
2. Sinyaller     form, kullanım, snap payı, matchup, bant simetrisi, sakatlık
3. Puanlama      boom_score / bust_score (z-skor ağırlıklı toplam)
4. Seçim         her listeden 8 isim; takım başına ≤2, pozisyon başına ≤4
5. Anlatı        claude-opus-5, JSON şemasıyla kısıtlı, İngilizce
6. Karne         önceki haftaların çağrıları gerçek sonuçlarla notlanır
```

## Sinyaller

| Sinyal | Kaynak | Nasıl okunur |
|---|---|---|
| Bant simetrisi | `projections.json` taban/tavan | `((tavan−proj) − (proj−taban)) / bant`. Oran yerine simetri kullanılıyor: `(tavan−proj)/proj` küçük projeksiyonlarda mekanik olarak büyük çıkıyor ve liste yedek oyuncularla doluyordu. Simetri projeksiyon büyüklüğünden bağımsız (r ≈ 0.1). |
| Form | `player_weeks.json` | Son 3 hafta PPR ortalaması − sezon ortalaması |
| Kullanım | `player_weeks.json` | Maç başına fırsat: QB'de pas denemesi, RB'de taşıma+hedef, WR/TE'de hedef. Pay kolonu ayrıca yazılır. |
| Snap payı | `snap_counts.json` | Son 3 hafta hücum snap yüzdesi − sezon |
| Matchup | `pos_allowed.json` | Rakibin o pozisyona verdiği PPR ve lig sırası (1 = en cömert) |
| Oynaklık | `player_weeks.json` | Haftalık PPR standart sapması; boom tarafında hafif artı |
| Sakatlık | `injuries.json` | Questionable −0.5, Doubtful −1.0 katsayı; Doubtful zorunlu olarak bust |

Her sinyal ekranda bir satır olarak görünür ve bir `tone` taşır (`up` / `down` /
`neutral`): arayüz buna göre renklendirir, kural tabanlı metin de yalnızca
çağrının yönünü destekleyen sinyalleri cümleye alır.

## Karne (self-evaluation)

`agent.json` son 10 haftanın çağrılarını `history` altında tutar. Her Salı,
oynanmış haftaların çağrıları gerçek PPR ile karşılaştırılır:

- **boom isabet:** gerçek ≥ projeksiyon × 1.35
- **bust isabet:** gerçek ≤ projeksiyon × 0.65

Eşik olarak tavan/taban yerine oran kullanılıyor, çünkü model tabanı sık sık
0.0'a kırpıyor ve o eşik pratikte hiç tutmuyor. Toplam isabet oranı sayfadaki
**Karne** bölümünde ve kanıt paketinde (modelin kendi geçmişini bilmesi için)
yer alır.

## Model çağrısı

```python
client.messages.stream(
    model="claude-opus-5",
    max_tokens=12000,
    system=[{"type": "text", "text": SYSTEM,
             "cache_control": {"type": "ephemeral"}}],   # sabit sistem promptu önbelleklenir
    messages=[{"role": "user", "content": prompt}],
    thinking={"type": "adaptive"},
    output_config={"effort": "high",
                   "format": {"type": "json_schema", "schema": SCHEMA}},
)
```

`stop_reason` `refusal` ya da `max_tokens` ise anlatı atılır ve kural tabanlı
metne düşülür. Haftada tek çağrı yapılır (~5k girdi / ~3k çıktı token).

Maç günü koşusu (`run.py gameday`) ajanı **çalıştırmaz**: o cron Pazar günü
altı kez tetikleniyor ve bu haftalık bir köşe yazısı.

## Elle çalıştırma (`agent` modu)

Salı koşusu (`run.py update`), nflverse'te yeni sezonun dosyası yoksa
"güncellenecek veri yok" deyip erken çıkar — sezon dışında ajana sıra gelmez.
Köşe yazısını istediğin an tek başına üretmek için:

**Actions → Update NFL Stats → Run workflow → mode: `agent`**

ya da yerelde:

```bash
cd pipeline
ANTHROPIC_API_KEY=sk-ant-... python run.py agent
```

Bu mod sezon verisine dokunmaz; yalnızca mevcut `projections.json` +
`seasons/` içeriğini okuyup `agent.json`'ı yeniden yazar.

## Kurulum

GitHub → **Settings → Secrets and variables → Actions → New repository secret**

| Ad | Değer |
|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com/) üzerinden alınan API anahtarı |

Secret tanımlı değilse workflow yine yeşil kalır, `agent.json` kural tabanlı
metinle yazılır.

Yerelde denemek için:

```bash
cd pipeline
pip install -r requirements.txt
ANTHROPIC_API_KEY=sk-ant-... python -c "import agent; agent.build_and_write()"
```

## Ayar noktaları

`pipeline/agent.py` başındaki sabitler:

| Sabit | Varsayılan | Etki |
|---|---|---|
| `MIN_PROJ_PPR` | 6.0 | Aday olmak için gereken en düşük projeksiyon |
| `STARTABLE_RANK` | QB 20 / RB 36 / WR 48 / TE 18 | Pozisyon içi derinlik sınırı |
| `PICKS_PER_LIST` | 8 | Her listedeki isim sayısı |
| `MAX_PER_TEAM` / `MAX_PER_POS` | 2 / 4 | Liste tek takım ya da tek pozisyonla dolmasın |
| `BOOM_RATIO` / `BUST_RATIO` | 1.35 / 0.65 | Karne eşikleri |
| `HISTORY_WEEKS` | 10 | Karnede tutulan hafta sayısı |
