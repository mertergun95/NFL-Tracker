/** Hata sınırı.
 *
 *  Release derlemesinde yakalanmayan bir JS hatası uygulamayı sessizce
 *  kapatıyor; kullanıcı "açılır açılmaz kapandı" diyor ve elde hiçbir bilgi
 *  olmuyor. Bu bileşen hatayı yakalayıp ekranda gösteriyor — böylece
 *  ekran görüntüsü tek başına teşhis için yetiyor.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

interface Props { children: ReactNode }
interface State { error: Error | null; stack: string | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, stack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ stack: info.componentStack ?? null });
    console.error("StatGrade hata sınırı:", error, info.componentStack);
  }

  render() {
    const { error, stack } = this.state;
    if (!error) return this.props.children;

    return (
      <ScrollView style={styles.page} contentContainerStyle={styles.content}>
        <Text style={styles.title}>StatGrade — beklenmeyen hata</Text>
        <Text style={styles.hint}>
          Bu ekranın görüntüsünü alıp iletirseniz sorunu bulabiliriz.
        </Text>
        <Text style={styles.label}>Hata</Text>
        <Text selectable style={styles.mono}>
          {error.name}: {error.message}
        </Text>
        {error.stack ? (
          <>
            <Text style={styles.label}>Yığın</Text>
            <Text selectable style={styles.mono}>{error.stack.slice(0, 1500)}</Text>
          </>
        ) : null}
        {stack ? (
          <>
            <Text style={styles.label}>Bileşen</Text>
            <Text selectable style={styles.mono}>{stack.slice(0, 800)}</Text>
          </>
        ) : null}
        <View style={{ height: 48 }} />
      </ScrollView>
    );
  }
}

// Tema sağlayıcısının kendisi patlamış olabileceği için renkler sabit.
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#0d1117" },
  content: { padding: 20, paddingTop: 64 },
  title: { color: "#f85149", fontSize: 20, fontWeight: "800", marginBottom: 6 },
  hint: { color: "#8b949e", fontSize: 13, marginBottom: 20, lineHeight: 18 },
  label: {
    color: "#8b949e", fontSize: 11, fontWeight: "700",
    marginTop: 16, marginBottom: 4, textTransform: "uppercase",
  },
  mono: {
    color: "#e6edf3", fontSize: 11, lineHeight: 16,
    fontFamily: "monospace",
  },
});
