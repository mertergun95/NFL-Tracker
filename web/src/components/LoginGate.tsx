/** Bahis takip bölümünün önündeki giriş ekranı.
 *
 *  Oturum açıksa çocukları olduğu gibi gösterir; değilse formu çizer.
 *  Stil `login.css` içinde, uygulamanın kendi token'larıyla.
 */
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import Logo from "./Logo";
import "./login.css";

export default function LoginGate({ children }: { children: ReactNode }) {
  const { status, rememberedUser, signIn } = useAuth();
  const { t } = useI18n();

  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  // Hatırlanmış bir kullanıcı varsa kutu işaretli gelsin — kullanıcı zaten
  // bir kez "hatırla" demiş, her girişte tekrar işaretlemesi gerekmesin.
  const [remember, setRemember] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (rememberedUser) setUser(rememberedUser);
  }, [rememberedUser]);

  if (status === "checking") return null;
  if (status === "in") return <>{children}</>;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFailed(false);
    const ok = await signIn(user, password, remember);
    setBusy(false);
    if (!ok) {
      setFailed(true);
      setPassword("");
    }
  }

  return (
    <div className="login">
      <form className="login__card" onSubmit={onSubmit}>
        <div className="login__brand">
          <Logo />
          <h1>{t("login.title")}</h1>
        </div>
        <p className="login__sub">{t("login.sub")}</p>

        <label className="login__field">
          <span>{t("login.user")}</span>
          <input
            type="text"
            value={user}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            onChange={(e) => setUser(e.target.value)}
          />
        </label>

        <label className="login__field">
          <span>{t("login.pass")}</span>
          <input
            type="password"
            value={password}
            autoComplete="current-password"
            required
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <label className="login__remember">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          <span>{t("login.remember")}</span>
        </label>

        {failed && (
          <p className="login__error" role="alert">
            {t("login.failed")}
          </p>
        )}

        <button type="submit" className="login__submit" disabled={busy}>
          {busy ? t("login.checking") : t("login.submit")}
        </button>

        <p className="login__notice">{t("login.notice")}</p>

        {/* Girişi yapamayan biri siteye dönebilsin diye. */}
        <Link to="/" className="login__back">
          ← {t("nav.backToStats")}
        </Link>
      </form>
    </div>
  );
}
