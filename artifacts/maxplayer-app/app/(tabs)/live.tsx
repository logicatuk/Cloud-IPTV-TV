import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
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
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FadeView } from "@/components/FadeView";
import { ChannelCard } from "@/components/ChannelCard";
import { EpgSheet } from "@/components/EpgSheet";
import { EmptyState, ErrorState } from "@/components/ErrorState";
import { LoadingList } from "@/components/LoadingGrid";
import { PinModal } from "@/components/PinModal";
import { useAuth } from "@/context/AuthContext";
import { usePinContext } from "@/context/PinContext";
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
import { cleanIptvName, isAdultCategory } from "@/lib/utils";
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

// ─── Smart category icon lookup ───────────────────────────────────────────────

type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

const CAT_ICON_MAP: Array<[RegExp, MCIName]> = [
  [/sport|football|soccer|basket|tennis|golf|cricket|rugby|hockey|nba|nfl|mlb|nhl/i, "football"],
  [/news/i, "newspaper-variant-outline"],
  [/movie|film|cinema/i, "movie-outline"],
  [/kid|child|cartoon|junior|baby|family/i, "baby-face-outline"],
  [/music|radio|song|chart/i, "music-note"],
  [/documentary|docu/i, "book-open-variant"],
  [/comedy|humor/i, "emoticon-happy-outline"],
  [/horror|scary|thriller/i, "ghost"],
  [/action|adventure/i, "lightning-bolt"],
  [/romance|love/i, "heart-outline"],
  [/travel|tour|discovery/i, "airplane"],
  [/food|cook|chef|cuisine/i, "food-variant"],
  [/sci.?fi|fantasy/i, "flask-outline"],
  [/histor/i, "history"],
  [/anime|animation/i, "television-shimmer"],
  [/entertain/i, "party-popper"],
  [/fitness|gym|workout|sport/i, "dumbbell"],
  [/nature|wildlife|animal/i, "leaf"],
  [/premium|vip|\bhd\b|\b4k\b|\buhd\b/i, "star-circle"],
  [/education|learn|school/i, "school"],
  [/health|medical/i, "heart-pulse"],
  [/series|drama|show|episode/i, "television-play"],
];

function catIcon(name: string): MCIName | null {
  for (const [regex, icon] of CAT_ICON_MAP) {
    if (regex.test(name)) return icon;
  }
  return null;
}

// ─── Left rail item ───────────────────────────────────────────────────────────

interface Category { id: string; name: string; }

function RailItem({
  cat,
  isActive,
  isLandscape,
  isLocked,
  onPress,
  colors,
}: {
  cat: Category;
  isActive: boolean;
  isLandscape: boolean;
  isLocked: boolean;
  onPress: () => void;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  const isAll = cat.id === "all";
  const accent = isAll ? colors.primary : catColor(cat.name);
  const icon = isAll ? null : catIcon(cat.name);
  const mciSize = isLandscape ? 18 : 15;
  const iconBoxSize = isLandscape ? 40 : 36;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.railItem,
        isLandscape && styles.railItemLandscape,
        isActive && { backgroundColor: colors.primary + "12" },
        pressed && !isActive && { backgroundColor: colors.surfaceHigh + "70" },
      ]}
    >
      {isActive && (
        <View style={[styles.railBar, { backgroundColor: colors.primary }]} />
      )}
      <View style={{ position: "relative" }}>
        <View
          style={[
            styles.railIcon,
            {
              width: iconBoxSize,
              height: iconBoxSize,
              backgroundColor: isActive ? accent + "28" : colors.surfaceHigh,
            },
          ]}
        >
          {isAll ? (
            <MaterialCommunityIcons
              name="view-grid-outline"
              size={mciSize}
              color={isActive ? colors.primary : colors.textMuted}
            />
          ) : icon ? (
            <MaterialCommunityIcons
              name={icon}
              size={mciSize}
              color={isActive ? accent : colors.textMuted}
            />
          ) : (
            <Text style={[styles.railInitial, { color: isActive ? accent : colors.textMuted, fontSize: isLandscape ? 16 : 14 }]}>
              {(cat.name[0] ?? "?").toUpperCase()}
            </Text>
          )}
        </View>
        {isLocked && (
          <View style={[styles.lockBadge, { backgroundColor: colors.destructive }]}>
            <Feather name="lock" size={7} color="#FFF" />
          </View>
        )}
      </View>
      <Text
        style={[
          styles.railName,
          isLandscape && styles.railNameLandscape,
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentRow}>
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
                  backgroundColor: playing ? colors.primary + "18" : pressed ? colors.surfaceHigh : colors.surface,
                  borderColor: playing ? colors.primary + "60" : colors.border,
                },
              ]}
            >
              <View style={[styles.recentLogoWrap, { backgroundColor: colors.background }]}>
                <Image source={{ uri: entry.channelIcon }} style={styles.recentLogo} contentFit="contain" />
                {playing && <View style={[styles.recentLiveDot, { backgroundColor: colors.primary }]} />}
              </View>
              <Text
                style={[styles.recentName, { color: playing ? colors.primary : colors.textSecondary }]}
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
  item, isActive, isLastWatched, credentials, onPress, onGuidePress, now,
}: {
  item: XLiveStream; isActive: boolean; isLastWatched: boolean;
  credentials: XtreamCredentials; onPress: () => void; onGuidePress: () => void; now: number;
}) {
  const { data: epgEntries } = useQuery<EpgEntry[]>({
    queryKey: ["epg-short", credentials.host, credentials.username, item.stream_id],
    queryFn: () => getShortEpg(credentials, item.stream_id),
    staleTime: 1000 * 60 * 30,
    retry: false,
  });

  const epgNow = useMemo<EpgEntry | null>(() => {
    if (!epgEntries?.length) return null;
    return epgEntries.find((e) => now >= e.startTimestamp && now < e.endTimestamp) ?? epgEntries[0] ?? null;
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
  const { width, height } = useWindowDimensions();
  const { isActive } = useAuth();
  const { activePlaylist, credentials, hasCredentials } = usePlaylist();
  const { autoPlayId, autoPlayTs } = useLocalSearchParams<{ autoPlayId?: string; autoPlayTs?: string }>();
  const {
    pinEnabled,
    isLoading: isPinLoading,
    getIsSessionUnlocked,
    verifyPin,
    unlockSession,
  } = usePinContext();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [epgSheet, setEpgSheet] = useState<{ streamId: number; name: string } | null>(null);
  const [watchHistory, setWatchHistory] = useState<WatchHistoryEntry[]>([]);
  const [pendingCatId, setPendingCatId] = useState<string | null>(null);
  const autoSelectedRef = useRef(false);
  const autoPlayHandledRef = useRef<string | null>(null);
  const now = useNowTick(60_000);

  const isLandscape = width > height;
  const RAIL_W = isLandscape ? 120 : Math.min(96, width * 0.24);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const queryClient = useQueryClient();

  // Pre-populate the EPG screen's channel cache before navigating,
  // so the guide opens instantly with data already in flight.
  const handleEpgPress = useCallback(() => {
    if (credentials) {
      queryClient.prefetchQuery({
        queryKey: ["xtream-live-streams", credentials.host, credentials.username, "all"],
        queryFn: () => getLiveStreams(credentials),
        staleTime: 1000 * 60 * 10,
      });
    }
    router.push("/epg");
  }, [credentials, queryClient]);

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
    queryFn: () => getLiveStreams(credentials!, selectedCategory === "all" ? undefined : selectedCategory!),
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

  useEffect(() => {
    if (isM3U && selectedCategory === null) setSelectedCategory("all");
  }, [isM3U, selectedCategory]);

  useEffect(() => {
    if (isXtream && !autoSelectedRef.current && allCategories.length > 1) {
      autoSelectedRef.current = true;
      setSelectedCategory(allCategories[1]?.id ?? "all");
    }
  }, [isXtream, allCategories]);

  // ── Filtering ─────────────────────────────────────────────────────────────

  const isLoading = isXtream ? xtreamLoading : m3uLoading;
  const error = isXtream ? xtreamError : m3uError;
  const refetch = isXtream ? refetchXtream : refetchM3U;

  // True while PIN SecureStore is hydrating, or PIN is enabled + session locked.
  // Defaults to "locked" during hydration so we never expose adult content
  // in the brief window before storage resolves.
  const isPinLocked = (isPinLoading || pinEnabled) && !getIsSessionUnlocked();

  // Lookup: Xtream category_id → category_name (used to filter adult channels in "All")
  const xtreamCatNameById = useMemo((): Map<string, string> => {
    const map = new Map<string, string>();
    for (const c of xtreamCategories ?? []) map.set(c.category_id, c.category_name);
    return map;
  }, [xtreamCategories]);

  const filteredXtream = useMemo((): XLiveStream[] => {
    if (!isXtream || !xtreamChannels) return [];
    let base = xtreamChannels;
    // When locked, remove channels whose category is adult-flagged
    if (isPinLocked) {
      base = base.filter((c) => !isAdultCategory(xtreamCatNameById.get(c.category_id) ?? ""));
    }
    const q = search.toLowerCase().trim();
    return q ? base.filter((c) => c.name.toLowerCase().includes(q)) : base;
  }, [isXtream, xtreamChannels, search, isPinLocked, xtreamCatNameById]);

  const filteredM3U = useMemo((): M3UChannel[] => {
    if (!isM3U || !m3uData) return [];
    let base = selectedCategory === "all" ? m3uData.channels : m3uData.channels.filter((c) => c.group === selectedCategory);
    // When locked, remove adult-group channels
    if (isPinLocked) {
      base = base.filter((c) => !isAdultCategory(c.group ?? ""));
    }
    const q = search.toLowerCase().trim();
    return q ? base.filter((c) => c.name.toLowerCase().includes(q)) : base;
  }, [isM3U, m3uData, selectedCategory, search, isPinLocked]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  // Guard adult categories behind PIN when parental controls are enabled.
  const handleCategoryPress = useCallback(
    (cat: Category) => {
      if (cat.id !== "all" && isAdultCategory(cat.name) && isPinLocked) {
        setPendingCatId(cat.id);
        return;
      }
      setSelectedCategory(cat.id);
    },
    [isPinLocked]
  );

  const persistAndPlay = useCallback(
    (channelId: string, channelName: string, channelIcon: string, playUrl: string, title: string) => {
      if (activePlaylist) {
        addToWatchHistory({ playlistId: activePlaylist.id, channelId, channelName, channelIcon }).then(() => {
          if (activePlaylist) loadWatchHistory(activePlaylist.id).then(setWatchHistory);
        });
      }
      setPlayingId(channelId);
      router.push(`/player?url=${encodeURIComponent(playUrl)}&title=${encodeURIComponent(title)}&type=live`);
    },
    [activePlaylist]
  );

  // ── Auto-play channel arriving from EPG screen ──────────────────────────────
  // Each EPG tap includes a unique `autoPlayTs` timestamp so the same channel
  // can be launched multiple times. The ref tracks the last handled ts:id pair.
  //
  // Step 1: try the "all channels" cache (pre-populated by EPG's prefetchQuery).
  // If not cached, switch to "all" category to trigger a fetch.
  useEffect(() => {
    if (!autoPlayId || !autoPlayTs || !isXtream || !credentials) return;
    const key = `${autoPlayId}:${autoPlayTs}`;
    if (key === autoPlayHandledRef.current) return;

    const allChannels = queryClient.getQueryData<XLiveStream[]>([
      "xtream-live-streams", credentials.host, credentials.username, "all",
    ]);
    const target = allChannels?.find((c) => String(c.stream_id) === autoPlayId);
    if (target) {
      autoPlayHandledRef.current = key;
      persistAndPlay(
        String(target.stream_id), target.name, target.stream_icon,
        buildLiveStreamUrl(credentials, target.stream_id), target.name
      );
    } else {
      // Not in cache yet — switch to "all" category so the query fires
      setSelectedCategory("all");
    }
  }, [autoPlayId, autoPlayTs, isXtream, credentials, queryClient, persistAndPlay]);

  // Step 2: once "all" channels load, play the pending target channel.
  useEffect(() => {
    if (!autoPlayId || !autoPlayTs || !isXtream || !credentials) return;
    const key = `${autoPlayId}:${autoPlayTs}`;
    if (key === autoPlayHandledRef.current) return;
    if (!xtreamChannels || selectedCategory !== "all") return;

    const target = xtreamChannels.find((c) => String(c.stream_id) === autoPlayId);
    if (target) {
      autoPlayHandledRef.current = key;
      persistAndPlay(
        String(target.stream_id), target.name, target.stream_icon,
        buildLiveStreamUrl(credentials, target.stream_id), target.name
      );
    }
  }, [autoPlayId, autoPlayTs, isXtream, credentials, xtreamChannels, selectedCategory, persistAndPlay]);

  const handleXtreamPress = useCallback(
    (item: XLiveStream) => {
      if (!credentials) return;
      persistAndPlay(String(item.stream_id), item.name, item.stream_icon, buildLiveStreamUrl(credentials, item.stream_id), item.name);
    },
    [credentials, persistAndPlay]
  );

  const handleRecentPress = useCallback(
    (entry: WatchHistoryEntry) => {
      if (isXtream && credentials) {
        persistAndPlay(entry.channelId, entry.channelName, entry.channelIcon, buildLiveStreamUrl(credentials, parseInt(entry.channelId, 10)), entry.channelName);
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
        {index < filteredXtream.length - 1 && <View style={[styles.sep, { backgroundColor: colors.border }]} />}
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
        {index < filteredM3U.length - 1 && <View style={[styles.sep, { backgroundColor: colors.border }]} />}
      </>
    ),
    [playingId, historyIds, filteredM3U.length, colors.border, persistAndPlay]
  );

  // ── Shared search bar element ─────────────────────────────────────────────

  const searchBar = (inRail: boolean) => (
    <View style={[
      inRail ? styles.railSearchWrap : styles.searchWrap,
      { backgroundColor: colors.surface, borderColor: colors.border },
    ]}>
      <Feather name="search" size={inRail ? 13 : 15} color={colors.textMuted} />
      <TextInput
        style={[inRail ? styles.railSearchInput : styles.searchInput, { color: colors.text }]}
        placeholder={inRail ? "Search…" : "Search channels…"}
        placeholderTextColor={colors.textMuted}
        value={search}
        onChangeText={setSearch}
        returnKeyType="search"
      />
      {search.length > 0 && (
        <Pressable onPress={() => setSearch("")} hitSlop={8}>
          <Feather name="x" size={inRail ? 12 : 15} color={colors.textMuted} />
        </Pressable>
      )}
    </View>
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

  const channelListPadding = { paddingBottom: insets.bottom + 84 };

  const channelListContent = (
    <View style={styles.content}>
      <FadeView key={selectedCategory ?? "none"} slideDistance={12}>
        {selectedCategory === null && (
          <View style={styles.hintWrap}>
            <MaterialCommunityIcons name="arrow-left-circle-outline" size={28} color={colors.textMuted} />
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
            contentContainerStyle={channelListPadding}
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
            contentContainerStyle={channelListPadding}
            showsVerticalScrollIndicator={false}
            initialNumToRender={20}
            maxToRenderPerBatch={15}
            windowSize={8}
            removeClippedSubviews
            keyboardShouldPersistTaps="handled"
          />
        )}
      </FadeView>
    </View>
  );

  const categoryRail = (
    <View style={[styles.rail, { width: RAIL_W, borderRightColor: colors.border }]}>
      {/* Landscape: header + search live inside the rail */}
      {isLandscape && (
        <>
          <View style={[styles.railLandscapeHeader, { paddingTop: topPad, borderBottomColor: colors.border }]}>
            <Text style={[styles.railLandscapeTitle, { color: colors.text }]} numberOfLines={1}>
              Live TV
            </Text>
            {isM3U && (
              <View style={[styles.badge, { backgroundColor: colors.success + "28" }]}>
                <Text style={[styles.badgeText, { color: colors.success }]}>M3U</Text>
              </View>
            )}
            {xtreamEnabled && (
              <Pressable onPress={handleEpgPress} hitSlop={8}>
                <Feather name="grid" size={17} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
          {searchBar(true)}
        </>
      )}
      <FlatList<Category>
        data={allCategories}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <RailItem
            cat={item}
            isActive={selectedCategory === item.id}
            isLandscape={isLandscape}
            isLocked={item.id !== "all" && isAdultCategory(item.name) && isPinLocked}
            onPress={() => handleCategoryPress(item)}
            colors={colors}
          />
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 84 }}
      />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Portrait-only top bar */}
      {!isLandscape && (
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
          {xtreamEnabled && (
            <Pressable onPress={handleEpgPress} hitSlop={8} style={styles.epgBtn}>
              <Feather name="grid" size={20} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
      )}

      {/* Portrait-only search bar */}
      {!isLandscape && searchBar(false)}

      {/* Split layout */}
      <View style={[styles.split, isLandscape && { paddingLeft: insets.left, paddingRight: insets.right }]}>
        {categoryRail}
        {channelListContent}
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

      <PinModal
        visible={pendingCatId !== null}
        mode="verify"
        title="Enter PIN"
        verifyFn={verifyPin}
        onSuccess={() => {
          unlockSession();
          if (pendingCatId) setSelectedCategory(pendingCatId);
          setPendingCatId(null);
        }}
        onCancel={() => setPendingCatId(null)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Portrait top bar
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

  // Portrait search
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

  // Landscape rail header + search
  railLandscapeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  railLandscapeTitle: { fontSize: 13, fontWeight: "700", flex: 1 },
  railSearchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 7,
    marginTop: 7,
    marginBottom: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  railSearchInput: { flex: 1, fontSize: 12 },

  // Split
  split: { flex: 1, flexDirection: "row" },

  // Left rail
  rail: {
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  railItem: {
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 6,
    gap: 5,
    position: "relative",
    minHeight: 44,
  },
  railItemLandscape: {
    paddingVertical: 13,
    paddingHorizontal: 8,
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
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  lockBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  railInitial: { fontWeight: "700" },
  railName: { fontSize: 10, textAlign: "center", lineHeight: 13, fontWeight: "400" },
  railNameLandscape: { fontSize: 11, lineHeight: 14 },
  railNameActive: { fontWeight: "700" },

  // Right content
  content: { flex: 1 },
  hintWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingBottom: 80,
  },
  hintText: { fontSize: 13 },

  // Channel list separator
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
  recentName: { fontSize: 10, fontWeight: "600", textAlign: "center", lineHeight: 13 },

  // Guards
  addBtn: { alignSelf: "center", paddingHorizontal: 28, paddingVertical: 12, marginTop: 16 },
  addBtnText: { color: "#FFF", fontSize: 15, fontWeight: "600" },

  // EPG shortcut
  epgBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
});
