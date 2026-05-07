import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BackHandler,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ContentCard } from "@/components/ContentCard";
import { EmptyState, ErrorState } from "@/components/ErrorState";
import { FadeView } from "@/components/FadeView";
import { LoadingGrid } from "@/components/LoadingGrid";
import { useAuth } from "@/context/AuthContext";
import { usePlaylist } from "@/context/PlaylistContext";
import { useWatchHistory } from "@/context/WatchHistoryContext";
import { useColors } from "@/hooks/useColors";
import {
  getDismissedMovieId,
  getLastMovie,
  type LastWatchedMovie,
  setDismissedMovieId as persistDismissedMovieId,
} from "@/lib/storage";
import { getVodCategories, getVodStreams } from "@/lib/xtream";

// ─── Animated staggered item wrapper ─────────────────────────────────────────

function AnimatedItem({
  index,
  children,
  style,
}: {
  index: number;
  children: React.ReactNode;
  style?: object;
}) {
  const STAGGER_LIMIT = 16;
  const shouldAnimate = index < STAGGER_LIMIT;
  const opacity = useSharedValue(shouldAnimate ? 0 : 1);
  const translateY = useSharedValue(shouldAnimate ? 14 : 0);

  useEffect(() => {
    if (!shouldAnimate) return;
    const delay = index * 35;
    opacity.value = withDelay(delay, withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) }));
    translateY.value = withDelay(delay, withTiming(0, { duration: 220, easing: Easing.out(Easing.quad) }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
    flex: 1,
  }));

  return <Animated.View style={[animStyle, style]}>{children}</Animated.View>;
}

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

// ─── Category row ─────────────────────────────────────────────────────────────

function CategoryRow({
  cat,
  onPress,
  colors,
}: {
  cat: { id: string; name: string };
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
      <View style={[styles.catAccentBar, { backgroundColor: accent }]} />
      <Text style={[styles.catName, { color: colors.text }]} numberOfLines={1}>
        {cat.name}
      </Text>
      <Feather name="chevron-right" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

// ─── Continue watching banner ─────────────────────────────────────────────────

function ContinueMovieBanner({
  movie, progress, colors, onDismiss,
}: {
  movie: LastWatchedMovie;
  progress: number;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  onDismiss: () => void;
}) {
  return (
    <Pressable
      onPress={() => router.push(`/movie/${movie.streamId}?ext=${movie.ext}`)}
      style={({ pressed }) => [
        styles.continueBanner,
        {
          backgroundColor: colors.surface,
          borderColor: colors.primary + "40",
          borderRadius: colors.radius,
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      <Image
        source={{ uri: movie.icon }}
        style={[styles.continueThumb, { borderRadius: colors.radius - 2 }]}
        contentFit="cover"
        transition={200}
      />
      <View style={styles.continueBody}>
        <View style={styles.continueChipRow}>
          <View style={[styles.continueChip, { backgroundColor: colors.primary }]}>
            <Feather name="play" size={9} color="#FFF" />
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
            <View
              style={[
                styles.progressFill,
                { width: `${Math.min(progress * 100, 100)}%` as any, backgroundColor: colors.primary },
              ]}
            />
          </View>
        )}
      </View>
      <Pressable onPress={(e) => { e.stopPropagation(); onDismiss(); }} hitSlop={12} style={styles.dismissBtn}>
        <Feather name="x" size={16} color={colors.textMuted} />
      </Pressable>
    </Pressable>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function MoviesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { isActive } = useAuth();
  const { activePlaylist, credentials, hasCredentials } = usePlaylist();
  const { getEntry } = useWatchHistory();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [lastMovie, setLastMovie] = useState<LastWatchedMovie | null>(null);
  const [dismissedMovieId, setDismissedMovieId] = useState<string | null>(null);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const isLandscape = width > height;
  // Responsive columns: landscape → 5, tablet portrait → 4, phone portrait → 3, small phone → 2
  const COLS = isLandscape ? 5 : width > 600 ? 4 : width < 360 ? 2 : 3;
  const H_PAD = 16;
  const GAP = isLandscape ? 6 : 8;
  const CARD_W = (width - H_PAD * 2 - GAP * (COLS - 1)) / COLS;
  const CARD_H = CARD_W * 1.5;
  // Category columns in landscape
  const CAT_COLS = isLandscape ? 2 : 1;

  const isXtream = activePlaylist?.type === "xtream";
  const enabled = isActive && isXtream && !!credentials;
  const playlistId = activePlaylist?.id;

  useFocusEffect(
    useCallback(() => {
      if (!playlistId) { setLastMovie(null); setDismissedMovieId(null); return; }
      Promise.all([getLastMovie(playlistId), getDismissedMovieId(playlistId)]).then(
        ([movie, dismissed]) => { setLastMovie(movie); setDismissedMovieId(dismissed); }
      );
    }, [playlistId])
  );

  const handleDismiss = useCallback(() => {
    if (!playlistId || !lastMovie) return;
    setDismissedMovieId(lastMovie.streamId);
    void persistDismissedMovieId(playlistId, lastMovie.streamId);
  }, [playlistId, lastMovie]);

  const handleBack = useCallback(() => {
    setSearch("");
    setSelectedCategory(null);
  }, []);

  // Android hardware back button — only active while this tab is focused
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android" || selectedCategory === null) return;
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        handleBack();
        return true;
      });
      return () => sub.remove();
    }, [selectedCategory, handleBack])
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
      getVodStreams(credentials!, selectedCategory === "all" ? undefined : selectedCategory!),
    enabled: enabled && selectedCategory !== null,
    staleTime: 1000 * 60 * 10,
  });

  const allCats = useMemo(() => [
    { id: "all", name: "All Movies" },
    ...(categories ?? []).map((c) => ({ id: c.category_id, name: c.category_name })),
  ], [categories]);

  const filteredCats = useMemo(() => {
    if (!search.trim()) return allCats;
    const q = search.toLowerCase();
    return allCats.filter((c) => c.name.toLowerCase().includes(q));
  }, [allCats, search]);

  const filteredMovies = useMemo(() => {
    if (!movies) return [];
    if (!search.trim()) return movies;
    const q = search.toLowerCase();
    return movies.filter((m) => m.name.toLowerCase().includes(q));
  }, [movies, search]);

  const handleSelectCategory = useCallback((id: string) => {
    setSearch("");
    setSelectedCategory(id);
  }, []);

  const selectedCatName =
    selectedCategory === "all"
      ? "All Movies"
      : (allCats.find((c) => c.id === selectedCategory)?.name ?? "");

  const lastMovieEntry = lastMovie ? getEntry(lastMovie.streamId, "movie") : undefined;
  const lastMovieProgress =
    lastMovieEntry && lastMovieEntry.durationMs > 0
      ? lastMovieEntry.positionMs / lastMovieEntry.durationMs
      : 0;

  const showContinue =
    !!lastMovie && isXtream && enabled && selectedCategory !== null && lastMovie.streamId !== dismissedMovieId;

  // ── Guard screens ──────────────────────────────────────────────────────────

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
            <Feather name="film" size={34} color={colors.primary} />
          </View>
          <Text style={[styles.noticeTitle, { color: colors.text }]}>Movies need Xtream Codes</Text>
          <Text style={[styles.noticeSub, { color: colors.textSecondary }]}>
            Your active M3U playlist only supports Live TV. Switch to an Xtream Codes playlist.
          </Text>
          <Pressable
            onPress={() => router.push("/(tabs)/settings")}
            style={[styles.addBtn, { backgroundColor: colors.primary, borderRadius: colors.radius, flexDirection: "row", gap: 8 }]}
          >
            <Feather name="settings" size={14} color="#FFF" />
            <Text style={styles.addBtnText}>Manage Playlists</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const inCategoryView = selectedCategory === null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Header ── */}
      <View style={[
        styles.header,
        {
          paddingTop: topPad,
          paddingBottom: isLandscape ? 8 : 12,
          borderBottomColor: colors.border,
        },
      ]}>
        {!inCategoryView && (
          <Pressable onPress={handleBack} style={styles.backBtn} hitSlop={16}>
            <Feather name="chevron-left" size={24} color={colors.primary} />
          </Pressable>
        )}
        <Text
          style={[
            styles.headerTitle,
            { color: colors.text, flex: 1, fontSize: isLandscape ? 17 : 22 },
          ]}
          numberOfLines={1}
        >
          {inCategoryView ? "Movies" : selectedCatName}
        </Text>
      </View>

      {/* ── Continue banner ── */}
      {showContinue && (
        <View style={styles.continueSection}>
          <Text style={[styles.continueSectionLabel, { color: colors.textMuted }]}>
            PICK UP WHERE YOU LEFT OFF
          </Text>
          <ContinueMovieBanner movie={lastMovie!} progress={lastMovieProgress} colors={colors} onDismiss={handleDismiss} />
        </View>
      )}

      {/* ── Search ── */}
      <View style={[styles.searchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Feather name="search" size={15} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder={inCategoryView ? "Search categories…" : "Search movies…"}
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")} hitSlop={8}>
            <Feather name="x" size={15} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* ── Category list ── */}
      {inCategoryView && (
        <FadeView key="cat-view">
          <View style={[styles.listHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.listHeaderText, { color: colors.textMuted }]}>
              {filteredCats.length} {filteredCats.length === 1 ? "category" : "categories"}
            </Text>
          </View>
          <FlatList
            data={filteredCats}
            numColumns={CAT_COLS}
            key={`cat-${CAT_COLS}`}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={CAT_COLS > 1 ? { flex: 1 } : undefined}>
                <CategoryRow cat={item} onPress={() => handleSelectCategory(item.id)} colors={colors} />
              </View>
            )}
            contentContainerStyle={{ paddingBottom: insets.bottom + 84 }}
            ListEmptyComponent={<EmptyState message="No categories found" icon="film" />}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        </FadeView>
      )}

      {/* ── Movie grid ── */}
      {!inCategoryView && (
        <FadeView key={`grid-${selectedCategory}`}>
          {isLoading && <LoadingGrid columns={COLS} rows={isLandscape ? 2 : 3} cardHeight={CARD_H} />}
          {error && !isLoading && <ErrorState message="Unable to load movies" onRetry={refetch} />}
          {!isLoading && !error && (
            <FlatList
              data={filteredMovies}
              numColumns={COLS}
              key={`cols-${COLS}`}
              keyExtractor={(item, idx) => `mov-${item.stream_id}-${idx}`}
              renderItem={({ item, index }) => (
                <AnimatedItem index={index} style={{ padding: GAP / 2, paddingHorizontal: GAP / 2 }}>
                  <ContentCard
                    title={item.name}
                    poster={item.stream_icon}
                    meta={item.rating ? `★ ${Number(item.rating).toFixed(1)}` : undefined}
                    onPress={() => router.push(`/movie/${item.stream_id}?ext=${item.container_extension}`)}
                    width={CARD_W}
                    height={CARD_H}
                  />
                </AnimatedItem>
              )}
              contentContainerStyle={{ paddingHorizontal: H_PAD - GAP / 2, paddingBottom: insets.bottom + 84 }}
              ListEmptyComponent={<EmptyState message="No movies found" icon="film" />}
              showsVerticalScrollIndicator={false}
              initialNumToRender={12}
              maxToRenderPerBatch={12}
              windowSize={8}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </FadeView>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  centeredBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },
  iconWrap: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center" },
  noticeTitle: { fontSize: 19, fontWeight: "700", textAlign: "center" },
  noticeSub: { fontSize: 14, lineHeight: 21, textAlign: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontWeight: "700", letterSpacing: -0.5 },
  backBtn: { marginLeft: -4, minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },

  continueSection: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, gap: 6 },
  continueSectionLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },
  continueBanner: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderWidth: 1 },
  continueThumb: { width: 50, height: 74, backgroundColor: "#252525" },
  continueBody: { flex: 1, gap: 4 },
  continueChipRow: { flexDirection: "row" },
  continueChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  continueChipText: { color: "#FFF", fontSize: 11, fontWeight: "700" },
  continueTitle: { fontSize: 13, fontWeight: "600", lineHeight: 18 },
  continueMeta: { fontSize: 12 },
  progressTrack: { height: 3, borderRadius: 2, overflow: "hidden", marginTop: 2 },
  progressFill: { height: 3, borderRadius: 2 },
  dismissBtn: { padding: 4 },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14 },

  listHeader: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listHeaderText: { fontSize: 11, fontWeight: "600", letterSpacing: 0.3 },

  catRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 17,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 56,
  },
  catAccentBar: { width: 4, height: 24, borderRadius: 2 },
  catName: { flex: 1, fontSize: 15, fontWeight: "500", letterSpacing: -0.1 },

  addBtn: { alignSelf: "center", paddingHorizontal: 24, paddingVertical: 12, marginTop: 4 },
  addBtnText: { color: "#FFF", fontSize: 15, fontWeight: "600" },
});
