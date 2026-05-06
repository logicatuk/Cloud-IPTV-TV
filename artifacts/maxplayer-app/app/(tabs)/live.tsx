import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
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
  type WatchHistoryEntry,
} from "@/lib/storage";
import { cleanIptvName } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
}

function CategoryPills({
  categories,
  selected,
  onSelect,
}: {
  categories: Category[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const colors = useColors();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.pillList}
      style={styles.pillScroll}
    >
      {categories.map((cat) => {
        const active = selected === cat.id;
        return (
          <Pressable
            key={cat.id}
            onPress={() => onSelect(cat.id)}
            style={[
              styles.pill,
              {
                backgroundColor: active ? colors.primary : colors.surface,
                borderColor: active ? colors.primary : colors.border,
              },
            ]}
          >
            <Text style={[styles.pillText, { color: active ? "#FFF" : colors.textSecondary }]}>
              {cat.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ─── Recently Watched horizontal row ─────────────────────────────────────────

interface RecentlyWatchedRowProps {
  history: WatchHistoryEntry[];
  playingId: string | null;
  onPress: (entry: WatchHistoryEntry) => void;
}

function RecentlyWatchedRow({ history, playingId, onPress }: RecentlyWatchedRowProps) {
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
              style={({ pressed }) => [
                styles.recentCard,
                {
                  backgroundColor: pressed
                    ? colors.surface + "CC"
                    : isPlaying
                    ? colors.primary + "18"
                    : colors.surface,
                  borderColor: isPlaying ? colors.primary + "60" : colors.border,
                },
              ]}
            >
              <View style={[styles.recentIconWrap, { backgroundColor: colors.background }]}>
                <Image
                  source={{ uri: entry.channelIcon }}
                  style={styles.recentIcon}
                  contentFit="contain"
                />
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

// ─── Per-channel row that lazily fetches its own short EPG ───────────────────

interface XtreamChannelRowProps {
  item: XLiveStream;
  isActive: boolean;
  isLastWatched: boolean;
  credentials: XtreamCredentials;
  onPress: () => void;
  onGuidePress: () => void;
  /** Unix seconds from parent useNowTick — drives EPG progress updates */
  now: number;
}

function XtreamChannelRow({
  item,
  isActive,
  isLastWatched,
  credentials,
  onPress,
  onGuidePress,
  now,
}: XtreamChannelRowProps) {
  const { data: epgEntries } = useQuery<EpgEntry[]>({
    queryKey: ["epg-short", credentials.host, credentials.username, item.stream_id],
    queryFn: () => getShortEpg(credentials, item.stream_id),
    staleTime: 1000 * 60 * 30,
    retry: false,
  });

  const epgNow = useMemo<EpgEntry | null>(() => {
    if (!epgEntries || epgEntries.length === 0) return null;
    return (
      epgEntries.find((e) => now >= e.startTimestamp && now < e.endTimestamp) ??
      epgEntries[0] ??
      null
    );
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

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function LiveScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isActive } = useAuth();
  const { activePlaylist, credentials, hasCredentials } = usePlaylist();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
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

  useEffect(() => {
    if (!activePlaylist) { setWatchHistory([]); return; }
    loadWatchHistory(activePlaylist.id).then(setWatchHistory);
  }, [activePlaylist?.id]);

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
      getLiveStreams(credentials!, selectedCategory === "all" ? undefined : selectedCategory),
    enabled: xtreamEnabled,
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

  const isLoading = isXtream ? xtreamLoading : m3uLoading;
  const error = isXtream ? xtreamError : m3uError;
  const refetch = isXtream ? refetchXtream : refetchM3U;

  const allCategories = useMemo((): Category[] => {
    if (isXtream) {
      return [
        { id: "all", name: "All" },
        ...(xtreamCategories ?? []).map((c) => ({ id: c.category_id, name: c.category_name })),
      ];
    }
    return [
      { id: "all", name: "All" },
      ...(m3uData?.categories ?? []).map((c) => ({ id: c.id, name: c.name })),
    ];
  }, [isXtream, xtreamCategories, m3uData]);

  const filteredXtream = useMemo((): XLiveStream[] => {
    if (!isXtream) return [];
    const base = xtreamChannels ?? [];
    const categorized =
      selectedCategory === "all" ? base : base.filter((c) => c.category_id === selectedCategory);
    const q = search.toLowerCase().trim();
    return q ? categorized.filter((c) => c.name.toLowerCase().includes(q)) : categorized;
  }, [isXtream, xtreamChannels, selectedCategory, search]);

  const filteredM3U = useMemo((): M3UChannel[] => {
    if (!isM3U) return [];
    const base = m3uData?.channels ?? [];
    const categorized =
      selectedCategory === "all" ? base : base.filter((c) => c.group === selectedCategory);
    const q = search.toLowerCase().trim();
    return q ? categorized.filter((c) => c.name.toLowerCase().includes(q)) : categorized;
  }, [isM3U, m3uData, selectedCategory, search]);

  const persistAndPlay = useCallback(
    (channelId: string, channelName: string, channelIcon: string, playUrl: string, title: string) => {
      if (activePlaylist) {
        const entry: WatchHistoryEntry = {
          playlistId: activePlaylist.id,
          channelId,
          channelName,
          channelIcon,
        };
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
        if (ch) {
          persistAndPlay(ch.id, ch.name, ch.icon, ch.url, ch.name);
        }
      }
    },
    [isXtream, isM3U, credentials, m3uData, persistAndPlay]
  );

  const recentlyWatchedHeader = useMemo(
    () =>
      watchHistory.length > 0 ? (
        <RecentlyWatchedRow
          history={watchHistory}
          playingId={playingId}
          onPress={handleRecentPress}
        />
      ) : null,
    [watchHistory, playingId, handleRecentPress]
  );

  const historyIds = useMemo(
    () => new Set(watchHistory.map((e) => e.channelId)),
    [watchHistory]
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
          onPress={() => {
            persistAndPlay(item.id, item.name, item.icon, item.url, item.name);
          }}
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Live TV</Text>
        {isM3U && (
          <View style={[styles.badge, { backgroundColor: colors.success + "28" }]}>
            <Text style={[styles.badgeText, { color: colors.success }]}>M3U</Text>
          </View>
        )}
      </View>

      <View
        style={[
          styles.searchRow,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Feather name="search" size={16} color={colors.textMuted} />
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
            <Feather name="x" size={16} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      <CategoryPills
        categories={allCategories}
        selected={selectedCategory}
        onSelect={setSelectedCategory}
      />

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

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
        />
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
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  headerTitle: { fontSize: 26, fontWeight: "700", letterSpacing: -0.5 },
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
  pillScroll: { flexGrow: 0 },
  pillList: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillText: { fontSize: 13, fontWeight: "600" },
  divider: { height: 1 },
  separator: { height: 1, marginLeft: 92 },
  addBtn: {
    alignSelf: "center",
    paddingHorizontal: 28,
    paddingVertical: 12,
    marginTop: 16,
  },
  addBtnText: { color: "#FFF", fontSize: 15, fontWeight: "600" },
  recentSection: {
    paddingTop: 12,
    paddingBottom: 4,
  },
  recentTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  recentList: {
    paddingHorizontal: 16,
    gap: 10,
  },
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
  recentName: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 14,
  },
  recentPlayBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
});
