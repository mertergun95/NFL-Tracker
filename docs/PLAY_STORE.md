# StatGrade'i Google Play'e Yükleme

Mobil uygulamayı (`mobile/`) Play Store'a çıkarmanın uçtan uca adımları.
Derleme **EAS Build** ile bulutta yapılır; Mac ya da yerel Android SDK
gerekmez.

> **Önce şunu bilin:** Kişisel (bireysel) geliştirici hesabıyla açılan yeni
> uygulamalar, üretime çıkmadan önce **12 test kullanıcısıyla 14 gün kapalı
> test** yapmak zorunda. Detay: [Adım 6](#6-kapalı-test-12-kişi--14-gün).
> Bu, sürecin en uzun ve en çok atlanan parçası — planı ona göre yapın.

---

## 0. Ön hazırlık (bir kez)

| Gerekli | Nasıl |
|---|---|
| Google Play geliştirici hesabı | [play.google.com/console](https://play.google.com/console) · **25 USD tek seferlik** · kimlik doğrulama birkaç gün sürebilir |
| Expo hesabı | [expo.dev](https://expo.dev) · ücretsiz plan derleme için yeterli (kuyrukta bekleme olabilir) |
| Node + EAS CLI | `npm install -g eas-cli` |
| Gizlilik politikası URL'i | `web/public/privacy.html` hazır → yayınlanınca `https://statgrade.com/privacy.html` |

**Gizlilik politikasındaki `CONTACT_EMAIL` yer tutucusunu gerçek bir adresle
değiştirin** ve web sitesini deploy edin (main'e push yeterli). Play, o
sayfanın gerçekten açıldığını kontrol eder.

---

## 1. Hesabı bağla ve projeyi tanıt

```bash
cd mobile
eas login                 # Expo hesabı
eas init                  # projeyi Expo'ya kaydeder, app.json'a projectId ekler
```

`eas init` `app.json` içine `extra.eas.projectId` yazar — bu değişikliği
commit'leyin.

---

## 2. Sürüm numaraları

- `app.json` → `expo.version` kullanıcıya görünen sürüm (`1.1.0`).
- Android `versionCode` (Play'in gördüğü tam sayı) **EAS tarafından
  yönetiliyor**: `eas.json` içinde `cli.appVersionSource: "remote"` ve
  production profilinde `autoIncrement: true` var. Her production derlemesinde
  otomatik artar; elle uğraşmayın.
- Play'e **aynı versionCode ile ikinci kez yükleme yapılamaz** — bu yüzden
  otomatik artış önemli.

---

## 3. Önce test derlemesi al (APK)

Mağazaya göndermeden önce uygulamayı gerçek bir telefonda çalıştırın:

```bash
eas build --platform android --profile preview
```

Çıktı bir **APK**. Bittiğinde EAS bir indirme linki ve QR kod verir;
telefonda açıp kurun ("bilinmeyen kaynaklar"a izin vermeniz gerekebilir).

Kontrol listesi:
- [ ] Veri geliyor mu (Özet, Oyuncular, Projeksiyon)
- [ ] NFL ↔ NCAA anahtarı çalışıyor mu
- [ ] Uçak modunda açılıyor mu (önbellekten)
- [ ] Koyu/açık tema, üç dil
- [ ] Geri tuşu davranışı

---

### EAS olmadan, yerelde APK almak

Sadece kendi telefonunuza kurmak için buluta hiç çıkmadan da derleyebilirsiniz
(Linux/macOS; JDK 17+ ve Android SDK gerekir):

```bash
export ANDROID_HOME=$HOME/Android/sdk
sdkmanager --install "platform-tools" "platforms;android-36" "build-tools;36.0.0"

cd mobile
npx expo prebuild --platform android          # android/ klasörünü üretir (gitignore'da)
cd android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
# -> app/build/outputs/apk/release/app-release.apk
```

`-PreactNativeArchitectures=arm64-v8a` olmadan dört mimari birden paketlenir ve
APK ~100 MB olur; tek mimariyle ~42 MB'a iner. Modern telefonların hepsi
arm64.

Bu APK, Expo şablonunun **debug anahtarıyla** imzalanır — kendi cihazınıza
kurmak için sorun değil, ama Play'e yüklenemez. Play sürümü EAS'in ürettiği
release anahtarını kullanır; imzalar farklı olduğu için mağazadan kurmadan
önce yerel sürümü kaldırmanız gerekir.

## 4. Üretim derlemesi (AAB)

Play artık APK değil **AAB** (Android App Bundle) ister:

```bash
eas build --platform android --profile production
```

İlk çalıştırmada EAS **imzalama anahtarı (keystore)** sorar →
**"Generate new keystore"** deyin. EAS anahtarı sizin adınıza saklar.

> ⚠️ Bu anahtar uygulamanın kimliğidir. Kaybederseniz aynı uygulamayı
> güncelleyemezsiniz. Yedeğini alın:
> `eas credentials` → Android → keystore indir → güvenli bir yerde saklayın.

Derleme bitince `.aab` dosyasını indirin.

---

## 5. Play Console'da uygulamayı oluştur

[Play Console](https://play.google.com/console) → **Create app**

| Alan | Değer |
|---|---|
| App name | StatGrade |
| Default language | Türkçe (veya İngilizce) |
| App or game | App |
| Free or paid | **Free** |

Sonra sol menüdeki **Dashboard** görevlerini sırayla doldurun:

### 5a. Store listing (mağaza kaydı)

| Alan | Not |
|---|---|
| Kısa açıklama (80 karakter) | "NFL ve NCAA istatistikleri, haftalık projeksiyonlar ve prop analizi." |
| Uzun açıklama (4000 karakter) | Aşağıdaki taslağı kullanın |
| Uygulama ikonu 512×512 | `mobile/store/play-icon-512.png` |
| Feature graphic 1024×500 | `mobile/store/play-feature-graphic-1024x500.png` |
| Telefon ekran görüntüleri | **En az 2**, 16:9–9:16 arası. Uygulamadan kendiniz çekin |
| Kategori | Sports |
| Gizlilik politikası | `https://statgrade.com/privacy.html` |

Ekran görüntüsü için önerilen ekranlar: Özet, Projeksiyon (kart görünümü),
Oyuncu künyesi, Prop Finder, NCAA özet.

### 5b. App content (içerik beyanları)

Dashboard → **App content** altındaki her formu doldurun:

- **Privacy policy** → `https://statgrade.com/privacy.html`
- **Ads** → *Uygulamada reklam yok* → **No**
- **App access** → tüm içerik girişsiz erişilebilir → **All functionality is available without special access**
- **Content rating** → anketi doldurun; kategori **Reference/News** ya da
  **Sports**, şiddet/cinsellik/kumar sorularının hepsine **Hayır**.
  ⚠️ **Kumar sorusuna dikkat:** uygulama bahis oynatmıyor, bahis sitesine
  bağlanmıyor ve gerçek para içermiyor — "Prop Finder" yalnızca geçmiş
  istatistik dağılımı gösteriyor. Yine de açıklama alanında bunu net yazın.
- **Target audience** → 18+ seçin (spor istatistiği/analiz içeriği; çocuklara
  yönelik değil). Çocuk kategorisi seçmeyin, ek yükümlülük getirir.
- **Data safety** → aşağıdaki tabloya göre doldurun
- **Government apps** → No
- **Financial features** → None
- **Health** → No

#### Data safety formu cevapları

| Soru | Cevap |
|---|---|
| Uygulamanız kullanıcı verisi topluyor/paylaşıyor mu? | **No** |
| Veriler aktarımda şifreleniyor mu? | **Yes** (tüm istekler HTTPS) |
| Kullanıcı verisinin silinmesini isteyebiliyor mu? | Veri toplanmadığı için soru düşer; sorulursa uygulama içi önbellek temizlemeyi belirtin |

Uygulama gerçekten hiçbir şey toplamıyor (reklam SDK'sı, analitik, çökme
raporlama yok) — bu formu dürüstçe "No" ile doldurabilirsiniz.

---

## 6. Kapalı test (12 kişi — 14 gün)

**Kimler için zorunlu:** 13 Kasım 2023'ten sonra açılmış **kişisel/bireysel**
geliştirici hesapları. **Kuruluş (organization, D-U-N-S numaralı)** hesapları
bu şarttan muaf.

Kurallar:
- En az **12 test kullanıcısı** kapalı teste **katılmış (opt-in)** olmalı
- **14 gün kesintisiz** katılımda kalmalılar — biri çıkarsa sayaç etkilenir
- Gerçek cihaz + gerçek Google hesabı; emülatör ve sahte hesap sayılmaz
- Nisan 2026'dan beri Google **etkileşim** de arıyor: testçiler uygulamayı
  gerçekten açıp kullanmalı. Kurup bırakmak yeterli değil.
- 14 gün, sürüm kapalı kanalda **yayına girip testçiler katıldıktan sonra**
  işlemeye başlar

Adımlar:

1. **Testing → Closed testing → Create track**
2. E-posta listesi oluşturun (12+ Gmail adresi — arkadaş/aile/meslektaş)
3. **Create new release** → 4. adımdaki `.aab` dosyasını yükleyin
4. Sürüm notlarını yazın, **Review release → Start rollout**
5. Konsolun verdiği **opt-in linkini** testçilere gönderin; her biri linki
   açıp "Become a tester" demeli, sonra Play'den uygulamayı kurmalı
6. Testçilere "iki günde bir açıp birkaç ekranda gezinin" deyin
7. 14 gün dolunca Dashboard'da **"Apply for production"** düğmesi açılır

> Süreyi kısaltmanın meşru bir yolu yok. 12 kişiyi bulmak zorsa kuruluş
> hesabı açmak (D-U-N-S numarası gerekir) tek alternatif.

---

## 7. Üretime gönder

1. **Production → Create new release**
2. Aynı `.aab`'yi yükleyin (ya da yeni bir production derlemesi alın)
3. Ülkeleri seçin (**Türkiye + Almanya + ABD** ya da tümü)
4. **Review release → Start rollout to Production**
5. İnceleme tipik olarak birkaç gün sürer; ilk uygulamalarda daha uzun olabilir

---

## 8. Sonraki güncellemeler

Arayüz değişikliği yaptığınızda:

```bash
cd mobile
# app.json içindeki expo.version'ı yükseltin (ör. 1.1.0 -> 1.2.0)
eas build --platform android --profile production
eas submit --platform android --latest     # ya da .aab'yi elle yükleyin
```

`eas submit` ilk kullanımda bir **Google Play servis hesabı JSON'u** ister;
oluşturma adımları: [Expo dokümanı](https://docs.expo.dev/submit/android/).
Dosyayı `mobile/play-service-account.json` olarak koyun — **commit etmeyin**
(`.gitignore`'da).

> **Veri güncellemesi için sürüm gerekmez.** İstatistikler
> `https://statgrade.com/data/` üzerinden canlı okunuyor; Salı sabahı pipeline
> çalıştığında uygulama da yeni veriyi görür. Mağaza sürümü yalnızca *arayüz*
> değişince gerekir.

---

## Uzun açıklama taslağı

```
StatGrade, NFL ve NCAA futbolu için istatistik ve projeksiyon uygulamasıdır.

• Oyuncu ve takım istatistikleri — son sekiz NFL sezonu, hafta hafta ve
  sezon toplamı olarak, pozisyona göre düzenlenmiş kolonlarla.
• Haftalık projeksiyonlar — gradient boosting tabanlı model her Salı
  yeniden eğitilir; her istatistik için taban–tavan aralığı gösterilir.
• Projeksiyon karnesi — geçmiş haftaların tahminleri gerçekleşenle
  karşılaştırılır. Ne kadar isabetli olduğumuzu saklamıyoruz.
• Prop Finder — bir oyuncunun ya da takımın seçtiğiniz çizgiyi son 5, 10,
  20 maçta kaç kez geçtiğini gösterir; ev/deplasman ve sezon kırılımıyla.
• Eşleşme analizi — yaklaşan haftanın maçlarında rakip savunmaların güçlü
  ve zayıf yönleri, lig sıralamalarıyla.
• Sakatlık raporu, derinlik listesi, puan durumu ve haftalık öngörüler.
• NCAA (FBS) — oyuncular, takımlar, konferans puan durumu, kadrolar ve
  haftalık projeksiyonlar.
• Türkçe, İngilizce ve Almanca. Koyu ve açık tema.
• Çevrimdışı çalışır: indirilen veriler cihazda saklanır.
• Hesap gerekmez, reklam yok, kullanıcı verisi toplanmaz.

Veri kaynağı: nflverse (CC BY 4.0), StatGrade tarafından işlenip
toplulaştırılmıştır. NCAA verisi ESPN'in herkese açık uçlarından derlenir.

StatGrade bağımsız ve ticari olmayan bir projedir. NFL, herhangi bir NFL
takımı veya NCAA ile bağlantılı değildir; onlar tarafından onaylanmamış veya
desteklenmemiştir. Takım adları yalnızca tanımlama amacıyla kullanılır.
```

---

## Sık karşılaşılan ret sebepleri

| Sebep | Önlem |
|---|---|
| Gizlilik politikası açılmıyor / eksik | URL'i tarayıcıda test edin, iletişim adresi gerçek olsun |
| Data safety formu ile uygulamanın davranışı uyuşmuyor | Reklam/analitik SDK'sı eklerseniz formu güncelleyin |
| Kumar içeriği şüphesi | Açıklamada "bahis değil, geçmiş istatistik analizi" vurgusu; bahis sitesine link vermeyin |
| Marka ihlali (logo/görsel) | Uygulamada logo ve oyuncu fotoğrafı yok — bu hâlde kalsın |
| Hedef API seviyesi düşük | Expo SDK 57 API 36 hedefliyor; SDK'yı güncel tutun |
| Yetersiz test etkileşimi | Testçiler uygulamayı gerçekten kullanmalı |
