import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import React, { useMemo, useState, useCallback } from "react";
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
import { fetchAndParseM3U, type M3UChannel } from "@/lib/m3u";
import type { M3UPlaylist } from "@/lib/playlist-types";
import { useNowTick } from "@/hooks/useNowTick";
import {
  getLiveCategories,
  getLiveStreams,
  buildLiveStreamUrl,
  getShortEpg,
  type XLiveStream,
  type XtreamCredentials,
  type EpgEntry,
} from "@/lib/xtream";
import {
  addToWatchHistory,
  loadWatchHistory,
  removeFromWatchHistory,
  type WatchHistoryEntry,
} from "@/lib/storage";
import { cleanIptvName } from "@/lib/utils";

// ─── Category color utilities ─────────────────────────────────────────────────

const CAT_COLORS = [
  "#0A84FF", "#30D158", "#FF9F0A", "#FF375F",
  "#BF5AF2", "#32ADE6", "#FF6961", "#5E5CE6",
  "#AC8E68", "#2CD9C5",
];

function catColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = Math.imul(31, h) + name.charCodeAt(i) | 0;
  }
  return CAT_COLORS[Math.abs(h) % CAT_COLORS.length];
}

// ─── Category list item ───────────────────────────────────────────────────────

interface Category {
  id: string;
  name: string;
}

function CategoryListItem({
  cat,
  onPress,
  colors,
}: {
  cat: Category;
  onPress: () => void;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  const isAll = cat.id === "all";
  const accent = isAll ? colors.primary : catColor(cat.name);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.catRow,
        { backgroundColor: pressed ? colors.surface : "transparent", borderBottomColor: colors.border },
      ]}
    >
      <View style={[styles.catIcon, { backgroundColor: accent + "22" }]}>
        {isAll
          ? <Feather name="grid" size={18} color={accent} />
          : <Text style={[styles.catIconText, { color: accent }]}>{(cat.name[0] ?? "?").toUpperCase()}</Text>
        }
      </View>
      <Text style={[styles.catName, { color: colors.text }]} numberOfLines={1}>{cat.name}</Text>
      <Feather name="chevron-right" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

// ─── Recently Watched row ─────────────────────────────────────────────────────

interface RecentlyWatchedRowProps {
  history: WatchHistoryEntry[];
  playingId: string | null;
  onPress: (entry: WatchHistoryEntry) => void;
  onRemove: (entry: WatchHistoryEntry) => void;
}

function RecentlyWatchedRow({ history, playingId, onPress, onRemove }: RecentlyWatchedRowProps) {
  const colors = useColors();
  if (history.length === 0) return null;
  return (
    <View style={styles.recentSection}>
      <Text style={[styles.recentTitle, { color: colors.textSecondary }]}>Recently Watched</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.recentList}
      >
        {history.map((entry) => {
          const isPlaying = playingId === entry.channelId;
          return (
            <Pressable
              key={entry.channelId}
              onPress={() => onPress(entry)}
              onLongPress={() => onRemove(entry)}
              delayLongPress={400}
              style={({ pressed }) => [
                styles.recentCard,
                {
                  backgroundColor: pressed ? colors.surface + "CC" : isPlaying ? colors.primary + "18" : colors.surface,
                  borderColor: isPlaying ? colors.primary + "60" : colors.border,
                },
              ]}
            >
              <View style={[styles.recentIconWrap, { backgroundColor: colors.background }]}>
                <Image source={{ uri: entry.channelIcon }} style={styles.recentIcon} contentFit="contain" />
                {isPlaying && (
                  <View style={[styles.recentPlayingDot, { backgroundColor: colors.primary }]} />
                )}
              </View>
              <Text
                style={[styles.recentName, { color: isPlaying ? colors.primary : colors.text }]}
                numberOfLines={2}
              >
                {cleanIptvName(entry.channelName)}
              </Text>
              {!isPlaying && (
                <View style={[styles.recentPlayBtn, { backgroundColor: colors.primary + "22" }]}>
                  <Feather name="play" size={10} color={colors.primary} />
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Xtream channel row with lazy EPG ────────────────────────────────────────

interface XtreamChannelRowProps {
  item: XLiveStream;
  isActive: boolean;
  isLastWatched: boolean;
  credentials: XtreamCredentials;
  onPress: () => void;
  onGuidePress: () => void;
  now: number;
}

function XtreamChannelRow({ item, isActive, isLastWatched, credentials, onPress, onGuidePress, now }: XtreamChannelRowProps) {
  const { data: epgEntries } = useQuery<EpgEntry[]>({
    queryKey: ["epg-short", credentials.host, credentials.username, item.stream_id],
    queryFn: () => getShortEpg(credentials, item.stream_id),
    staleTime: 1000 * 60 * 30,
    retry: false,
  });

  const epgNow = useMemo<EpgEntry | null>(() => {
    if (!epgEntries || epgEntries.length === 0) return null;
    return epgEntries.find((e) => now >= e.startTimestamp && now < e.endTimestamp) ?? epgEntries[0] ?? null;
  }, [epgEntries, now]);

  return (
    <ChannelCard
      channel={{
        id: String(item.stream_id),
        name: item.name,
        icon: item.stream_icon,
        category_id: item.category_id,
        epg_channel_id: item.epg_channel_id,
      }}
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
  const now = useNowTick(60_000);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

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

  const { data: xtreamCategories } = useQuery({
    queryKey: ["xtream-live-cats", credentials?.host, credentials?.username],
    queryFn: () => getLiveCategories(credentials!),
    enabled: xtreamEnabled,
    staleTime: 1000 * 60 * 30,
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

  const allCategories = useMemo((): Category[] => {
    if (isXtream) {
      return [
        { id: "all", name: "All Channels" },
        ...(xtreamCategories ?? []).map((c) => ({ id: c.category_id, name: c.category_name })),
      ];
    }
    return [
      { id: "all", name: "All Channels" },
      ...(m3uData?.categories ?? []).map((c) => ({ id: c.id, name: c.name })),
    ];
  }, [isXtream, xtreamCategories, m3uData]);

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return allCategories;
    const q = search.toLowerCase();
    return allCategories.filter((c) => c.name.toLowerCase().includes(q));
  }, [allCategories, search]);

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
    const base = selectedCategory === "all" || selectedCategory === null
      ? m3uData.channels
      : m3uData.channels.filter((c) => c.group === selectedCategory);
    const q = search.toLowerCase().trim();
    return q ? base.filter((c) => c.name.toLowerCase().includes(q)) : base;
  }, [isM3U, m3uData, selectedCategory, search]);

  const handleSelectCategory = useCallback((id: string) => {
    setSearch("");
    setSelectedCategory(id);
  }, []);

  const handleBack = useCallback(() => {
    setSearch("");
    setSelectedCategory(null);
  }, []);

  const selectedCatName = selectedCategory === "all"
    ? "All Channels"
    : (allCategories.find((c) => c.id === selectedCategory)?.name ?? "");

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

  const handleGuidePress = useCallback((item: XLiveStream) => {
    setEpgSheet({ streamId: item.stream_id, name: item.name });
  }, []);

  const handleRecentPress = useCallback(
    (entry: WatchHistoryEntry) => {
      if (isXtream && credentials) {
        const streamId = parseInt(entry.channelId, 10);
        const url = buildLiveStreamUrl(credentials, streamId);
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
              removeFromWatchHistory(activePlaylist.id, entry.channelId).then(() => {
                loadWatchHistory(activePlaylist.id).then(setWatchHistory);
              });
            },
          },
        ]
      );
    },
    [activePlaylist]
  );

  const recentlyWatchedHeader = useMemo(
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

  const historyIds = useMemo(() => new Set(watchHistory.map((e) => e.channelId)), [watchHistory]);

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
          onGuidePress={() => handleGuidePress(item)}
        />
        {index < filteredXtream.length - 1 && (
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
        )}
      </>
    ),
    [playingId, historyIds, credentials, now, filteredXtream.length, colors.border, handleXtreamPress, handleGuidePress]
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
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
        )}
      </>
    ),
    [playingId, historyIds, filteredM3U.length, colors.border, persistAndPlay]
  );

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

  const inCategoryView = selectedCategory === null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: topPad }]}>
        {!inCategoryView && (
          <Pressable onPress={handleBack} style={styles.backBtn} hitSlop={10}>
            <Feather name="chevron-left" size={26} color={colors.primary} />
          </Pressable>
        )}
        <Text
          style={[styles.headerTitle, { color: colors.text, flex: 1 }]}
          numberOfLines={1}
        >
          {inCategoryView ? "Live TV" : selectedCatName}
        </Text>
        {isM3U && (
          <View style={[styles.badge, { backgroundColor: colors.success + "28" }]}>
            <Text style={[styles.badgeText, { color: colors.success }]}>M3U</Text>
          </View>
        )}
      </View>

      {/* ── Search ── */}
      <View style={[styles.searchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder={inCategoryView ? "Search categories…" : "Search channels…"}
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")} hitSlop={8}>
            <Feather name="x" size={16} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* ── Category list view ── */}
      {inCategoryView && (
        <FlatList<Category>
          data={filteredCategories}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CategoryListItem cat={item} onPress={() => handleSelectCategory(item.id)} colors={colors} />
          )}
          contentContainerStyle={{ paddingBottom: insets.bottom + 84 }}
          ListEmptyComponent={<EmptyState message="No categories found" icon="grid" />}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* ── Channel list view ── */}
      {!inCategoryView && (
        <>
          {isLoading && <LoadingList count={12} />}
          {error && !isLoading && <ErrorState message="Unable to load channels" onRetry={refetch} />}

          {!isLoading && !error && isXtream && credentials && (
            <FlatList<XLiveStream>
              data={filteredXtream}
              keyExtractor={(item, index) => `xt-${item.stream_id}-${index}`}
              renderItem={renderXtreamItem}
              ListHeaderComponent={recentlyWatchedHeader}
              contentContainerStyle={{ paddingBottom: insets.bottom + 84 }}
              ListEmptyComponent={<EmptyState message="No channels found" icon="tv" />}
              showsVerticalScrollIndicator={false}
              initialNumToRender={20}
              maxToRenderPerBatch={15}
              windowSize={8}
              removeClippedSubviews
              keyboardShouldPersistTaps="handled"
            />
          )}

          {!isLoading && !error && isM3U && (
            <FlatList<M3UChannel>
              data={filteredM3U}
              keyExtractor={(item, index) => `m3u-${item.id}-${index}`}
              renderItem={renderM3UItem}
              ListHeaderComponent={recentlyWatchedHeader}
              contentContainerStyle={{ paddingBottom: insets.bottom + 84 }}
              ListEmptyComponent={<EmptyState message="No channels found" icon="tv" />}
              showsVerticalScrollIndicator={false}
              initialNumToRender={20}
              maxToRenderPerBatch={15}
              windowSize={8}
              removeClippedSubviews
              keyboardShouldPersistTaps="handled"
            />
          )}
        </>
      )}

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

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 8,
  },
  headerTitle: { fontSize: 26, fontWeight: "700", letterSpacing: -0.5 },
  backBtn: { marginLeft: -4 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15 },
  divider: { height: 1 },
  separator: { height: 1, marginLeft: 92 },
  addBtn: { alignSelf: "center", paddingHorizontal: 28, paddingVertical: 12, marginTop: 16 },
  addBtnText: { color: "#FFF", fontSize: 15, fontWeight: "600" },
  // Category list
  catRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  catIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  catIconText: { fontSize: 18, fontWeight: "700" },
  catName: { flex: 1, fontSize: 16, fontWeight: "500" },
  // Recently watched
  recentSection: { paddingTop: 12, paddingBottom: 4 },
  recentTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  recentList: { paddingHorizontal: 16, gap: 10 },
  recentCard: {
    width: 90,
    alignItems: "center",
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  recentIconWrap: {
    width: 60,
    height: 42,
    borderRadius: 8,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  recentIcon: { width: 56, height: 38 },
  recentPlayingDot: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  recentName: { fontSize: 11, fontWeight: "600", textAlign: "center", lineHeight: 14 },
  recentPlayBtn: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
});
