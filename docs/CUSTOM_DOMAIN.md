# Siteyi kendi domainine bağlama

Hedef domain: **statgrade.com** (alındı).
Site şu an GitHub Pages'te yayında:
`https://mertergun95.github.io/NFL-Tracker/`

Kendi domainine taşımak için **kodda hiçbir değişiklik gerekmiyor**: Vite
`base: './'` ile göreli varlık yolları üretiyor ve arayüz HashRouter
kullanıyor, yani site hem alt dizinde hem kök dizinde birebir çalışır.
Yapılacak her şey domain sağlayıcısı ve GitHub ayarları tarafında.

> **Not:** GitHub Actions ile yayınlandığı için depoya `CNAME` dosyası
> koymaya gerek yok — bu yöntemde GitHub o dosyayı yok sayar. Domain
> yalnızca repo ayarlarından tanımlanır.
> (docs.github.com → Pages → Managing a custom domain)

---

## 1. Domaini al ✅

`statgrade.com` alındı.

## 2. DNS kayıtlarını gir

Kök domain (`statgrade.com`) ana adres olacak şekilde:

| Tip | Ad | Değer | TTL |
|-----|-----|-------|-----|
| A | `@` | `185.199.108.153` | Auto |
| A | `@` | `185.199.109.153` | Auto |
| A | `@` | `185.199.110.153` | Auto |
| A | `@` | `185.199.111.153` | Auto |
| AAAA | `@` | `2606:50c0:8000::153` | Auto |
| AAAA | `@` | `2606:50c0:8001::153` | Auto |
| AAAA | `@` | `2606:50c0:8002::153` | Auto |
| AAAA | `@` | `2606:50c0:8003::153` | Auto |
| CNAME | `www` | `mertergun95.github.io` | Auto |

Dördü de aynı `@` adına eklenir (silme/değiştirme değil, dört ayrı kayıt).
AAAA kayıtları IPv6 içindir; zorunlu değil ama eklemek iyidir.
`www` kaydı sayesinde GitHub iki adres arasında otomatik yönlendirme kurar.

> **Cloudflare kullanıyorsan:** kayıtların yanındaki bulut simgesi **gri
> (DNS only)** olmalı. Turuncu (Proxied) bırakırsan GitHub sertifikayı
> üretemez ve HTTPS açılmaz.

## 3. GitHub'da domaini tanımla

`Settings → Pages → Custom domain` alanına `statgrade.com` yazıp **Save**.
GitHub DNS kontrolünü kendisi yapar; "DNS check in progress" görürsen
kayıtlar yayılana kadar (genelde 10 dk – 1 saat) beklemek yeterli.

## 4. HTTPS'i zorunlu kıl

DNS kontrolü yeşile döndükten sonra aynı sayfadaki **Enforce HTTPS**
kutusunu işaretle. Sertifika (Let's Encrypt) otomatik üretilir; ilk
üretim birkaç dakika ile birkaç saat arası sürebilir.

---

## Doğrulama

```bash
scripts/check-domain.sh statgrade.com
```

Betik A/AAAA/CNAME kayıtlarını, HTTP→HTTPS yönlendirmesini, sertifikayı
ve veri dosyalarının erişilebilirliğini kontrol eder.

## Sık karşılaşılanlar

- **"Domain does not resolve to the GitHub Pages server"** → DNS henüz
  yayılmamış ya da A kayıtları eksik. `dig statgrade.com +short` çıktısı
  dört `185.199.*` adresini vermeli.
- **HTTPS kutusu gri/tıklanamıyor** → sertifika henüz üretilmedi; DNS
  doğru ise beklemek yeterli. Cloudflare proxy'si açıksa kapat.
- **Site açılıyor ama veriler gelmiyor** → tarayıcı önbelleği; hard
  refresh (Ctrl/Cmd + Shift + R). Veri yolları görelidir, kök dizinde de
  `/data/...` olarak çözülür.
- **Domain değişince eski adres** → `mertergun95.github.io/NFL-Tracker`
  otomatik olarak yeni domaine yönlenir.
