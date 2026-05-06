import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useNowTick } from "@/hooks/useNowTick";
import { usePlaylist } from "@/context/PlaylistContext";
import {
  buildLiveStreamUrl,
  getChannelEpg,
  getLiveStreams,
  type EpgEntry,
  type XLiveStream,
  type XtreamCredentials,
} from "@/lib/xtream";
import { cleanIptvName } from "@/lib/utils";

// ─── Grid constants ───────────────────────────────────────────────────────────

const CHANNEL_COL_W = 88;
const CELL_W = 120; // px per 30-minute slot
const ROW_H = 68;
const HEADER_H = 40;
const TOTAL_SLOTS = 48; // 24 h × 2 slots/hour
const TOTAL_GRID_W = CELL_W * TOTAL_SLOTS; // 5 760 px
const MAX_ARCHIVE_DAYS = 7;

// ─── Time utilities ───────────────────────────────────────────────────────────

function dayStartSec(offsetDays: number): number {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

function xForTs(ts: number, dayStart: number): number {
  return ((ts - dayStart) / 60 / 30) * CELL_W;
}

function fmtHHMM(tsSec: number): string {
  return new Date(tsSec * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function fmtDayLabel(offset: number): string {
  if (offset === 0) return "Today";
  if (offset === 1) return "Yesterday";
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

// ─── Static data ──────────────────────────────────────────────────────────────

const TIME_LABELS: string[] = Array.from({ length: TOTAL_SLOTS }, (_, i) => {
  const h = Math.floor((i * 30) / 60);
  const m = (i * 30) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

// ─── Per-row EPG skeleton ─────────────────────────────────────────────────────
// Cells are positioned relative to "now" so users see them right where they're looking.

function EpgRowSkeleton({ dayOffset }: { dayOffset: number }) {
  const colors = useColors();
  const dayStart = dayStartSec(dayOffset);
  // Place skeletons centred on the current time (or 10:00 for past days)
  const baseX =
    dayOffset === 0
      ? Math.max(0, xForTs(Math.floor(Date.now() / 1000), dayStart) - CELL_W)
      : xForTs(dayStart + 10 * 3600, dayStart); // 10:00

  const widths = [CELL_W * 3, CELL_W * 2, CELL_W * 4, CELL_W * 1.5];
  let cursor = baseX;

  return (
    <View style={{ width: TOTAL_GRID_W, height: ROW_H }}>
      {widths.map((w, i) => {
        const left = cursor;
        cursor += w + 4;
        return (
          <View
            key={i}
            style={[
              styles.skeletonCell,
              {
                left,
                width: w - 4,
                backgroundColor: colors.surfaceHigh,
                opacity: 1 - i * 0.18,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

// ─── Time ruler ───────────────────────────────────────────────────────────────

interface TimeHeaderProps {
  scrollRef: React.RefObject<ScrollView | null>;
  onScroll: (x: number) => void;
  nowLineX: number | null;
}

function TimeHeader({ scrollRef, onScroll, nowLineX }: TimeHeaderProps) {
  const colors = useColors();
  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={(e) => onScroll(e.nativeEvent.contentOffset.x)}
      style={{ flex: 1, height: HEADER_H }}
    >
      <View style={{ width: TOTAL_GRID_W, height: HEADER_H, flexDirection: "row" }}>
        {TIME_LABELS.map((label, i) => (
          <View
            key={i}
            style={[styles.timeSlot, { width: CELL_W, borderRightColor: colors.border }]}
          >
            <Text style={[styles.timeSlotText, { color: colors.textMuted }]}>{label}</Text>
          </View>
        ))}
        {nowLineX !== null && nowLineX >= 0 && nowLineX <= TOTAL_GRID_W && (
          <View style={[styles.nowLine, { left: nowLineX, backgroundColor: colors.destructive }]}>
            <View style={[styles.nowDot, { backgroundColor: colors.destructive }]} />
          </View>
        )}
      </View>
    </ScrollView>
  );
}

// ─── Programme cell ───────────────────────────────────────────────────────────

interface ProgrammeCellProps {
  entry: EpgEntry;
  dayStart: number;
  now: number;
  onPress: (entry: EpgEntry) => void;
}

function ProgrammeCell({ entry, dayStart, now, onPress }: ProgrammeCellProps) {
  const colors = useColors();

  const rawX = xForTs(entry.startTimestamp, dayStart);
  const rawRight = xForTs(entry.endTimestamp, dayStart);
  const x = Math.max(0, rawX);
  const w = rawRight - x;
  if (w < 3) return null;

  const isNow = now >= entry.startTimestamp && now < entry.endTimestamp;
  const isPast = now >= entry.endTimestamp;

  return (
    <Pressable
      onPress={() => onPress(entry)}
      style={[
        styles.cell,
        {
          left: x,
          width: w - 2,
          backgroundColor: isNow
            ? colors.primary + "28"
            : isPast
            ? colors.surfaceHigh + "50"
            : colors.surface,
          borderColor: isNow ? colors.primary + "70" : colors.border,
        },
      ]}
    >
      <Text
        style={[
          styles.cellTitle,
          {
            color: isNow ? colors.text : isPast ? colors.textMuted : colors.textSecondary,
            fontWeight: isNow ? "600" : "400",
          },
        ]}
        numberOfLines={2}
      >
        {entry.title || "—"}
      </Text>
      <Text style={[styles.cellTime, { color: colors.textMuted }]}>
        {fmtHHMM(entry.startTimestamp)}
      </Text>
    </Pressable>
  );
}

// ─── EPG channel row ──────────────────────────────────────────────────────────

interface EpgChannelRowProps {
  channel: XLiveStream;
  credentials: XtreamCredentials;
  dayOffset: number;
  now: number;
  nowLineX: number | null;
  isVisible: boolean;
  scrollXRef: React.MutableRefObject<number>;
  onRegisterRef: (id: number, ref: ScrollView | null) => void;
  onRowScroll: (x: number, sourceId: number) => void;
  onChannelPress: (channel: XLiveStream) => void;
  onProgrammePress: (entry: EpgEntry, channelName: string, streamId: number) => void;
  onEpgLoaded: (entries: EpgEntry[]) => void;
}

const EpgChannelRow = memo(function EpgChannelRow({
  channel,
  credentials,
  dayOffset,
  now,
  nowLineX,
  isVisible,
  scrollXRef,
  onRegisterRef,
  onRowScroll,
  onChannelPress,
  onProgrammePress,
  onEpgLoaded,
}: EpgChannelRowProps) {
  const colors = useColors();
  const dayStart = dayStartSec(dayOffset);
  const dayEnd = dayStart + 86400;

  const { data: allEpg, isLoading } = useQuery({
    queryKey: ["epg-full", credentials.host, credentials.username, channel.stream_id],
    queryFn: () => getChannelEpg(credentials, channel.stream_id),
    staleTime: 1000 * 60 * 30,
    retry: false,
    enabled: isVisible, // ← lazy: only fetch when the row enters the viewport
  });

  // Notify parent when EPG data arrives so it can compute archive day range
  const reportedRef = useRef(false);
  useEffect(() => {
    if (allEpg && allEpg.length > 0 && !reportedRef.current) {
      reportedRef.current = true;
      onEpgLoaded(allEpg);
    }
  }, [allEpg, onEpgLoaded]);

  const entries = useMemo(() => {
    if (!allEpg) return [];
    return allEpg.filter(
      (e) => e.startTimestamp < dayEnd && e.endTimestamp > dayStart
    );
  }, [allEpg, dayStart, dayEnd]);

  const handleRef = useCallback(
    (ref: ScrollView | null) => {
      onRegisterRef(channel.stream_id, ref);
    },
    [channel.stream_id, onRegisterRef]
  );

  const handleScroll = useCallback(
    (x: number) => {
      onRowScroll(x, channel.stream_id);
    },
    [channel.stream_id, onRowScroll]
  );

  return (
    <View style={[styles.rowWrap, { borderBottomColor: colors.border }]}>
      {/* Fixed channel info column */}
      <Pressable
        onPress={() => onChannelPress(channel)}
        style={[styles.channelCol, { borderRightColor: colors.border }]}
      >
        {channel.stream_icon ? (
          <Image
            source={{ uri: channel.stream_icon }}
            style={styles.channelLogo}
            contentFit="contain"
          />
        ) : (
          <View style={[styles.channelLogoPlaceholder, { backgroundColor: colors.surfaceHigh }]}>
            <Feather name="tv" size={14} color={colors.textMuted} />
          </View>
        )}
        <Text style={[styles.channelName, { color: colors.textSecondary }]} numberOfLines={2}>
          {cleanIptvName(channel.name)}
        </Text>
      </Pressable>

      {/* Horizontally scrollable programme cells */}
      <ScrollView
        ref={handleRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => handleScroll(e.nativeEvent.contentOffset.x)}
        style={{ flex: 1 }}
        contentContainerStyle={{ width: TOTAL_GRID_W, height: ROW_H }}
      >
        <View style={{ width: TOTAL_GRID_W, height: ROW_H }}>
          {/* Loading state: per-row skeleton */}
          {isLoading && <EpgRowSkeleton dayOffset={dayOffset} />}

          {/* No EPG data */}
          {!isLoading && isVisible && entries.length === 0 && allEpg !== undefined && (
            <View style={styles.rowEmpty}>
              <Text style={[styles.rowEmptyText, { color: colors.textMuted }]}>
                No guide available
              </Text>
            </View>
          )}

          {/* Not yet requested (waiting to scroll into view) */}
          {!isVisible && !allEpg && (
            <View style={styles.rowEmpty}>
              <Text style={[styles.rowEmptyText, { color: colors.surfaceHigh }]}>· · ·</Text>
            </View>
          )}

          {/* Programme cells */}
          {entries.map((entry) => (
            <ProgrammeCell
              key={entry.id}
              entry={entry}
              dayStart={dayStart}
              now={now}
              onPress={(e) => onProgrammePress(e, channel.name, channel.stream_id)}
            />
          ))}

          {/* Now indicator line */}
          {nowLineX !== null && nowLineX >= 0 && nowLineX <= TOTAL_GRID_W && (
            <View
              style={[styles.nowLine, { left: nowLineX, backgroundColor: colors.destructive }]}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
});

// ─── Programme detail sheet ───────────────────────────────────────────────────

interface ProgrammeDetail {
  entry: EpgEntry;
  channelName: string;
  credentials: XtreamCredentials;
  streamId: number;
}

interface DetailSheetProps {
  detail: ProgrammeDetail | null;
  now: number;
  onClose: () => void;
}

function ProgrammeDetailSheet({ detail, now, onClose }: DetailSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  if (!detail) return null;

  const { entry, channelName, credentials, streamId } = detail;
  const isLive = now >= entry.startTimestamp && now < entry.endTimestamp;
  const durationMin = Math.round((entry.endTimestamp - entry.startTimestamp) / 60);
  const progress =
    isLive && durationMin > 0
      ? Math.min(1, (now - entry.startTimestamp) / (entry.endTimestamp - entry.startTimestamp))
      : 0;

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.detailBackdrop} onPress={onClose} />
      <View
        style={[
          styles.detailSheet,
          { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, 16) + 8 },
        ]}
      >
        <View style={[styles.detailHandle, { backgroundColor: colors.border }]} />

        <View style={styles.detailHeader}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.detailChannel, { color: colors.primary }]} numberOfLines={1}>
              {cleanIptvName(channelName)}
            </Text>
            <Text style={[styles.detailTitle, { color: colors.text }]} numberOfLines={3}>
              {entry.title || "Unknown Programme"}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <Feather name="x" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.metaRow}>
          <View style={[styles.metaChip, { backgroundColor: colors.background }]}>
            <Feather name="clock" size={12} color={colors.textMuted} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              {fmtHHMM(entry.startTimestamp)} – {fmtHHMM(entry.endTimestamp)}
            </Text>
          </View>
          <View style={[styles.metaChip, { backgroundColor: colors.background }]}>
            <Feather name="film" size={12} color={colors.textMuted} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>{durationMin} min</Text>
          </View>
          {isLive && (
            <View style={[styles.metaChip, { backgroundColor: colors.primary }]}>
              <Text style={[styles.metaText, { color: "#FFF", fontWeight: "700" }]}>LIVE</Text>
            </View>
          )}
        </View>

        {isLive && (
          <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: colors.primary,
                  width: `${Math.round(progress * 100)}%` as `${number}%`,
                },
              ]}
            />
          </View>
        )}

        {entry.description ? (
          <Text style={[styles.detailDesc, { color: colors.textSecondary }]}>
            {entry.description}
          </Text>
        ) : null}

        {isLive && (
          <Pressable
            onPress={() => {
              onClose();
              const url = buildLiveStreamUrl(credentials, streamId);
              router.push(
                `/player?url=${encodeURIComponent(url)}&title=${encodeURIComponent(
                  entry.title || channelName
                )}&type=live`
              );
            }}
            style={({ pressed }) => [
              styles.watchBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Feather name="play" size={16} color="#FFF" />
            <Text style={styles.watchBtnText}>Watch Now</Text>
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function EpgScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { credentials } = usePlaylist();
  const queryClient = useQueryClient();
  const now = useNowTick(30_000);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [selectedDay, setSelectedDay] = useState(0);
  const [detail, setDetail] = useState<ProgrammeDetail | null>(null);

  // ── Dynamic archive day range ───────────────────────────────────────────────
  // Starts at 1 (Today only). Grows as EPG data reveals the provider's actual
  // archive depth. Never shrinks — ensures partial early samples from short-EPG
  // channels don't permanently hide valid archive days.
  const [availableDays, setAvailableDays] = useState(1);

  const handleEpgLoaded = useCallback((entries: EpgEntry[]) => {
    if (entries.length === 0) return;
    const earliest = Math.min(...entries.map((e) => e.startTimestamp));
    const nowSec = Math.floor(Date.now() / 1000);
    const daysBack = Math.min(MAX_ARCHIVE_DAYS - 1, Math.floor((nowSec - earliest) / 86400));
    const newCount = daysBack + 1; // +1 for Today
    setAvailableDays((prev) => Math.max(prev, newCount)); // only ever expand
  }, []);

  const dayOptions = useMemo(
    () =>
      Array.from({ length: availableDays }, (_, i) => ({
        offset: i,
        label: fmtDayLabel(i),
      })),
    [availableDays]
  );

  // Keep selectedDay in range if availableDays shrinks
  useEffect(() => {
    if (selectedDay >= availableDays) setSelectedDay(availableDays - 1);
  }, [availableDays, selectedDay]);

  // ── Scroll sync refs ────────────────────────────────────────────────────────
  const scrollXRef = useRef(0);
  const isSyncingRef = useRef(false);
  const timeScrollRef = useRef<ScrollView>(null);
  const rowScrollRefs = useRef<Map<number, ScrollView | null>>(new Map());

  // ── Initial X: position "now" at ~1/3 from the left of the grid ────────────
  const initialX = useMemo(() => {
    const dayStart = dayStartSec(0);
    const nowX = xForTs(now, dayStart);
    return Math.max(0, nowX - (width - CHANNEL_COL_W) / 3);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Now-line X position ─────────────────────────────────────────────────────
  const nowLineX = useMemo(
    () => (selectedDay === 0 ? xForTs(now, dayStartSec(0)) : null),
    [now, selectedDay]
  );

  // ── Channel data — uses cache pre-populated by live.tsx's prefetchQuery ─────
  const { data: channels, isLoading: channelsLoading } = useQuery({
    queryKey: ["xtream-live-streams", credentials?.host, credentials?.username, "all"],
    queryFn: () => getLiveStreams(credentials!),
    enabled: !!credentials,
    staleTime: 1000 * 60 * 10,
    // Seed with any cached result we already have from Live TV's "All" category
    initialData: () =>
      queryClient.getQueryData<XLiveStream[]>([
        "xtream-live-streams",
        credentials?.host,
        credentials?.username,
        "all",
      ]),
  });

  // ── Viewport-driven lazy EPG loading ────────────────────────────────────────
  // `visibleIds` accumulates IDs that have EVER been in the viewport.
  // We only add, never remove, so TQ only fetches each channel once.
  const [visibleIds, setVisibleIds] = useState<ReadonlySet<number>>(new Set<number>());

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const incoming = viewableItems
        .filter((vt) => vt.isViewable)
        .map((vt) => (vt.item as XLiveStream).stream_id);
      if (incoming.length === 0) return;
      setVisibleIds((prev) => {
        let changed = false;
        const next = new Set(prev);
        for (const id of incoming) {
          if (!next.has(id)) { next.add(id); changed = true; }
        }
        return changed ? next : prev;
      });
    },
    []
  );

  // viewabilityConfig must be a stable ref (FlatList freezes it after mount)
  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 10 });

  // ── Scroll sync handlers ────────────────────────────────────────────────────
  const syncAll = useCallback((x: number, skipId?: number) => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    scrollXRef.current = x;
    if (skipId !== undefined) {
      // Source was a row — sync time header
      timeScrollRef.current?.scrollTo({ x, animated: false });
    }
    rowScrollRefs.current.forEach((ref, id) => {
      if (id !== skipId) ref?.scrollTo({ x, animated: false });
    });
    isSyncingRef.current = false;
  }, []);

  const handleTimeHeaderScroll = useCallback((x: number) => syncAll(x), [syncAll]);
  const handleRowScroll = useCallback(
    (x: number, sourceId: number) => syncAll(x, sourceId),
    [syncAll]
  );

  const handleRegisterRef = useCallback((id: number, ref: ScrollView | null) => {
    if (ref) {
      rowScrollRefs.current.set(id, ref);
      // Immediately position the newly-mounted row at the current scroll offset
      setTimeout(() => ref.scrollTo({ x: scrollXRef.current, animated: false }), 50);
    } else {
      rowScrollRefs.current.delete(id);
    }
  }, []);

  // ── Reset scroll to day-start (x=0) whenever the day selector changes ───────
  // The initial auto-scroll to "now" is handled separately on mount only.
  const isInitialMountRef = useRef(true);
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return; // skip on initial mount — let the mount effect scroll to "now"
    }
    setTimeout(() => syncAll(0), 100); // every day switch resets to 00:00
  }, [selectedDay, syncAll]);

  // ── Initial scroll to "now" (once, on mount) ────────────────────────────────
  useEffect(() => {
    setTimeout(() => syncAll(initialX), 300);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Stable renderItem callbacks ─────────────────────────────────────────────
  // Channel column tap → navigate to Live TV and pass the stream ID so Live TV
  // can select and auto-play the exact channel the user tapped.
  const handleChannelPress = useCallback((channel: XLiveStream) => {
    router.navigate({
      pathname: "/(tabs)/live",
      params: {
        autoPlayId: String(channel.stream_id),
        autoPlayTs: String(Date.now()), // unique per tap so repeat same-channel works
      },
    });
  }, []);

  const handleProgrammePress = useCallback(
    (entry: EpgEntry, channelName: string, streamId: number) => {
      if (!credentials) return;
      setDetail({ entry, channelName, credentials, streamId });
    },
    [credentials]
  );

  const keyExtractor = useCallback((item: XLiveStream) => String(item.stream_id), []);
  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({ length: ROW_H, offset: ROW_H * index, index }),
    []
  );

  const renderItem = useCallback(
    ({ item }: { item: XLiveStream }) => {
      if (!credentials) return null;
      return (
        <EpgChannelRow
          channel={item}
          credentials={credentials}
          dayOffset={selectedDay}
          now={now}
          nowLineX={nowLineX}
          isVisible={visibleIds.has(item.stream_id)}
          scrollXRef={scrollXRef}
          onRegisterRef={handleRegisterRef}
          onRowScroll={handleRowScroll}
          onChannelPress={handleChannelPress}
          onProgrammePress={handleProgrammePress}
          onEpgLoaded={handleEpgLoaded}
        />
      );
    },
    [
      credentials, selectedDay, now, nowLineX, visibleIds,
      handleRegisterRef, handleRowScroll, handleChannelPress,
      handleProgrammePress, handleEpgLoaded,
    ]
  );

  // ── No Xtream playlist ──────────────────────────────────────────────────────
  if (!credentials) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.topBar, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <Feather name="chevron-left" size={24} color={colors.text} />
          </Pressable>
          <Text style={[styles.screenTitle, { color: colors.text }]}>TV Guide</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.center}>
          <Feather name="tv" size={40} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Add an Xtream playlist to view the TV Guide
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Feather name="chevron-left" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.screenTitle, { color: colors.text }]}>TV Guide</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Day selector — only shows days covered by the provider's archive */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={styles.daySelector}
      >
        {dayOptions.map((day) => (
          <Pressable
            key={day.offset}
            onPress={() => setSelectedDay(day.offset)}
            style={[
              styles.dayPill,
              {
                backgroundColor: selectedDay === day.offset ? colors.primary : colors.surface,
                borderColor: selectedDay === day.offset ? colors.primary : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.dayPillText,
                { color: selectedDay === day.offset ? "#FFF" : colors.textSecondary },
              ]}
            >
              {day.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Column header: channel-col spacer + time ruler */}
      <View
        style={[
          styles.gridHeaderRow,
          { borderBottomColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <View style={[styles.channelColHeader, { borderRightColor: colors.border }]}>
          <Feather name="tv" size={13} color={colors.textMuted} />
        </View>
        <TimeHeader
          scrollRef={timeScrollRef}
          onScroll={handleTimeHeaderScroll}
          nowLineX={nowLineX}
        />
      </View>

      {/* Channel rows */}
      {channelsLoading ? (
        <View style={styles.center}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>Loading channels…</Text>
        </View>
      ) : !channels || channels.length === 0 ? (
        <View style={styles.center}>
          <Feather name="tv" size={36} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No channels available</Text>
        </View>
      ) : (
        <FlatList
          data={channels}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          initialNumToRender={14}
          maxToRenderPerBatch={8}
          windowSize={5}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig.current}
        />
      )}

      {detail && (
        <ProgrammeDetailSheet detail={detail} now={now} onClose={() => setDetail(null)} />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  screenTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700" },

  daySelector: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  dayPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  dayPillText: { fontSize: 13, fontWeight: "500" },

  gridHeaderRow: { flexDirection: "row", height: HEADER_H, borderBottomWidth: 1 },
  channelColHeader: {
    width: CHANNEL_COL_W,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: StyleSheet.hairlineWidth,
  },

  timeSlot: {
    width: CELL_W,
    height: HEADER_H,
    justifyContent: "center",
    paddingLeft: 8,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  timeSlotText: { fontSize: 11, fontWeight: "500" },

  nowLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    zIndex: 10,
  },
  nowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: "absolute",
    top: 0,
    left: -3,
  },

  // Skeleton cells (used by EpgRowSkeleton)
  skeletonCell: {
    position: "absolute",
    top: 4,
    bottom: 4,
    borderRadius: 6,
  },

  rowWrap: { flexDirection: "row", height: ROW_H, borderBottomWidth: StyleSheet.hairlineWidth },
  channelCol: {
    width: CHANNEL_COL_W,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 6,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  channelLogo: { width: 36, height: 28, borderRadius: 4 },
  channelLogoPlaceholder: {
    width: 36,
    height: 28,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  channelName: { fontSize: 9, textAlign: "center", lineHeight: 12 },

  cell: {
    position: "absolute",
    top: 4,
    bottom: 4,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 6,
    paddingVertical: 5,
    overflow: "hidden",
    justifyContent: "space-between",
  },
  cellTitle: { fontSize: 11, lineHeight: 14 },
  cellTime: { fontSize: 9 },

  rowEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  rowEmptyText: { fontSize: 11, fontStyle: "italic" },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontSize: 14, textAlign: "center", paddingHorizontal: 32 },

  // Detail sheet
  detailBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
  detailSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 12,
  },
  detailHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  detailHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  closeBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  detailChannel: { fontSize: 12, fontWeight: "600" },
  detailTitle: { fontSize: 18, fontWeight: "700", lineHeight: 24 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  metaText: { fontSize: 12 },
  progressTrack: { height: 3, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: 3, borderRadius: 2 },
  detailDesc: { fontSize: 14, lineHeight: 21 },
  watchBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 4,
  },
  watchBtnText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
});
