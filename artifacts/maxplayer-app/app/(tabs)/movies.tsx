import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
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
import { useColors } from "@/hooks/useColors";
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

export default function MoviesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { isActive } = useAuth();
  const { activePlaylist, credentials, hasCredentials } = usePlaylist();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const COLS = width > 600 ? 4 : 3;
  const GAP = 8;
  const CARD_WIDTH = (width - 16 * 2 - GAP * (COLS - 1)) / COLS;
  const CARD_HEIGHT = CARD_WIDTH * 1.5;

  const isXtream = activePlaylist?.type === "xtream";
  const enabled = isActive && isXtream && !!credentials;

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
