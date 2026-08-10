/** Mobil istatistik tablosu.
 *
 *  Telefonda 12 kolonluk bir tabloyu sığdırmanın yolu yok, o yüzden:
 *   - ilk kolon (oyuncu/takım) sabit kalır, geri kalanı yana kayar,
 *   - başlığa dokunmak sıralamayı değiştirir,
 *   - satırlar parça parça açılır ("daha fazla") — 500 satırı bir anda
 *     çizip kaydırmayı kasmamak için.
 */
import { memo, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { font, radius, space, useColors } from "../lib/theme";
import { describe, fmt, label } from "../lib/columns";
import { useT } from "../lib/i18n";
import type { StatRow } from "../lib/types";

const PAGE = 40;

export interface StatTableProps {
  rows: StatRow[];
  /** Baştaki `frozen` kolon sabitlenir; kalanı yatay kayar. */
  columns: string[];
  defaultSort?: string;
  /** Kolon adı -> hücre içeriği (ör. oyuncu adı + pozisyon rozeti). */
  render?: Record<string, (row: StatRow) => ReactNode>;
  /** Satıra dokununca (ör. oyuncu detayına git). */
  onRowPress?: (row: StatRow) => void;
  /** Sabit kolonun genişliği (birden fazlaysa `widths` ile ayarlanır). */
  firstWidth?: number;
  /** Kayan kolonların genişliği. */
  colWidth?: number;
  /** Kaç kolon sabitlensin (varsayılan 1). Maç logunda hafta+rakip. */
  frozen?: number;
  /** Kolon bazında genişlik istisnası. */
  widths?: Record<string, number>;
}

function cellText(col: string, row: StatRow): string {
  return fmt(col, row[col]);
}

function StatTableInner({
  rows, columns, defaultSort, render, onRowPress,
  firstWidth = 148, colWidth = 78, frozen = 1, widths,
}: StatTableProps) {
  const c = useColors();
  const t = useT();
  const [sortCol, setSortCol] = useState(defaultSort ?? columns[1] ?? columns[0]);
  const [desc, setDesc] = useState(true);
  const [limit, setLimit] = useState(PAGE);
  /** Kayan bölümün ölçülen genişliği — kolonları tam sığdırmak için. */
  const [viewport, setViewport] = useState(0);

  useEffect(() => {
    if (defaultSort) { setSortCol(defaultSort); setDesc(true); }
    setLimit(PAGE);
  }, [defaultSort]);

  useEffect(() => { setLimit(PAGE); }, [rows]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortCol], bv = b[sortCol];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === "number" && typeof bv === "number") return desc ? bv - av : av - bv;
      return desc
        ? String(bv).localeCompare(String(av))
        : String(av).localeCompare(String(bv));
    });
    return copy;
  }, [rows, sortCol, desc]);

  const shown = sorted.slice(0, limit);
  const frozenCols = columns.slice(0, Math.max(1, frozen));
  const rest = columns.slice(Math.max(1, frozen));

  /** Sabit blokta ilk kolon `firstWidth`, diğerleri `widths` ya da colWidth. */
  const frozenWidth = (col: string, i: number) =>
    widths?.[col] ?? (i === 0 ? firstWidth : colWidth);
  const frozenTotal = frozenCols.reduce((sum, col, i) => sum + frozenWidth(col, i), 0);
  const scrollWidth = (col: string) => widths?.[col] ?? colWidth;

  /* Sağdaki kolon yarım görünüyordu ("1..", "C..") çünkü görünür alan kolon
     genişliğinin tam katı değil. Ölçülen alana tam sığacak şekilde kolon
     genişliği hafifçe esnetiliyor; kaydırma da bu adıma oturuyor, böylece
     hiçbir konumda yarım kolon kalmıyor. */
  const uniform = rest.length > 0
    && rest.every((col) => widths?.[col] === undefined);
  const fitted = uniform && viewport > 0
    ? viewport / Math.max(1, Math.round(viewport / colWidth))
    : null;
  const scrollWidthFitted = (col: string) =>
    fitted !== null ? fitted : scrollWidth(col);
  const snap = fitted ?? undefined;

  const onSort = (col: string) => {
    if (col === sortCol) setDesc((d) => !d);
    else { setSortCol(col); setDesc(true); }
  };

  const arrow = (col: string) => (col === sortCol ? (desc ? " ▾" : " ▴") : "");

  if (rows.length === 0) {
    return (
      <Text style={{ color: c.textDim, fontSize: font.sm, padding: space.lg,
                     textAlign: "center" }}>
        {t("table.empty")}
      </Text>
    );
  }

  return (
    <View>
      <View style={[styles.frame, { borderColor: c.border }]}>
        <View style={{ flexDirection: "row" }}>
          {/* sabit kolonlar */}
          <View style={{ width: frozenTotal, borderRightWidth: StyleSheet.hairlineWidth,
                         borderRightColor: c.border }}>
            <View style={{ flexDirection: "row" }}>
              {frozenCols.map((col, ci) => (
                <Pressable
                  key={col}
                  onPress={() => onSort(col)}
                  style={[styles.headCell, { backgroundColor: c.bgRaised,
                                             borderBottomColor: c.border,
                                             width: frozenWidth(col, ci) }]}
                >
                  <Text numberOfLines={1}
                        style={[styles.headText,
                                { color: col === sortCol ? c.text : c.textDim }]}>
                    {label(col)}{arrow(col)}
                  </Text>
                </Pressable>
              ))}
            </View>
            {shown.map((row, i) => (
              <Pressable
                key={i}
                onPress={onRowPress ? () => onRowPress(row) : undefined}
                style={{ flexDirection: "row",
                         backgroundColor: i % 2 ? c.bgSoft : c.bg }}
              >
                {frozenCols.map((col, ci) => (
                  <View
                    key={col}
                    style={[styles.bodyCell, {
                      width: frozenWidth(col, ci),
                      borderBottomColor: c.border,
                    }]}
                  >
                    {render?.[col]
                      ? render[col](row)
                      : <Text numberOfLines={1} style={{ color: c.text, fontSize: font.sm }}>
                          {cellText(col, row)}
                        </Text>}
                  </View>
                ))}
              </Pressable>
            ))}
          </View>

          {/* yana kayan kolonlar */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={snap}
            snapToAlignment="start"
            decelerationRate="fast"
            onLayout={(e) => setViewport(e.nativeEvent.layout.width)}
          >
            <View>
              <View style={{ flexDirection: "row" }}>
                {rest.map((col) => (
                  <Pressable
                    key={col}
                    onPress={() => onSort(col)}
                    style={[styles.headCell, {
                      width: scrollWidthFitted(col), backgroundColor: c.bgRaised,
                      borderBottomColor: c.border, alignItems: "flex-end",
                    }]}
                  >
                    <Text
                      numberOfLines={2}
                      style={[styles.headText, {
                        color: col === sortCol ? c.text : c.textDim,
                        textAlign: "right",
                      }]}
                    >
                      {label(col)}{arrow(col)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {shown.map((row, i) => (
                <Pressable
                  key={i}
                  onPress={onRowPress ? () => onRowPress(row) : undefined}
                  style={{ flexDirection: "row",
                           backgroundColor: i % 2 ? c.bgSoft : c.bg }}
                >
                  {rest.map((col) => (
                    <View
                      key={col}
                      style={[styles.bodyCell, {
                        width: scrollWidthFitted(col), borderBottomColor: c.border,
                        alignItems: "flex-end",
                      }]}
                    >
                      {render?.[col]
                        ? render[col](row)
                        : <Text numberOfLines={1}
                                style={{ color: c.text, fontSize: font.sm }}>
                            {cellText(col, row)}
                          </Text>}
                    </View>
                  ))}
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={{ color: c.textDim, fontSize: font.xs, flex: 1 }}>
          {describe(sortCol) || t("m.swipeHint")}
        </Text>
        {limit < sorted.length ? (
          <Pressable onPress={() => setLimit((l) => l + PAGE * 2)} hitSlop={8}>
            <Text style={{ color: c.link, fontSize: font.sm, fontWeight: "600" }}>
              {t("m.showMore")} ({sorted.length - limit})
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  headCell: {
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: "flex-end",
    minHeight: 42,
  },
  headText: { fontSize: font.xs, fontWeight: "700" },
  bodyCell: {
    paddingHorizontal: space.sm,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    minHeight: 44,
  },
  footer: {
    flexDirection: "row", alignItems: "center", gap: space.md,
    paddingHorizontal: space.xs, paddingTop: space.sm,
  },
});

export default memo(StatTableInner);
