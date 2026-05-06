import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useNowTick } from "@/hooks/useNowTick";
import type { XtreamCredentials, EpgEntry } from "@/lib/xtream";
import { getChannelEpg } from "@/lib/xtream";

interface EpgSheetProps {
  visible: boolean;
  onClose: () => void;
  channelName: string;
  streamId: number;
  credentials: XtreamCredentials;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function EpgRow({ entry, now }: { entry: EpgEntry; now: number }) {
  // `now` is passed from parent useNowTick — updates every 60 s
  const colors = useColors();
  const duration = entry.endTimestamp - entry.startTimestamp;
  const isLive = duration > 0 && now >= entry.startTimestamp && now < entry.endTimestamp;
  const isPast = now >= entry.endTimestamp;
  const progress =
    isLive && duration > 0
      ? Math.min(1, (now - entry.startTimestamp) / duration)
      : 0;

  return (
    <View
      style={[
        styles.epgRow,
        {
          backgroundColor: isLive ? colors.primary + "18" : "transparent",
          borderLeftColor: isLive ? colors.primary : "transparent",
          borderLeftWidth: 3,
          opacity: isPast ? 0.4 : 1,
        },
      ]}
    >
      <View style={styles.timeCol}>
        <Text style={[styles.timeText, { color: isLive ? colors.primary : colors.textMuted }]}>
          {formatTime(entry.start)}
        </Text>
        <Text style={[styles.timeEnd, { color: colors.textMuted }]}>
          {formatTime(entry.end)}
        </Text>
      </View>

      <View style={styles.programCol}>
        <View style={styles.titleRow}>
          <Text
            style={[
              styles.programTitle,
              { color: isLive ? colors.text : isPast ? colors.textSecondary : colors.text },
              isLive && { fontWeight: "700" },
            ]}
            numberOfLines={2}
          >
            {entry.title || "Unknown program"}
          </Text>
          {isLive && (
            <View style={[styles.liveChip, { backgroundColor: colors.primary }]}>
              <Text style={styles.liveChipText}>LIVE</Text>
            </View>
          )}
        </View>

        {entry.description ? (
          <Text
            style={[styles.programDesc, { color: colors.textMuted }]}
            numberOfLines={2}
          >
            {entry.description}
          </Text>
        ) : null}

        {isLive && (
          <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: colors.primary, width: `${Math.round(progress * 100)}%` },
              ]}
            />
          </View>
        )}
      </View>
    </View>
  );
}

export function EpgSheet({ visible, onClose, channelName, streamId, credentials }: EpgSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const { data: entries, isLoading, error, refetch } = useQuery({
    queryKey: ["epg-full", credentials.host, credentials.username, streamId],
    queryFn: () => getChannelEpg(credentials, streamId),
    enabled: visible && !!streamId,
    staleTime: 1000 * 60 * 30,
  });

  const now = useNowTick(60_000);

  useEffect(() => {
    if (!entries || !visible) return;
    const liveIdx = entries.findIndex(
      (e) => now >= e.startTimestamp && now < e.endTimestamp
    );
    if (liveIdx > 0 && scrollRef.current) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: Math.max(0, (liveIdx - 1) * 90), animated: true });
      }, 300);
    }
  }, [entries, visible]);

  const todayEntries = entries?.filter((e) => {
    const start = new Date(e.startTimestamp * 1000);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    return start >= todayStart && start <= todayEnd;
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />

      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.card,
            paddingBottom: insets.bottom + 16,
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
          <View style={styles.headerLeft}>
            <Feather name="calendar" size={16} color={colors.primary} />
            <View>
              <Text style={[styles.sheetTitle, { color: colors.text }]} numberOfLines={1}>
                {channelName}
              </Text>
              <Text style={[styles.sheetSub, { color: colors.textMuted }]}>
                Today's schedule
              </Text>
            </View>
          </View>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <Feather name="x" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>

        {isLoading && (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>
              Loading schedule…
            </Text>
          </View>
        )}

        {error && !isLoading && (
          <View style={styles.center}>
            <Feather name="alert-circle" size={32} color={colors.textMuted} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>
              No guide available
            </Text>
            <Pressable onPress={() => refetch()} style={[styles.retryBtn, { borderColor: colors.border }]}>
              <Text style={[styles.retryText, { color: colors.textSecondary }]}>Try again</Text>
            </Pressable>
          </View>
        )}

        {!isLoading && !error && (
          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          >
            {!todayEntries || todayEntries.length === 0 ? (
              <View style={styles.center}>
                <Feather name="tv" size={32} color={colors.textMuted} />
                <Text style={[styles.loadingText, { color: colors.textMuted }]}>
                  No guide available for today
                </Text>
              </View>
            ) : (
              todayEntries.map((entry) => (
                <EpgRow key={entry.id} entry={entry} now={now} />
              ))
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: "80%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  sheetTitle: { fontSize: 16, fontWeight: "700", letterSpacing: -0.2 },
  sheetSub: { fontSize: 12, marginTop: 1 },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: { paddingVertical: 8 },
  epgRow: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingRight: 16,
    minHeight: 72,
    gap: 12,
  },
  timeCol: {
    width: 60,
    paddingLeft: 16,
    alignItems: "flex-end",
    gap: 2,
    paddingTop: 2,
  },
  timeText: { fontSize: 13, fontWeight: "600" },
  timeEnd: { fontSize: 11 },
  programCol: { flex: 1, gap: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  programTitle: { fontSize: 14, fontWeight: "500", flex: 1 },
  programDesc: { fontSize: 12, lineHeight: 17 },
  liveChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  liveChipText: { color: "#FFF", fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
    marginTop: 4,
  },
  progressFill: { height: 3, borderRadius: 2 },
  center: { alignItems: "center", justifyContent: "center", padding: 40, gap: 12 },
  loadingText: { fontSize: 14 },
  retryBtn: { marginTop: 4, borderWidth: 1, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
  retryText: { fontSize: 13 },
});
