import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChannelCard } from "@/components/ChannelCard";
import { EpgSheet } from "@/components/EpgSheet";
import { EmptyState, ErrorState } from "@/components/ErrorState";
import { LoadingList } from "@/components/LoadingGrid";
import { useAuth } from "@/context/AuthContext";
import { usePlaylist } from "@/context/PlaylistContext";
import { useColors } from "@/hooks/useColors";
import { useNowTick } from "@/hooks/useNowTick";
import { fetchAndParseM3U, type M3UChannel } from "@/lib/m3u";
import type { M3UPlaylist } from "@/lib/playlist-types";
import {
  addToWatchHistory,
  loadWatchHistory,
  removeFromWatchHistory,
  type WatchHistoryEntry,
} from "@/lib/storage";
import { cleanIptvName } from "@/lib/utils";
import {
  buildLiveStreamUrl,
  getLiveCategories,
  getLiveStreams,
  getShortEpg,
  type EpgEntry,
  type XLiveStream,
  type XtreamCredentials,
} from "@/lib/xtream";

// ─── Category color palette ───────────────────────────────────────────────────

const CAT_COLORS = [
  "#0A84FF", "#30D158", "#FF9F0A", "#FF375F",
  "#BF5AF2", "#32ADE6", "#FF6961", "#5E5CE6",
  "#AC8E68", "#2CD9C5",
];

function catColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = Math.imul(31, h) + name.charCodeAt(i) | 0;
  return CAT_COLORS[Math.abs(h) % CAT_COLORS.length];
}

// ─── Left rail item ───────────────────────────────────────────────────────────

interface Category { id: string; name: string; }

function RailItem({
  cat,
  isActive,
  onPress,
  colors,
}: {
  cat: Category;
  isActive: boolean;
  onPress: () => void;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  const isAll = cat.id === "all";
  const accent = isAll ? colors.primary : catColor(cat.name);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.railItem,
        isActive && { backgroundColor: colors.primary + "12" },
        pressed && !isActive && { backgroundColor: colors.surfaceHigh + "60" },
      ]}
    >
      {isActive && (
        <View style={[styles.railBar, { backgroundColor: colors.primary }]} />
      )}
      <View
        style={[
          styles.railIcon,
          { backgroundColor: isActive ? accent + "28" : colors.surfaceHigh },
        ]}
      >
        {isAll ? (
          <Feather
            name="grid"
            size={14}
            color={isActive ? colors.primary : colors.textMuted}
          />
        ) : (
          <Text style={[styles.railInitial, { color: isActive ? accent : colors.textMuted }]}>
            {(cat.name[0] ?? "?").toUpperCase()}
          </Text>
        )}
      </View>
      <Text
        style={[
          styles.railName,
          { color: isActive ? colors.text : colors.textMuted },
          isActive && styles.railNameActive,
        ]}
        numberOfLines={2}
      >
        {cat.name}
      </Text>
    </Pressable>
  );
}

// ─── Recently watched row ─────────────────────────────────────────────────────

function RecentlyWatchedRow({
  history,
  playingId,
  onPress,
  onRemove,
}: {
  history: WatchHistoryEntry[];
  playingId: string | null;
  onPress: (e: WatchHistoryEntry) => void;
  onRemove: (e: WatchHistoryEntry) => void;
}) {
  const colors = useColors();
  if (history.length === 0) return null;
  return (
    <View style={styles.recentSection}>
      <Text style={[styles.recentLabel, { color: colors.textMuted }]}>RECENTLY WATCHED</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.recentRow}
      >
        {history.map((entry) => {
          const playing = playingId === entry.channelId;
          return (
            <Pressable
              key={entry.channelId}
              onPress={() => onPress(entry)}
              onLongPress={() => onRemove(entry)}
              delayLongPress={400}
              style={({ pressed }) => [
                styles.recentCard,
                {
                  backgroundColor: playing
                    ? colors.primary + "18"
                    : pressed
                    ? colors.surfaceHigh
                    : colors.surface,
                  borderColor: playing ? colors.primary + "60" : colors.border,
                },
              ]}
            >
              <View style={[styles.recentLogoWrap, { backgroundColor: colors.background }]}>
                <Image
                  source={{ uri: entry.channelIcon }}
                  style={styles.recentLogo}
                  contentFit="contain"
                />
                {playing && (
                  <View style={[styles.recentLiveDot, { backgroundColor: colors.primary }]} />
                )}
              </View>
              <Text
                style={[
                  styles.recentName,
                  { color: playing ? colors.primary : colors.textSecondary },
                ]}
                numberOfLines={2}
              >
                {cleanIptvName(entry.channelName)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Xtream channel row with lazy EPG ────────────────────────────────────────

function XtreamChannelRow({
  item,
  isActive,
  isLastWatched,
  credentials,
  onPress,
  onGuidePress,
  now,
}: {
  item: XLiveStream;
  isActive: boolean;
  isLastWatched: boolean;
  credentials: XtreamCredentials;
  onPress: () => void;
  onGuidePress: () => void;
  now: number;
}) {
  const { data: epgEntries } = useQuery<EpgEntry[]>({
    queryKey: ["epg-short", credentials.host, credentials.username, item.stream_id],
    queryFn: () => getShortEpg(credentials, item.stream_id),
    staleTime: 1000 * 60 * 30,
    retry: false,
  });

  const epgNow = useMemo<EpgEntry | null>(() => {
    if (!epgEntries?.length) return null;
    return (
      epgEntries.find((e) => now >= e.startTimestamp && now < e.endTimestamp) ??
      epgEntries[0] ??
      null
    );
  }, [epgEntries, now]);

  return (
    <ChannelCard
      channel={{ id: String(item.stream_id), name: item.name, icon: item.stream_icon, category_id: item.category_id }}
      isActive={isActive}
      isLastWatched={isLastWatched}
      epgNow={epgNow}
      now={now}
      onPress={onPress}
      onGuidePress={onGuidePress}
    />
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function LiveScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isActive } = useAuth();
  const { activePlaylist, credentials, hasCredentials } = usePlaylist();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [epgSheet, setEpgSheet] = useState<{ streamId: number; name: string } | null>(null);
  const [watchHistory, setWatchHistory] = useState<WatchHistoryEntry[]>([]);
  const autoSelectedRef = useRef(false);
  const now = useNowTick(60_000);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const activePlaylistId = activePlaylist?.id ?? null;

  // Reset selection state whenever the active playlist changes
  useEffect(() => {
    autoSelectedRef.current = false;
    setSelectedCategory(null);
    setSearch("");
    setPlayingId(null);
  }, [activePlaylistId]);

  const isXtream = activePlaylist?.type === "xtream";
  const isM3U = activePlaylist?.type === "m3u";
  const xtreamEnabled = isActive && isXtream && !!credentials;
  const m3uEnabled = isActive && isM3U;
  const m3uUrl = isM3U ? (activePlaylist as M3UPlaylist).url : "";

  const reloadHistory = useCallback(() => {
    if (!activePlaylist) { setWatchHistory([]); return; }
    loadWatchHistory(activePlaylist.id).then(setWatchHistory);
  }, [activePlaylist?.id]);

  useFocusEffect(reloadHistory);

  // ── Queries ──────────────────────────────────────────────────────────────

  const {
    data: xtreamCategories,
    isLoading: xtreamCatsLoading,
  } = useQuery({
    queryKey: ["xtream-live-cats", credentials?.host, credentials?.username],
    queryFn: () => getLiveCategories(credentials!),
    enabled: xtreamEnabled,
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });

  const {
    data: xtreamChannels,
    isLoading: xtreamLoading,
    error: xtreamError,
    refetch: refetchXtream,
  } = useQuery({
    queryKey: ["xtream-live-streams", credentials?.host, credentials?.username, selectedCategory],
    queryFn: () =>
      getLiveStreams(credentials!, selectedCategory === "all" ? undefined : selectedCategory!),
    enabled: xtreamEnabled && selectedCategory !== null,
    staleTime: 1000 * 60 * 10,
  });

  const {
    data: m3uData,
    isLoading: m3uLoading,
    error: m3uError,
    refetch: refetchM3U,
  } = useQuery({
    queryKey: ["m3u-parsed", m3uUrl],
    queryFn: () => fetchAndParseM3U(m3uUrl),
    enabled: m3uEnabled,
    staleTime: 1000 * 60 * 30,
  });

  // ── Categories ────────────────────────────────────────────────────────────

  const allCategories = useMemo((): Category[] => {
    const all = { id: "all", name: "All" };
    if (isXtream) {
      return [all, ...(xtreamCategories ?? []).map((c) => ({ id: c.category_id, name: c.category_name }))];
    }
    return [all, ...(m3uData?.categories ?? []).map((c) => ({ id: c.id, name: c.name }))];
  }, [isXtream, xtreamCategories, m3uData]);

  // Auto-select: M3U → "all"; Xtream → first real category to avoid loading all channels
  useEffect(() => {
    if (isM3U && selectedCategory === null) {
      setSelectedCategory("all");
    }
  }, [isM3U, selectedCategory]);

  useEffect(() => {
    if (!isXtream || autoSelectedRef.current) return;
    if (allCategories.length > 1) {
      // Real categories loaded — pick the first real one
      autoSelectedRef.current = true;
      setSelectedCategory(allCategories[1]?.id ?? "all");
    } else if (!xtreamCatsLoading && xtreamEnabled) {
      // Categories query settled but returned nothing (wrong credentials, CORS,
      // or server error) — fall back to "all" so the channels query runs and
      // shows a proper error / retry button instead of leaving the user stuck
      // on "← Select a category".
      autoSelectedRef.current = true;
      setSelectedCategory("all");
    }
  }, [isXtream, allCategories, xtreamCatsLoading, xtreamEnabled]);

  // ── Filtering ─────────────────────────────────────────────────────────────

  const isLoading = isXtream ? xtreamLoading : m3uLoading;
  const error = isXtream ? xtreamError : m3uError;
  const refetch = isXtream ? refetchXtream : refetchM3U;

  const filteredXtream = useMemo((): XLiveStream[] => {
    if (!isXtream || !xtreamChannels) return [];
    const q = search.toLowerCase().trim();
    return q ? xtreamChannels.filter((c) => c.name.toLowerCase().includes(q)) : xtreamChannels;
  }, [isXtream, xtreamChannels, search]);

  const filteredM3U = useMemo((): M3UChannel[] => {
    if (!isM3U || !m3uData) return [];
    const base =
      selectedCategory === "all"
        ? m3uData.channels
        : m3uData.channels.filter((c) => c.group === selectedCategory);
    const q = search.toLowerCase().trim();
    return q ? base.filter((c) => c.name.toLowerCase().includes(q)) : base;
  }, [isM3U, m3uData, selectedCategory, search]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const persistAndPlay = useCallback(
    (channelId: string, channelName: string, channelIcon: string, playUrl: string, title: string) => {
      if (activePlaylist) {
        const entry: WatchHistoryEntry = { playlistId: activePlaylist.id, channelId, channelName, channelIcon };
        addToWatchHistory(entry).then(() => {
          if (activePlaylist) loadWatchHistory(activePlaylist.id).then(setWatchHistory);
        });
      }
      setPlayingId(channelId);
      router.push(`/player?url=${encodeURIComponent(playUrl)}&title=${encodeURIComponent(title)}&type=live`);
    },
    [activePlaylist]
  );

  const handleXtreamPress = useCallback(
    (item: XLiveStream) => {
      if (!credentials) return;
      const url = buildLiveStreamUrl(credentials, item.stream_id);
      persistAndPlay(String(item.stream_id), item.name, item.stream_icon, url, item.name);
    },
    [credentials, persistAndPlay]
  );

  const handleRecentPress = useCallback(
    (entry: WatchHistoryEntry) => {
      if (isXtream && credentials) {
        const url = buildLiveStreamUrl(credentials, parseInt(entry.channelId, 10));
        persistAndPlay(entry.channelId, entry.channelName, entry.channelIcon, url, entry.channelName);
      } else if (isM3U && m3uData) {
        const ch = m3uData.channels.find((c) => c.id === entry.channelId);
        if (ch) persistAndPlay(ch.id, ch.name, ch.icon, ch.url, ch.name);
      }
    },
    [isXtream, isM3U, credentials, m3uData, persistAndPlay]
  );

  const handleRemoveRecent = useCallback(
    (entry: WatchHistoryEntry) => {
      if (!activePlaylist) return;
      Alert.alert(
        "Remove from History",
        `Remove "${cleanIptvName(entry.channelName)}" from recently watched?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: () => {
              removeFromWatchHistory(activePlaylist.id, entry.channelId).then(() =>
                loadWatchHistory(activePlaylist.id).then(setWatchHistory)
              );
            },
          },
        ]
      );
    },
    [activePlaylist]
  );

  const historyIds = useMemo(() => new Set(watchHistory.map((e) => e.channelId)), [watchHistory]);

  const recentHeader = useMemo(
    () =>
      watchHistory.length > 0 ? (
        <RecentlyWatchedRow
          history={watchHistory}
          playingId={playingId}
          onPress={handleRecentPress}
          onRemove={handleRemoveRecent}
        />
      ) : null,
    [watchHistory, playingId, handleRecentPress, handleRemoveRecent]
  );

  const renderXtreamItem = useCallback(
    ({ item, index }: { item: XLiveStream; index: number }) => (
      <>
        <XtreamChannelRow
          item={item}
          isActive={playingId === String(item.stream_id)}
          isLastWatched={historyIds.has(String(item.stream_id)) && playingId !== String(item.stream_id)}
          credentials={credentials!}
          now={now}
          onPress={() => handleXtreamPress(item)}
          onGuidePress={() => setEpgSheet({ streamId: item.stream_id, name: item.name })}
        />
        {index < filteredXtream.length - 1 && (
          <View style={[styles.sep, { backgroundColor: colors.border }]} />
        )}
      </>
    ),
    [playingId, historyIds, credentials, now, filteredXtream.length, colors.border, handleXtreamPress]
  );

  const renderM3UItem = useCallback(
    ({ item, index }: { item: M3UChannel; index: number }) => (
      <>
        <ChannelCard
          channel={{ id: item.id, name: item.name, icon: item.icon }}
          isActive={playingId === item.id}
          isLastWatched={historyIds.has(item.id) && playingId !== item.id}
          onPress={() => persistAndPlay(item.id, item.name, item.icon, item.url, item.name)}
        />
        {index < filteredM3U.length - 1 && (
          <View style={[styles.sep, { backgroundColor: colors.border }]} />
        )}
      </>
    ),
    [playingId, historyIds, filteredM3U.length, colors.border, persistAndPlay]
  );

  // ── Guard screens ─────────────────────────────────────────────────────────

  if (!isActive) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <EmptyState message="Activate your device to watch live TV" icon="tv" />
      </View>
    );
  }

  if (!hasCredentials) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <EmptyState message="Add a playlist to watch live TV" icon="tv" />
        <Pressable
          onPress={() => router.push("/add-playlist")}
          style={[styles.addBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
        >
          <Text style={styles.addBtnText}>Add Playlist</Text>
        </Pressable>
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const selectedCatName =
    selectedCategory === "all"
      ? "All Channels"
      : (allCategories.find((c) => c.id === selectedCategory)?.name ?? "");

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Top bar ── */}
      <View style={[styles.topBar, { paddingTop: topPad, borderBottomColor: colors.border }]}>
        <View style={styles.topBarLeft}>
          <Text style={[styles.screenTitle, { color: colors.text }]}>Live TV</Text>
          {selectedCatName.length > 0 && (
            <Text style={[styles.activeCatLabel, { color: colors.primary }]} numberOfLines={1}>
              {selectedCatName}
            </Text>
          )}
        </View>
        {isM3U && (
          <View style={[styles.badge, { backgroundColor: colors.success + "28" }]}>
            <Text style={[styles.badgeText, { color: colors.success }]}>M3U</Text>
          </View>
        )}
      </View>

      {/* ── Search (filters channel names in selected category) ── */}
      <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Feather name="search" size={15} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search channels…"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")} hitSlop={8}>
            <Feather name="x" size={15} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* ── Split layout: rail + content ── */}
      <View style={styles.split}>
        {/* LEFT: category rail */}
        <View style={[styles.rail, { borderRightColor: colors.border }]}>
          <FlatList<Category>
            data={allCategories}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <RailItem
                cat={item}
                isActive={selectedCategory === item.id}
                onPress={() => setSelectedCategory(item.id)}
                colors={colors}
              />
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 84 }}
          />
        </View>

        {/* RIGHT: channel list */}
        <View style={styles.content}>
          {selectedCategory === null && (
            <View style={styles.hintWrap}>
              <Feather name="arrow-left" size={18} color={colors.textMuted} />
              <Text style={[styles.hintText, { color: colors.textMuted }]}>Select a category</Text>
            </View>
          )}

          {selectedCategory !== null && isLoading && <LoadingList count={10} />}
          {selectedCategory !== null && error && !isLoading && (
            <ErrorState message="Unable to load channels" onRetry={refetch} />
          )}

          {selectedCategory !== null && !isLoading && !error && isXtream && credentials && (
            <FlatList<XLiveStream>
              data={filteredXtream}
              keyExtractor={(item, idx) => `xt-${item.stream_id}-${idx}`}
              renderItem={renderXtreamItem}
              ListHeaderComponent={recentHeader}
              ListEmptyComponent={<EmptyState message="No channels" icon="tv" />}
              contentContainerStyle={{ paddingBottom: insets.bottom + 84 }}
              showsVerticalScrollIndicator={false}
              initialNumToRender={20}
              maxToRenderPerBatch={15}
              windowSize={8}
              removeClippedSubviews
              keyboardShouldPersistTaps="handled"
            />
          )}

          {selectedCategory !== null && !isLoading && !error && isM3U && (
            <FlatList<M3UChannel>
              data={filteredM3U}
              keyExtractor={(item, idx) => `m3u-${item.id}-${idx}`}
              renderItem={renderM3UItem}
              ListHeaderComponent={recentHeader}
              ListEmptyComponent={<EmptyState message="No channels" icon="tv" />}
              contentContainerStyle={{ paddingBottom: insets.bottom + 84 }}
              showsVerticalScrollIndicator={false}
              initialNumToRender={20}
              maxToRenderPerBatch={15}
              windowSize={8}
              removeClippedSubviews
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>
      </View>

      {epgSheet && credentials && (
        <EpgSheet
          visible={!!epgSheet}
          onClose={() => setEpgSheet(null)}
          channelName={epgSheet.name}
          streamId={epgSheet.streamId}
          credentials={credentials}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const RAIL_W = 88;

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Top bar
  topBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  topBarLeft: { flex: 1, gap: 1 },
  screenTitle: { fontSize: 22, fontWeight: "700", letterSpacing: -0.5 },
  activeCatLabel: { fontSize: 13, fontWeight: "500", letterSpacing: -0.1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 2 },
  badgeText: { fontSize: 11, fontWeight: "700" },

  // Search
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14 },

  // Split
  split: { flex: 1, flexDirection: "row" },

  // Left rail
  rail: {
    width: RAIL_W,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  railItem: {
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 6,
    gap: 5,
    position: "relative",
  },
  railBar: {
    position: "absolute",
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderRadius: 2,
  },
  railIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  railInitial: { fontSize: 15, fontWeight: "700" },
  railName: { fontSize: 10, textAlign: "center", lineHeight: 13, fontWeight: "400" },
  railNameActive: { fontWeight: "700" },

  // Right content
  content: { flex: 1 },
  hintWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingBottom: 80,
  },
  hintText: { fontSize: 13 },

  // Channel list
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 92 },

  // Recently watched
  recentSection: { paddingVertical: 12 },
  recentLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  recentRow: { paddingHorizontal: 12, gap: 8 },
  recentCard: {
    width: 76,
    alignItems: "center",
    padding: 7,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 5,
  },
  recentLogoWrap: {
    width: 54,
    height: 38,
    borderRadius: 7,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  recentLogo: { width: 50, height: 34 },
  recentLiveDot: {
    position: "absolute",
    bottom: 3,
    right: 3,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  recentName: {
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 13,
  },

  // Guards
  addBtn: {
    alignSelf: "center",
    paddingHorizontal: 28,
    paddingVertical: 12,
    marginTop: 16,
  },
  addBtnText: { color: "#FFF", fontSize: 15, fontWeight: "600" },
});
