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
  /** İlk kolon sabitlenir; kalanı yatay kayar. */
  columns: string[];
  defaultSort?: string;
  /** Kolon adı -> hücre içeriği (ör. oyuncu adı + pozisyon rozeti). */
  render?: Record<string, (row: StatRow) => ReactNode>;
  /** Satıra dokununca (ör. oyuncu detayına git). */
  onRowPress?: (row: StatRow) => void;
  /** Sabit kolonun genişliği. */
  firstWidth?: number;
  /** Diğer kolonların genişliği. */
  colWidth?: number;
}

function cellText(col: string, row: StatRow): string {
  return fmt(col, row[col]);
}

function StatTableInner({
  rows, columns, defaultSort, render, onRowPress,
  firstWidth = 148, colWidth = 78,
}: StatTableProps) {
  const c = useColors();
  const t = useT();
  const [sortCol, setSortCol] = useState(defaultSort ?? columns[1] ?? columns[0]);
  const [desc, setDesc] = useState(true);
  const [limit, setLimit] = useState(PAGE);

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
  const [first, ...rest] = columns;

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
          {/* sabit ilk kolon */}
          <View style={{ width: firstWidth, borderRightWidth: StyleSheet.hairlineWidth,
                         borderRightColor: c.border }}>
            <Pressable
              onPress={() => onSort(first)}
              style={[styles.headCell, { backgroundColor: c.bgRaised,
                                         borderBottomColor: c.border,
                                         width: firstWidth }]}
            >
              <Text numberOfLines={1}
                    style={[styles.headText, { color: first === sortCol ? c.text : c.textDim }]}>
                {label(first)}{arrow(first)}
              </Text>
            </Pressable>
            {shown.map((row, i) => (
              <Pressable
                key={i}
                onPress={onRowPress ? () => onRowPress(row) : undefined}
                style={[styles.bodyCell, {
                  width: firstWidth,
                  borderBottomColor: c.border,
                  backgroundColor: i % 2 ? c.bgSoft : c.bg,
                }]}
              >
                {render?.[first]
                  ? render[first](row)
                  : <Text numberOfLines={1} style={{ color: c.text, fontSize: font.sm }}>
                      {cellText(first, row)}
                    </Text>}
              </Pressable>
            ))}
          </View>

          {/* yana kayan kolonlar */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <View style={{ flexDirection: "row" }}>
                {rest.map((col) => (
                  <Pressable
                    key={col}
                    onPress={() => onSort(col)}
                    style={[styles.headCell, {
                      width: colWidth, backgroundColor: c.bgRaised,
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
                        width: colWidth, borderBottomColor: c.border,
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
