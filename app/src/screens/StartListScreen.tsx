import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fonts, spacing } from "../theme/colors";
import { ensureSession } from "../lib/ensureSession";
import { fetchStartList, StartListRow } from "../lib/startList";
import { formatEditionDate, formatStartClock } from "../lib/time";

const EDITION_YEAR = 2027;

export default function StartListScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editionStartTime, setEditionStartTime] = useState<string | null>(null);
  const [rows, setRows] = useState<StartListRow[]>([]);

  const load = useCallback(async () => {
    try {
      setError(null);
      await ensureSession();
      const result = await fetchStartList(EDITION_YEAR);
      if (!result) {
        setError(`Hittade ingen upplaga för ${EDITION_YEAR}`);
        setRows([]);
        return;
      }
      setEditionStartTime(result.edition.startTime);
      setRows(result.rows);
    } catch (e: any) {
      setError(e?.message ?? "Något gick fel");
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Text style={styles.kicker}>16:E UPPLAGAN · JAKTSTART</Text>
        <Text style={styles.date}>
          {editionStartTime ? formatEditionDate(editionStartTime) : `${EDITION_YEAR}`}
        </Text>
        <Text style={styles.subtitle}>Start kl. 09:00 · omvänd jaktstart</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <>
          <Text style={styles.section}>STARTORDNING · BEKRÄFTADE</Text>
          <FlatList
            data={rows}
            keyExtractor={(item) => item.runnerId}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={
              <View style={styles.centered}>
                <Text style={styles.errorText}>Ingen startlista beräknad än</Text>
              </View>
            }
            renderItem={({ item, index }) => {
              const isFirst = index === 0;
              const isLast = index === rows.length - 1;
              const metaParts: string[] = [];
              if (item.hostCount > 0) metaParts.push("★".repeat(item.hostCount));
              if (isFirst) metaParts.push("Startar först");
              if (isLast) metaParts.push("Startar sist");
              return (
                <View style={styles.row}>
                  <Text style={styles.num}>{index + 1}</Text>
                  <View style={styles.who}>
                    <Text style={styles.name} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {metaParts.length > 0 ? (
                      <Text style={styles.meta} numberOfLines={1}>
                        {metaParts.join(" · ")}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[styles.time, { color: isFirst ? colors.foreground : colors.mutedForeground }]}>
                    {editionStartTime ? formatStartClock(editionStartTime, item.startOffsetSec) : "--:--:--"}
                  </Text>
                </View>
              );
            }}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 2,
    borderBottomColor: colors.foreground,
  },
  kicker: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    letterSpacing: 0.8,
    color: colors.link,
    marginBottom: 8,
  },
  date: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 32,
    color: colors.foreground,
    marginBottom: 6,
  },
  subtitle: { fontFamily: fonts.body, fontSize: 14.5, color: colors.mutedForeground },
  section: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.disabledIcon,
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.xl,
    paddingTop: 11,
    paddingBottom: 7,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 13,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background,
  },
  separator: { height: 1, backgroundColor: colors.faintBorder },
  num: {
    fontFamily: fonts.display,
    fontSize: 25,
    width: 28,
    color: colors.primary,
    fontVariant: ["tabular-nums"],
  },
  who: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.foreground },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  time: { fontFamily: fonts.mono, fontSize: 13, minWidth: 64, textAlign: "right" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  errorText: { fontFamily: fonts.body, fontSize: 14, color: colors.mutedForeground, textAlign: "center" },
});
