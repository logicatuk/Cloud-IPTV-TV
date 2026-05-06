import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
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
import { useColors } from "@/hooks/useColors";
import {
  type LastWatchedSeries,
  getDismissedSeriesId,
  getLastSeries,
  setDismissedSeriesId as persistDismissedSeriesId,
} from "@/lib/storage";
import { getSeriesCategories, getSeriesList } from "@/lib/xtream";

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

// ─── Category card ────────────────────────────────────────────────────────────

function CategoryCard({
  cat,
  onPress,
  colors,
  cardWidth,
}: {
  cat: { id: string; name: string };
  onPress: () => void;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  cardWidth: number;
}) {
  const isAll = cat.id === "all";
  const accent = isAll ? colors.primary : catColor(cat.name);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.catCard,
        {
          width: cardWidth,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <View style={[styles.catCardIcon, { backgroundColor: accent + "22" }]}>
        {isAll
          ? <Feather name="grid" size={30} color={accent} />
          : <Text style={[styles.catCardInitial, { color: accent }]}>{(cat.name[0] ?? "?").toUpperCase()}</Text>
        }
      </View>
      <Text style={[styles.catCardName, { color: colors.text }]} numberOfLines={2}>
        {cat.name}
      </Text>
    </Pressable>
  );
}

// ─── Continue watching banner ─────────────────────────────────────────────────

function LastWatchedSeriesBanner({
  series,
  colors,
  onDismiss,
}: {
  series: LastWatchedSeries;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  onDismiss: () => void;
}) {
  return (
    <Pressable
      onPress={() => router.push(`/series/${series.seriesId}`)}
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
        source={{ uri: series.cover }}
        style={[styles.continueThumb, { borderRadius: colors.radius - 2 }]}
        contentFit="cover"
        transition={200}
      />
      <View style={styles.continueInfo}>
        <View style={styles.continueChipRow}>
          <View style={[styles.continueChip, { backgroundColor: colors.primary }]}>
            <Feather name="monitor" size={10} color="#FFF" />
            <Text style={styles.continueChipText}>Continue Watching</Text>
          </View>
        </View>
        <Text style={[styles.continueTitle, { color: colors.text }]} numberOfLines={2}>
          {series.name}
        </Text>
        {series.genre && (
          <Text style={[styles.continueMeta, { color: colors.textMuted }]}>{series.genre}</Text>
        )}
      </View>
      <Pressable
        onPress={(e) => { e.stopPropagation(); onDismiss(); }}
        hitSlop={12}
        style={styles.dismissBtn}
      >
        <Feather name="x" size={16} color={colors.textMuted} />
      </Pressable>
    </Pressable>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SeriesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { isActive } = useAuth();
  const { activePlaylist, credentials, hasCredentials } = usePlaylist();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [lastSeries, setLastSeries] = useState<LastWatchedSeries | null>(null);
  const [dismissedSeriesId, setDismissedSeriesId] = useState<string | null>(null);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const CONTENT_COLS = width > 600 ? 4 : 3;
  const GAP = 8;
  const CARD_WIDTH = (width - 16 * 2 - GAP * (CONTENT_COLS - 1)) / CONTENT_COLS;
  const CARD_HEIGHT = CARD_WIDTH * 1.5;

  const CAT_GAP = 12;
  const CAT_CARD_WIDTH = (width - 16 * 2 - CAT_GAP) / 2;

  const isXtream = activePlaylist?.type === "xtream";
  const enabled = isActive && isXtream && !!credentials;

  const playlistId = activePlaylist?.id;
  useFocusEffect(
    useCallback(() => {
      if (!playlistId) { setLastSeries(null); setDismissedSeriesId(null); return; }
      Promise.all([getLastSeries(playlistId), getDismissedSeriesId(playlistId)]).then(
        ([series, dismissedId]) => { setLastSeries(series); setDismissedSeriesId(dismissedId); }
      );
    }, [playlistId])
  );

  const handleDismissSeries = useCallback(() => {
    if (!playlistId || !lastSeries) return;
    setDismissedSeriesId(lastSeries.seriesId);
    void persistDismissedSeriesId(playlistId, lastSeries.seriesId);
  }, [playlistId, lastSeries]);

  const { data: categories } = useQuery({
    queryKey: ["xtream-series-cats", credentials?.host, credentials?.username],
    queryFn: () => getSeriesCategories(credentials!),
    enabled,
    staleTime: 1000 * 60 * 30,
  });

  const { data: seriesList, isLoading, error, refetch } = useQuery({
    queryKey: ["xtream-series-list", credentials?.host, credentials?.username, selectedCategory],
    queryFn: () =>
      getSeriesList(credentials!, selectedCategory === "all" ? undefined : selectedCategory!),
    enabled: enabled && selectedCategory !== null,
    staleTime: 1000 * 60 * 10,
  });

  const allCats = useMemo(() => [
    { id: "all", name: "All Series" },
    ...(categories ?? []).map((c) => ({ id: c.category_id, name: c.category_name })),
  ], [categories]);

  const filteredCats = useMemo(() => {
    if (!search.trim()) return allCats;
    const q = search.toLowerCase();
    return allCats.filter((c) => c.name.toLowerCase().includes(q));
  }, [allCats, search]);

  const filteredSeries = useMemo(() => {
    if (!seriesList) return [];
    if (!search.trim()) return seriesList;
    const q = search.toLowerCase();
    return seriesList.filter((s) => s.name.toLowerCase().includes(q));
  }, [seriesList, search]);

  const handleSelectCategory = useCallback((id: string) => {
    setSearch("");
    setSelectedCategory(id);
  }, []);

  const handleBack = useCallback(() => {
    setSearch("");
    setSelectedCategory(null);
  }, []);

  const selectedCatName = selectedCategory === "all"
    ? "All Series"
    : (allCats.find((c) => c.id === selectedCategory)?.name ?? "");

  const showLastWatched =
    !!lastSeries && isXtream && enabled && selectedCategory !== null && lastSeries.seriesId !== dismissedSeriesId;

  if (!isActive) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <EmptyState message="Activate your device to browse series" icon="monitor" />
      </View>
    );
  }

  if (!hasCredentials) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <EmptyState message="Add a playlist to browse series" icon="monitor" />
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
            <Feather name="monitor" size={36} color={colors.primary} />
          </View>
          <Text style={[styles.noticeTitle, { color: colors.text }]}>Series need Xtream Codes</Text>
          <Text style={[styles.noticeSub, { color: colors.textSecondary }]}>
            Your active M3U playlist only supports Live TV. Switch to an Xtream Codes playlist to access Series.
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
        <Text style={[styles.headerTitle, { color: colors.text, flex: 1 }]} numberOfLines={1}>
          {inCategoryView ? "Series" : selectedCatName}
        </Text>
      </View>

      {/* ── Continue watching banner (in content view only) ── */}
      {showLastWatched && (
        <View style={styles.continueSection}>
          <Text style={[styles.continueSectionLabel, { color: colors.textMuted }]}>
            CONTINUE WATCHING
          </Text>
          <LastWatchedSeriesBanner series={lastSeries!} colors={colors} onDismiss={handleDismissSeries} />
        </View>
      )}

      {/* ── Search ── */}
      <View style={[styles.searchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder={inCategoryView ? "Search categories…" : "Search series…"}
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

      {/* ── Category grid ── */}
      {inCategoryView && (
        <FlatList
          data={filteredCats}
          numColumns={2}
          key="cat-grid"
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={{ padding: CAT_GAP / 2, paddingLeft: 16, paddingRight: 0 }}>
              <CategoryCard
                cat={item}
                onPress={() => handleSelectCategory(item.id)}
                colors={colors}
                cardWidth={CAT_CARD_WIDTH}
              />
            </View>
          )}
          contentContainerStyle={[styles.catGrid, { paddingBottom: insets.bottom + 84 }]}
          ListEmptyComponent={<EmptyState message="No categories found" icon="monitor" />}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* ── Series grid ── */}
      {!inCategoryView && (
        <>
          {isLoading && <LoadingGrid columns={CONTENT_COLS} rows={3} cardHeight={CARD_HEIGHT} />}
          {error && !isLoading && <ErrorState message="Unable to load series" onRetry={refetch} />}
          {!isLoading && !error && (
            <FlatList
              data={filteredSeries}
              numColumns={CONTENT_COLS}
              key={`cols-${CONTENT_COLS}`}
              keyExtractor={(item, index) => `ser-${item.series_id}-${index}`}
              renderItem={({ item }) => (
                <View style={{ padding: GAP / 2, paddingLeft: 16, paddingRight: 0 }}>
                  <ContentCard
                    title={item.name}
                    poster={item.cover}
                    meta={item.genre || (item.releaseDate ? item.releaseDate.slice(0, 4) : undefined)}
                    onPress={() => router.push(`/series/${item.series_id}`)}
                    width={CARD_WIDTH}
                    height={CARD_HEIGHT}
                  />
                </View>
              )}
              contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 84 }]}
              ListEmptyComponent={<EmptyState message="No series found" icon="monitor" />}
              showsVerticalScrollIndicator={false}
              initialNumToRender={12}
              maxToRenderPerBatch={12}
              windowSize={8}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  headerTitle: { fontSize: 26, fontWeight: "700", letterSpacing: -0.5, paddingTop: 8 },
  backBtn: { marginLeft: -4, paddingTop: 8 },
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
  dismissBtn: { padding: 4 },
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
  catGrid: { paddingHorizontal: 12 },
  catCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 4,
  },
  catCardIcon: {
    height: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  catCardInitial: { fontSize: 32, fontWeight: "700" },
  catCardName: {
    fontSize: 13,
    fontWeight: "600",
    padding: 10,
    paddingTop: 8,
    lineHeight: 18,
  },
  grid: { paddingHorizontal: 12 },
  addBtn: { alignSelf: "center", paddingHorizontal: 24, paddingVertical: 12, marginTop: 4 },
  addBtnText: { color: "#FFF", fontSize: 15, fontWeight: "600" },
});
