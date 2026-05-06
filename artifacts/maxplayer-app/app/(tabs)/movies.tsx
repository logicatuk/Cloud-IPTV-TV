import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
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
import { ContentCard } from "@/components/ContentCard";
import { EmptyState, ErrorState } from "@/components/ErrorState";
import { LoadingGrid } from "@/components/LoadingGrid";
import { useAuth } from "@/context/AuthContext";
import { usePlaylist } from "@/context/PlaylistContext";
import { useWatchHistory } from "@/context/WatchHistoryContext";
import { useColors } from "@/hooks/useColors";
import { type LastWatchedMovie, getLastMovie } from "@/lib/storage";
import { getVodCategories, getVodStreams } from "@/lib/xtream";

function CategoryPills({
  categories,
  selected,
  onSelect,
  colors,
}: {
  categories: { id: string; name: string }[];
  selected: string;
  onSelect: (id: string) => void;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
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

function ContinueMovieBanner({
  movie,
  progress,
  colors,
}: {
  movie: LastWatchedMovie;
  progress: number;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <Pressable
      onPress={() => router.push(`/movie/${movie.streamId}?ext=${movie.ext}`)}
      style={({ pressed }) => [
        styles.continueBanner,
        {
          backgroundColor: colors.surface,
          borderColor: colors.primary + "55",
          borderRadius: colors.radius,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Image
        source={{ uri: movie.icon }}
        style={[styles.continueThumb, { borderRadius: colors.radius - 2 }]}
        contentFit="cover"
        transition={200}
      />
      <View style={styles.continueInfo}>
        <View style={styles.continueChipRow}>
          <View style={[styles.continueChip, { backgroundColor: colors.primary }]}>
            <Feather name="play" size={10} color="#FFF" />
            <Text style={styles.continueChipText}>Continue</Text>
          </View>
        </View>
        <Text style={[styles.continueTitle, { color: colors.text }]} numberOfLines={2}>
          {movie.name}
        </Text>
        {movie.rating && Number(movie.rating) > 0 && (
          <Text style={[styles.continueMeta, { color: colors.textMuted }]}>
            ★ {Number(movie.rating).toFixed(1)}
          </Text>
        )}
        {progress > 0.01 && (
          <View style={[styles.progressTrack, { backgroundColor: colors.surfaceHigh }]}>
            <View style={[styles.progressFill, { flex: Math.min(progress, 1), backgroundColor: colors.primary }]} />
            <View style={{ flex: Math.max(0, 1 - Math.min(progress, 1)) }} />
          </View>
        )}
      </View>
      <Feather name="chevron-right" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

export default function MoviesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { isActive } = useAuth();
  const { activePlaylist, credentials, hasCredentials } = usePlaylist();
  const { getEntry } = useWatchHistory();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [lastMovie, setLastMovie] = useState<LastWatchedMovie | null>(null);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const COLS = width > 600 ? 4 : 3;
  const GAP = 8;
  const CARD_WIDTH = (width - 16 * 2 - GAP * (COLS - 1)) / COLS;
  const CARD_HEIGHT = CARD_WIDTH * 1.5;

  const isXtream = activePlaylist?.type === "xtream";
  const enabled = isActive && isXtream && !!credentials;

  const playlistId = activePlaylist?.id;
  useFocusEffect(
    useCallback(() => {
      if (!playlistId) { setLastMovie(null); return; }
      getLastMovie(playlistId).then(setLastMovie);
    }, [playlistId])
  );

  const { data: categories } = useQuery({
    queryKey: ["xtream-vod-cats", credentials?.host, credentials?.username],
    queryFn: () => getVodCategories(credentials!),
    enabled,
    staleTime: 1000 * 60 * 30,
  });

  const { data: movies, isLoading, error, refetch } = useQuery({
    queryKey: ["xtream-vod-streams", credentials?.host, credentials?.username, selectedCategory],
    queryFn: () =>
      getVodStreams(credentials!, selectedCategory === "all" ? undefined : selectedCategory),
    enabled,
    staleTime: 1000 * 60 * 10,
  });

  const filtered = useMemo(() => {
    if (!movies) return [];
    if (!search.trim()) return movies;
    const q = search.toLowerCase();
    return movies.filter((m) => m.name.toLowerCase().includes(q));
  }, [movies, search]);

  const allCats = [
    { id: "all", name: "All" },
    ...(categories ?? []).map((c) => ({ id: c.category_id, name: c.category_name })),
  ];

  const lastMovieEntry = lastMovie ? getEntry(lastMovie.streamId, "movie") : undefined;
  const lastMovieProgress =
    lastMovieEntry && lastMovieEntry.durationMs > 0
      ? lastMovieEntry.positionMs / lastMovieEntry.durationMs
      : 0;

  const showContinue = !!lastMovie && isXtream && enabled;

  if (!isActive) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <EmptyState message="Activate your device to browse movies" icon="film" />
      </View>
    );
  }

  if (!hasCredentials) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <EmptyState message="Add a playlist to browse movies" icon="film" />
        <Pressable
          onPress={() => router.push("/add-playlist")}
          style={[styles.addBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
        >
          <Text style={styles.addBtnText}>Add Playlist</Text>
        </Pressable>
      </View>
    );
  }

  if (!isXtream) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <View style={styles.centeredBox}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primary + "22" }]}>
            <Feather name="film" size={36} color={colors.primary} />
          </View>
          <Text style={[styles.noticeTitle, { color: colors.text }]}>Movies need Xtream Codes</Text>
          <Text style={[styles.noticeSub, { color: colors.textSecondary }]}>
            Your active M3U playlist only supports Live TV. Switch to an Xtream Codes playlist to
            access Movies.
          </Text>
          <Pressable
            onPress={() => router.push("/(tabs)/settings")}
            style={[styles.addBtn, { backgroundColor: colors.primary, borderRadius: colors.radius, flexDirection: "row", gap: 8 }]}
          >
            <Feather name="settings" size={15} color="#FFF" />
            <Text style={styles.addBtnText}>Manage Playlists</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Movies</Text>
      </View>

      {showContinue && (
        <View style={styles.continueSection}>
          <Text style={[styles.continueSectionLabel, { color: colors.textMuted }]}>
            PICK UP WHERE YOU LEFT OFF
          </Text>
          <ContinueMovieBanner
            movie={lastMovie!}
            progress={lastMovieProgress}
            colors={colors}
          />
        </View>
      )}

      <View style={[styles.searchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search movies…"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")} hitSlop={8}>
            <Feather name="x" size={16} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      <CategoryPills
        categories={allCats}
        selected={selectedCategory}
        onSelect={setSelectedCategory}
        colors={colors}
      />

      {isLoading && <LoadingGrid columns={COLS} rows={3} cardHeight={CARD_HEIGHT} />}
      {error && !isLoading && <ErrorState message="Unable to load movies" onRetry={refetch} />}

      {!isLoading && !error && (
        <FlatList
          data={filtered}
          numColumns={COLS}
          key={`cols-${COLS}`}
          keyExtractor={(item, index) => `mov-${item.stream_id}-${index}`}
          renderItem={({ item }) => (
            <View style={{ padding: GAP / 2, paddingLeft: 16, paddingRight: 0 }}>
              <ContentCard
                title={item.name}
                poster={item.stream_icon}
                meta={item.rating ? `★ ${Number(item.rating).toFixed(1)}` : undefined}
                onPress={() =>
                  router.push(`/movie/${item.stream_id}?ext=${item.container_extension}`)
                }
                width={CARD_WIDTH}
                height={CARD_HEIGHT}
              />
            </View>
          )}
          contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 84 }]}
          ListEmptyComponent={<EmptyState message="No movies found" icon="film" />}
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={8}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centeredBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },
  iconWrap: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  noticeTitle: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  noticeSub: { fontSize: 14, lineHeight: 22, textAlign: "center" },
  header: { paddingHorizontal: 16, paddingBottom: 10 },
  headerTitle: { fontSize: 26, fontWeight: "700", letterSpacing: -0.5, paddingTop: 8 },
  continueSection: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  continueSectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  continueBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderWidth: 1,
  },
  continueThumb: { width: 54, height: 80, backgroundColor: "#252525" },
  continueInfo: { flex: 1, gap: 5 },
  continueChipRow: { flexDirection: "row" },
  continueChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  continueChipText: { color: "#FFF", fontSize: 11, fontWeight: "700" },
  continueTitle: { fontSize: 14, fontWeight: "600", lineHeight: 19 },
  continueMeta: { fontSize: 12 },
  progressTrack: { height: 3, borderRadius: 2, overflow: "hidden", marginTop: 2, flexDirection: "row" },
  progressFill: { borderRadius: 2 },
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
  pillList: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  pillText: { fontSize: 13, fontWeight: "600" },
  grid: { paddingHorizontal: 12 },
  addBtn: { alignSelf: "center", paddingHorizontal: 24, paddingVertical: 12, marginTop: 4 },
  addBtnText: { color: "#FFF", fontSize: 15, fontWeight: "600" },
});
