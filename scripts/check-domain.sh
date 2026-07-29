#!/usr/bin/env bash
# Custom domain kurulumunu doğrular: DNS kayıtları, HTTPS, veri erişimi.
# Kullanım: scripts/check-domain.sh ornek.com
set -uo pipefail

DOMAIN="${1:-}"
if [ -z "$DOMAIN" ]; then
  echo "Kullanım: $0 <domain>   (ör. $0 ornek.com)" >&2
  exit 1
fi

GH_IPS=(185.199.108.153 185.199.109.153 185.199.110.153 185.199.111.153)
ok=0; fail=0
say()  { printf '%-34s %s\n' "$1" "$2"; }
pass() { say "$1" "OK    $2"; ok=$((ok+1)); }
bad()  { say "$1" "HATA  $2"; fail=$((fail+1)); }
warn() { say "$1" "not   $2"; }

# DNS çözümleyici: dig varsa onu kullan; yoksa DNS-over-HTTPS'e düş.
# DoH tercih edilir çünkü yerel çözümleyici bazı ortamlarda kayıtların
# tamamını döndürmüyor (ör. dört A kaydından yalnızca birkaçı).
resolve() { # resolve <tip: A|AAAA|CNAME> <ad>
  if command -v dig >/dev/null 2>&1; then
    dig +short "$1" "$2" 2>/dev/null
    return
  fi
  local json
  json=$(curl -s --max-time 20 \
    "https://dns.google/resolve?name=$2&type=$1" 2>/dev/null) || json=""
  [ -n "$json" ] && python3 - "$json" <<'PY'
import json, sys
try:
    for a in (json.loads(sys.argv[1]).get("Answer") or []):
        print(a.get("data", "").rstrip("."))
except Exception:
    pass
PY
}

echo "== $DOMAIN =="

# 1) A kayıtları
a_records=$(resolve A "$DOMAIN" | sort)
missing=()
for ip in "${GH_IPS[@]}"; do
  grep -qx "$ip" <<<"$a_records" || missing+=("$ip")
done
if [ -z "$a_records" ]; then
  bad "A kayitlari" "hic kayit yok (DNS yayilmamis olabilir)"
elif [ ${#missing[@]} -eq 0 ]; then
  pass "A kayitlari" "dort GitHub adresi de tanimli"
else
  bad "A kayitlari" "eksik: ${missing[*]}"
fi

# 2) AAAA (opsiyonel)
if [ -n "$(resolve AAAA "$DOMAIN")" ]; then
  pass "AAAA kayitlari" "IPv6 tanimli"
else
  warn "AAAA kayitlari" "yok (zorunlu degil)"
fi

# 3) www -> github.io
www=$(resolve CNAME "www.$DOMAIN")
if grep -q "github.io" <<<"$www"; then
  pass "www CNAME" "${www%.}"
else
  warn "www CNAME" "github.io'ya isaret etmiyor"
fi

# HTTP durum kodu. curl basarisiz olunca zaten 000 yazar; gecici ag
# hatalarini elemek icin iki kez daha dener.
status() {
  local code
  for _ in 1 2 3; do
    code=$(curl -4 -s -o /dev/null -w '%{http_code}' --max-time 30 "$1" 2>/dev/null)
    [ "$code" != "000" ] && [ -n "$code" ] && break
    sleep 2
  done
  echo "${code:-000}"
}

# 4) HTTPS
code=$(status "https://$DOMAIN/")
if [ "$code" = "200" ]; then
  pass "HTTPS" "site aciliyor (200)"
else
  bad "HTTPS" "HTTP $code (sertifika henuz uretilmemis olabilir)"
fi

# 5) HTTP -> HTTPS yönlendirmesi
# GitHub, Enforce HTTPS acildiktan sonra 80. portta kisa sure 503 dönebilir.
redir=$(curl -4 -s -o /dev/null -w '%{redirect_url}' --max-time 20 "http://$DOMAIN/" 2>/dev/null || true)
if grep -q "^https://" <<<"$redir"; then
  pass "HTTP yonlendirme" "-> $redir"
else
  warn "HTTP yonlendirme" "henuz yok (Enforce HTTPS yeni acildiysa normal)"
fi

# 6) Veri dosyaları
for f in data/manifest.json data/ncaa/manifest.json; do
  c=$(status "https://$DOMAIN/$f")
  [ "$c" = "200" ] && pass "$f" "erisilebilir" || bad "$f" "HTTP $c"
done

echo
echo "Sonuc: $ok basarili, $fail hatali"
[ "$fail" -eq 0 ] || exit 1
