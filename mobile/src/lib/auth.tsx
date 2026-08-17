/**
 * Bahis takip bölümünün giriş kapısı.
 *
 * Web'deki ile aynı kural, aynı kullanıcı adı ve parola; depolama
 * AsyncStorage. Kontrol cihazda çalışır ve gizli veriyi korumaz: paketin
 * içindeki özeti okuyup parolayı deneme yanılmayla bulmak mümkündür. Amaç,
 * bölümü kazara açılmaktan ve telefonu eline alan başkasından uzak tutmak.
 *
 * Parola kaynak dosyada düz metin durmasın diye yalnızca SHA-256 özeti tutulur.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
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

/** Kullanıcı adı büyük/küçük harfe ve baştaki boşluklara takılmasın. */
function normalizeUser(user: string): string {
  return user.trim().toLowerCase();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // "checking" yalnızca ilk okuma için: giriş ekranı bir kare bile görünüp
  // hemen kaybolmasın.
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [rememberedUser, setRememberedUser] = useState("");

  useEffect(() => {
    // Tarayıcıdaki sessionStorage'ın telefonda karşılığı yok: uygulama
    // kapanınca düşmesi gereken oturum bellekte tutulur, yani "hatırla"
    // işaretlenmemişse hiçbir şey yazılmaz ve yeniden açılışta giriş istenir.
    AsyncStorage.multiGet([SESSION_KEY, REMEMBER_KEY]).then((entries) => {
      const map = new Map(entries);
      setRememberedUser(map.get(REMEMBER_KEY) ?? "");
      setStatus(map.get(SESSION_KEY) === SESSION_VALUE ? "in" : "out");
    });
  }, []);

  const signIn = useCallback(
    async (user: string, password: string, remember: boolean): Promise<boolean> => {
      const normalized = normalizeUser(user);
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `bettracker.v1:${normalized}:${password}`,
      );
      if (hash.toLowerCase() !== CREDENTIAL_HASH) return false;

      if (remember) {
        await AsyncStorage.multiSet([
          [SESSION_KEY, SESSION_VALUE],
          [REMEMBER_KEY, normalized],
        ]);
        setRememberedUser(normalized);
      } else {
        await AsyncStorage.multiRemove([SESSION_KEY, REMEMBER_KEY]);
        setRememberedUser("");
      }

      setStatus("in");
      return true;
    },
    [],
  );

  const signOut = useCallback(() => {
    // Hatırlanan kullanıcı adı bilerek kalır: çıkış yapmak "beni unut"
    // demek değildir, bir sonraki girişte alan dolu gelsin.
    void AsyncStorage.removeItem(SESSION_KEY);
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
