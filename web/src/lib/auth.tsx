/**
 * BetTracker bölümünün giriş kapısı.
 *
 * Site tamamen statik — arkada doğrulama yapacak bir sunucu yok. Bu yüzden
 * kontrol tarayıcıda çalışır ve gizli veriyi korumaz: paketin içindeki özeti
 * okuyup parolayı deneme yanılmayla bulmak mümkündür. Amaç, bölümü kazara
 * açılmaktan ve gelişigüzel ziyaretçilerden uzak tutmak; gerçek bir yetki
 * duvarı isteniyorsa bunun bir sunucuda yapılması gerekir.
 *
 * Parola kaynak dosyada düz metin durmasın diye yalnızca SHA-256 özeti tutulur.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/** sha256("bettracker.v1:<kullanıcı>:<parola>") */
const CREDENTIAL_HASH =
  "add3a3a41af24fecaf83afc0b00832080ec82a8553b81b764e6b6ec1de28b877";

const SESSION_KEY = "bettracker.session";
const REMEMBER_KEY = "bettracker.remember";

/** Oturum işareti; biçim değişirse eski kayıtlar kendiliğinden geçersiz olur. */
const SESSION_VALUE = `v1:${CREDENTIAL_HASH.slice(0, 16)}`;

export type AuthStatus = "checking" | "out" | "in";

export interface Auth {
  status: AuthStatus;
  /** Hatırlanan kullanıcı adı, giriş formunu doldurmak için. */
  rememberedUser: string;
  /** Doğruysa oturum açılır; yanlışsa false döner. */
  signIn: (user: string, password: string, remember: boolean) => Promise<boolean>;
  signOut: () => void;
}

const AuthContext = createContext<Auth | null>(null);

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Kullanıcı adı büyük/küçük harfe ve baştaki boşluklara takılmasın. */
function normalizeUser(user: string): string {
  return user.trim().toLowerCase();
}

/** Oturum hem kalıcı hem geçici depoda aranır; hangisi varsa o geçerlidir. */
function readSession(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.localStorage.getItem(SESSION_KEY) === SESSION_VALUE ||
    window.sessionStorage.getItem(SESSION_KEY) === SESSION_VALUE
  );
}

function readRemembered(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(REMEMBER_KEY) ?? "";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // "checking" yalnızca ilk okuma için: giriş ekranı bir kare bile görünüp
  // hemen kaybolmasın.
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [rememberedUser, setRememberedUser] = useState("");

  useEffect(() => {
    setRememberedUser(readRemembered());
    setStatus(readSession() ? "in" : "out");
  }, []);

  const signIn = useCallback(
    async (user: string, password: string, remember: boolean): Promise<boolean> => {
      const normalized = normalizeUser(user);
      const hash = await sha256Hex(`bettracker.v1:${normalized}:${password}`);
      if (hash !== CREDENTIAL_HASH) return false;

      // Hatırlanmayan oturum sekme kapanınca düşsün diye sessionStorage'a yazılır.
      const store = remember ? window.localStorage : window.sessionStorage;
      const other = remember ? window.sessionStorage : window.localStorage;
      store.setItem(SESSION_KEY, SESSION_VALUE);
      other.removeItem(SESSION_KEY);

      if (remember) {
        window.localStorage.setItem(REMEMBER_KEY, normalized);
        setRememberedUser(normalized);
      } else {
        window.localStorage.removeItem(REMEMBER_KEY);
        setRememberedUser("");
      }

      setStatus("in");
      return true;
    },
    [],
  );

  const signOut = useCallback(() => {
    window.localStorage.removeItem(SESSION_KEY);
    window.sessionStorage.removeItem(SESSION_KEY);
    // Hatırlanan kullanıcı adı bilerek kalır: çıkış yapmak "beni unut"
    // demek değildir, bir sonraki girişte alan dolu gelsin.
    setStatus("out");
  }, []);

  const value = useMemo<Auth>(
    () => ({ status, rememberedUser, signIn, signOut }),
    [status, rememberedUser, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Auth {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
