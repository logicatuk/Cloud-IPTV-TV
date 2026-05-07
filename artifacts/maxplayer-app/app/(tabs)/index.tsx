import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ContentCard } from "@/components/ContentCard";
import { EmptyState, ErrorState } from "@/components/ErrorState";
import { LoadingRow } from "@/components/LoadingGrid";
import { useAuth } from "@/context/AuthContext";
import { usePlaylist } from "@/context/PlaylistContext";
import { useWatchHistory } from "@/context/WatchHistoryContext";
import { useColors } from "@/hooks/useColors";
import { fetchAndParseM3U } from "@/lib/m3u";
import type { M3UPlaylist } from "@/lib/playlist-types";
import type { WatchEntry } from "@/lib/watch-history";
import { getVodStreams, getSeriesList } from "@/lib/xtream";

function ContinueWatchingCard({
  entry,
  onPress,
  onDismiss,
}: {
  entry: WatchEntry;
  onPress: () => void;
  onDismiss: () => void;
}) {
  const colors = useColors();
  const progress = entry.durationMs > 0 ? Math.min(1, entry.positionMs / entry.durationMs) : 0;
  const remaining =
    entry.durationMs > 0
      ? Math.max(0, Math.round((entry.durationMs - entry.positionMs) / 60000))
      : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        cwStyles.card,
        { borderRadius: colors.radius, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Image
        source={{ uri: entry.poster }}
        style={[StyleSheet.absoluteFill, { borderRadius: colors.radius }]}
        contentFit="cover"
        transition={200}
      />
      <View style={[cwStyles.overlay, { borderRadius: colors.radius }]} />

      <Pressable
        onPress={(e) => { e.stopPropagation(); onDismiss(); }}
        hitSlop={8}
        style={cwStyles.dismiss}
      >
        <Feather name="x" size={12} color="#FFF" />
      </Pressable>

      <View style={cwStyles.bottom}>
        <Text style={cwStyles.title} numberOfLines={2}>{entry.title}</Text>
        {remaining !== null && remaining > 0 && (
          <Text style={cwStyles.remaining}>{remaining}m left</Text>
        )}
        <View style={cwStyles.track}>
          <View style={[cwStyles.fill, { width: `${progress * 100}%` as any }]} />
        </View>
      </View>

      <View style={cwStyles.playBadge}>
        <Feather name="play" size={14} color="#FFF" />
      </View>
    </Pressable>
  );
}

const cwStyles = StyleSheet.create({
  card: {
    width: 150,
    height: 100,
    backgroundColor: "#1A1A1A",
    overflow: "hidden",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  dismiss: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  bottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 8,
    gap: 3,
  },
  title: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 14,
  },
  remaining: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
  },
  track: {
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.3)",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: "#0A84FF",
  },
  playBadge: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -16,
    marginLeft: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
});

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isActive, macAddress } = useAuth();
  const { activePlaylist, credentials, hasCredentials, isLoading: playlistLoading, tryFetchFromBackend } = usePlaylist();
  const { history, removeEntry } = useWatchHistory();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const isXtream = activePlaylist?.type === "xtream";
  const isM3U = activePlaylist?.type === "m3u";
  const xtreamEnabled = isActive && isXtream && !!credentials;

  const { data: movies, isLoading: moviesLoading, error: moviesError, refetch: refetchMovies } = useQuery({
    queryKey: ["xtream-home-movies", credentials?.host, credentials?.username],
    queryFn: () => getVodStreams(credentials!),
    enabled: xtreamEnabled,
    staleTime: 1000 * 60 * 15,
    select: (data) => [...data].sort((a, b) => Number(b.added) - Number(a.added)).slice(0, 30),
  });

  const { data: series, isLoading: seriesLoading, error: seriesError, refetch: refetchSeries } = useQuery({
    queryKey: ["xtream-home-series", credentials?.host, credentials?.username],
    queryFn: () => getSeriesList(credentials!),
    enabled: xtreamEnabled,
    staleTime: 1000 * 60 * 15,
    select: (data) => [...data].sort((a, b) => Number(b.last_modified) - Number(a.last_modified)).slice(0, 30),
  });

  const m3uUrl = isM3U ? (activePlaylist as M3UPlaylist).url : "";
  const { data: m3uData, isLoading: m3uLoading, error: m3uError, refetch: refetchM3U } = useQuery({
    queryKey: ["m3u-home", m3uUrl],
    queryFn: () => fetchAndParseM3U(m3uUrl),
    enabled: isActive && !!m3uUrl,
    staleTime: 1000 * 60 * 30,
  });

  const handleResumeEntry = (entry: WatchEntry) => {
    const params = new URLSearchParams({
      url: entry.url,
      title: entry.title,
      type: entry.type,
      contentId: entry.id,
      poster: entry.poster,
      startAt: String(Math.floor(entry.positionMs / 1000)),
    });
    router.push(`/player?${params.toString()}`);
  };

  if (!isActive) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <View style={styles.centeredBox}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primary + "22" }]}>
            <Feather name="tv" size={40} color={colors.primary} />
          </View>
          <Text style={[styles.bigTitle, { color: colors.text }]}>Not Activated</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            Contact your provider and give them your MAC address to activate.
          </Text>
          <Text style={[styles.macDisplay, { color: colors.primary }]}>
            {macAddress ?? "Loading…"}
          </Text>
          <Pressable
            onPress={() => router.push("/activation")}
            style={[styles.btn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
          >
            <Text style={styles.btnText}>View Activation</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (playlistLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <View style={styles.centeredBox}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!hasCredentials) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <View style={styles.centeredBox}>
          <View style={[styles.iconWrap, { backgroundColor: colors.success + "22" }]}>
            <Feather name="check-circle" size={40} color={colors.success} />
          </View>
          <Text style={[styles.bigTitle, { color: colors.text }]}>Device Activated!</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            Add your IPTV playlist to start watching.
          </Text>
          <Pressable
            onPress={() => router.push("/add-playlist")}
            style={[styles.btn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
          >
            <Feather name="plus" size={16} color="#FFF" style={{ marginRight: 6 }} />
            <Text style={styles.btnText}>Add Playlist</Text>
          </Pressable>
          <Pressable
            onPress={() => macAddress && tryFetchFromBackend(macAddress)}
            style={[styles.btn, { backgroundColor: colors.surface, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border }]}
          >
            <Feather name="refresh-cw" size={15} color={colors.textSecondary} style={{ marginRight: 6 }} />
            <Text style={[styles.btnText, { color: colors.textSecondary }]}>Check Provider Playlist</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (isM3U) {
    const channels = m3uData?.channels ?? [];
    const categories = m3uData?.categories ?? [];
    const preview = channels.slice(0, 20);
    return (
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{ paddingTop: topPad, paddingBottom: insets.bottom + 84 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>MaxPlayer</Text>
          <View style={[styles.m3uBadge, { backgroundColor: colors.success + "22" }]}>
            <Text style={[styles.m3uBadgeText, { color: colors.success }]}>M3U</Text>
          </View>
        </View>

        {history.length > 0 && (
          <>
            <SectionHeader title="Continue Watching" />
            <FlatList
              data={history}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => `cw-${item.type}-${item.id}`}
              contentContainerStyle={styles.row}
              renderItem={({ item }) => (
                <ContinueWatchingCard
                  entry={item}
                  onPress={() => handleResumeEntry(item)}
                  onDismiss={() => removeEntry(item.id, item.type)}
                />
              )}
            />
          </>
        )}

        {m3uLoading && (
          <>
            <SectionHeader title="Live Channels" />
            <LoadingRow />
          </>
        )}
        {m3uError && !m3uLoading && (
          <ErrorState message="Unable to load playlist" onRetry={refetchM3U} />
        )}
        {!m3uLoading && !m3uError && (
          <>
            <SectionHeader
              title={`Live Channels · ${channels.length}`}
              onSeeAll={() => router.push("/(tabs)/live")}
            />
            <FlatList
              data={preview}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item, i) => `m3u-home-${i}-${item.id}`}
              contentContainerStyle={styles.row}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() =>
                    router.push(
                      `/player?url=${encodeURIComponent(item.url)}&title=${encodeURIComponent(item.name)}&type=live`
                    )
                  }
                  style={[styles.m3uCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <Image source={{ uri: item.icon }} style={styles.m3uLogo} contentFit="contain" />
                  <Text style={[styles.m3uCardName, { color: colors.text }]} numberOfLines={2}>
                    {item.name}
                  </Text>
                </Pressable>
              )}
            />
            {categories.length > 0 && (
              <>
                <SectionHeader title="Categories" />
                <FlatList
                  data={categories.slice(0, 20)}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.row}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => router.push("/(tabs)/live")}
                      style={[styles.catChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    >
                      <Text style={[styles.catChipText, { color: colors.text }]}>{item.name}</Text>
                    </Pressable>
                  )}
                />
              </>
            )}
          </>
        )}
      </ScrollView>
    );
  }

  const isLoading = moviesLoading || seriesLoading;
  const bothFailed = !!(moviesError && seriesError);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: topPad, paddingBottom: insets.bottom + 84 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>MaxPlayer</Text>
        <Pressable
          onPress={() => router.push("/search")}
          style={({ pressed }) => [
            styles.searchBtn,
            { backgroundColor: colors.surface, borderRadius: 22, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="search" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      {history.length > 0 && (
        <>
          <SectionHeader title="Continue Watching" />
          <FlatList
            data={history}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => `cw-${item.type}-${item.id}`}
            contentContainerStyle={styles.row}
            renderItem={({ item }) => (
              <ContinueWatchingCard
                entry={item}
                onPress={() => handleResumeEntry(item)}
                onDismiss={() => removeEntry(item.id, item.type)}
              />
            )}
          />
        </>
      )}

      {bothFailed && !isLoading && (
        <ErrorState
          message="Could not reach your IPTV server. Check your playlist credentials and internet connection."
          onRetry={() => { refetchMovies(); refetchSeries(); }}
        />
      )}

      {/* Movies row — show loading, error, or content independently */}
      {!bothFailed && (
        <>
          {moviesLoading && (
            <>
              <SectionHeader title="Recently Added Movies" />
              <LoadingRow />
            </>
          )}
          {!moviesLoading && moviesError && (
            <ErrorState message="Could not load movies" onRetry={refetchMovies} />
          )}
          {movies && movies.length > 0 && (
            <>
              <SectionHeader title="Recently Added Movies" onSeeAll={() => router.push("/(tabs)/movies")} />
              <FlatList
                data={movies}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item, index) => `movie-${item.stream_id}-${index}`}
                contentContainerStyle={styles.row}
                renderItem={({ item }) => (
                  <ContentCard
                    title={item.name}
                    poster={item.stream_icon}
                    meta={item.rating || undefined}
                    onPress={() => router.push(`/movie/${item.stream_id}?ext=${item.container_extension}`)}
                  />
                )}
              />
            </>
          )}
        </>
      )}

      {/* Series row — show loading, error, or content independently */}
      {!bothFailed && (
        <>
          {seriesLoading && (
            <>
              <SectionHeader title="Recently Added Series" />
              <LoadingRow />
            </>
          )}
          {!seriesLoading && seriesError && (
            <ErrorState message="Could not load series" onRetry={refetchSeries} />
          )}
          {series && series.length > 0 && (
            <>
              <SectionHeader title="Recently Added Series" onSeeAll={() => router.push("/(tabs)/series")} />
              <FlatList
                data={series}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item, index) => `series-${item.series_id}-${index}`}
                contentContainerStyle={styles.row}
                renderItem={({ item }) => (
                  <ContentCard
                    title={item.name}
                    poster={item.cover}
                    meta={item.genre || undefined}
                    onPress={() => router.push(`/series/${item.series_id}`)}
                  />
                )}
              />
            </>
          )}
        </>
      )}

      {!isLoading && !bothFailed && !moviesError && !seriesError && !movies?.length && !series?.length && (
        <EmptyState message="No movies or series found in your subscription." icon="film" />
      )}
    </ScrollView>
  );
}

function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  const colors = useColors();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {onSeeAll && (
        <Pressable onPress={onSeeAll}>
          <Text style={[styles.seeAll, { color: colors.primary }]}>See All</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centeredBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },
  iconWrap: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center" },
  bigTitle: { fontSize: 22, fontWeight: "700" },
  sub: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  macDisplay: { fontSize: 16, fontWeight: "700", letterSpacing: 1.5, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  btn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 28, paddingVertical: 12, marginTop: 4 },
  btnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 26, fontWeight: "700", letterSpacing: -0.5 },
  m3uBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  m3uBadgeText: { fontSize: 12, fontWeight: "700" },
  searchBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10, marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  seeAll: { fontSize: 14, fontWeight: "600" },
  row: { paddingHorizontal: 16, gap: 8 },
  m3uCard: { width: 110, borderRadius: 10, borderWidth: 1, padding: 10, alignItems: "center", gap: 8 },
  m3uLogo: { width: 64, height: 48, borderRadius: 6 },
  m3uCardName: { fontSize: 12, fontWeight: "500", textAlign: "center" },
  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  catChipText: { fontSize: 13, fontWeight: "500" },
});
