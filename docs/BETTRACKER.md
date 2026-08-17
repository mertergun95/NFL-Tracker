# 🎯 Bahis Takip Modülü

Bahis kaydı, kasa (bankroll) yönetimi ve performans analizi. Ayrı bir
[BetTracker](https://github.com/mertergun95/BetTracker) projesi olarak
başladı; artık bu depoda, hem web arayüzünün hem de mobil uygulamanın bir
bölümü olarak yaşıyor.

İstatistik tarafından bağımsızdır: kendi verisi, kendi sözlüğü (TR/EN) ve kendi
ayarları var. Ortak olan tek şey tema ve giriş oturumu.

## Nerede?

| | Yol | Giriş |
|---|---|---|
| Web | `#/bets` — üst çubuktaki 🎯 bağlantısı | `#/bets` açılırken |
| Mobil | `Daha › Bahis Takip` | `/bets-login` rotası |

## Giriş

Bölüm bir kullanıcı adı ve parola ile açılır. **Beni hatırla** işaretliyse
oturum kalıcıdır (web: `localStorage`, mobil: `AsyncStorage`); işaretli
değilse web'de sekme kapanınca, mobilde uygulama kapanınca düşer. Çıkış
yapmak hatırlanan kullanıcı adını silmez — bir sonraki girişte alan dolu gelir.

> **Bu bir yetki duvarı değildir.** Site tamamen statik, arkada doğrulama
> yapacak bir sunucu yok; kontrol tarayıcıda/cihazda çalışır ve parolanın
> SHA-256 özeti paketin içindedir. Amaç bölümü kazara açılmaktan ve
> gelişigüzel ziyaretçilerden uzak tutmak. Gerçekten gizlenmesi gereken bir
> veri olsaydı bunun bir sunucuda doğrulanması gerekirdi.

Kullanıcı adı/parola değiştirmek için `sha256("bettracker.v1:<kullanıcı>:<parola>")`
hesaplayıp `CREDENTIAL_HASH` sabitini iki yerde de güncelleyin:
`web/src/lib/auth.tsx` ve `mobile/src/lib/auth.tsx`.

```bash
node -e "console.log(require('crypto').createHash('sha256').update('bettracker.v1:kullanici:parola').digest('hex'))"
```

## Veri nerede duruyor?

Cihazda. Hiçbir yere yüklenmez.

- **Web:** IndexedDB (Dexie) — `web/src/bettracker/core/db.ts`
- **Mobil:** AsyncStorage — `mobile/src/bettracker/core/store.ts`

İkisi de aynı `DataStore` arayüzünü uygular, bu yüzden üstündeki her şey
(ekranlar, istatistikler, senkron servisi) ortak mantıktır.

İsteğe bağlı olarak **kendi özel GitHub deponuza** senkron edilebilir
(Ayarlar › Senkronizasyon). Token yalnızca cihazda durur ve `api.github.com`
dışına gitmez. Yedek almak için JSON/CSV dışa aktarımı da var.

## Kod düzeni

```
web/src/bettracker/          mobile/src/bettracker/
  core/      saf mantık        core/      aynı saf mantık
             (oran, sonuçlandırma,          + AsyncStorage store
              istatistik, senkron)
  i18n/      TR/EN sözlük      i18n/      aynı sözlük
  screens/   DOM ekranları     screens/   React Native ekranları
  styles.css .bt-root'a        ui.tsx     tema token'lı bileşenler
             kapsanmış
```

`core/` iki tarafta da aynıdır (depolama katmanı ve dosya paylaşımı dışında).
Testler webde: `cd web && npm test`.

### Web'de stil kapsamı

`web/src/bettracker/styles.css` içindeki her kural `.bt-root` altına
kapsanmıştır. İki uygulamanın da `.card`, `.btn`, `.badge` gibi genel sınıf
adları var; kapsam olmadan birbirlerinin içine sızarlardı. Çakışan beş sınıf
(`app`, `empty`, `num`, `small`, `table-wrap`) modül tarafında `bt-` önekiyle
yeniden adlandırıldı.

Tema tokenleri de aynı kurala uyuyor: açık tema `:root`'ta, koyu tema
`:root[data-theme='dark']` altında — iki proje de aynı sözleşmeyi kullandığı
için `data-theme` özniteliği sitenin tema modülüne bırakıldı.

## Fikstür kataloğu

Bahis formundaki maç seçici `web/public/data/bettracker/` altındaki
`catalog.json` (lig + takım) ve `fixtures.json` dosyalarını okur.
`.github/workflows/refresh-bettracker-fixtures.yml` bunları her gün 04:15
UTC'de ESPN'in açık API'sinden yeniler ve commit'ler. Elle çalıştırmak için:

```bash
cd web && npm run fetch:bettracker-sports
```

Dosya yoksa form sessizce serbest metin girişine düşer.
