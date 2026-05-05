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

export default function MoviesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { isActive } = useAuth();
  const { credentials, hasCredentials } = usePlaylist();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const COLS = width > 600 ? 4 : 3;
  const CARD_WIDTH = (width - 16 * 2 - 8 * (COLS - 1)) / COLS;
  const CARD_HEIGHT = CARD_WIDTH * 1.5;

  const enabled = isActive && hasCredentials && !!credentials;

  const { data: categories } = useQuery({
    queryKey: ["xtream-vod-cats", credentials?.host, credentials?.username],
    queryFn: () => getVodCategories(credentials!),
    enabled,
    staleTime: 1000 * 60 * 30,
  });

  const { data: movies, isLoading, error, refetch } = useQuery({
    queryKey: ["xtream-vod-streams", credentials?.host, credentials?.username, selectedCategory],
    queryFn: () => getVodStreams(credentials!, selectedCategory === "all" ? undefined : selectedCategory),
    enabled,
    staleTime: 1000 * 60 * 10,
  });

  const filtered = useMemo(() => {
    if (!movies) return [];
    if (!search.trim()) return movies;
    const q = search.toLowerCase();
    return movies.filter((m) => m.name.toLowerCase().includes(q));
  }, [movies, search]);

  const allCats = [{ category_id: "all", category_name: "All" }, ...(categories ?? [])];

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
          <Pressable onPress={() => setSearch("")}>
            <Feather name="x" size={16} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.catScroll}
        contentContainerStyle={styles.catList}
      >
        {allCats.map((cat) => (
          <Pressable
            key={cat.category_id}
            onPress={() => setSelectedCategory(cat.category_id)}
            style={[
              styles.catPill,
              {
                backgroundColor: selectedCategory === cat.category_id ? colors.primary : colors.surface,
                borderColor: selectedCategory === cat.category_id ? colors.primary : colors.border,
                borderRadius: 20,
              },
            ]}
          >
            <Text
              style={[
                styles.catText,
                { color: selectedCategory === cat.category_id ? "#FFF" : colors.textSecondary },
              ]}
            >
              {cat.category_name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {isLoading && <LoadingGrid columns={COLS} rows={3} cardHeight={CARD_HEIGHT} />}
      {error && !isLoading && <ErrorState message="Unable to load movies" onRetry={refetch} />}

      {!isLoading && !error && (
        <FlatList
          data={filtered}
          numColumns={COLS}
          key={`cols-${COLS}`}
          keyExtractor={(item, index) => `mov-${item.stream_id}-${index}`}
          renderItem={({ item }) => (
            <View style={{ padding: 4 }}>
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
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 26, fontWeight: "700", letterSpacing: -0.5, paddingTop: 8 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15 },
  catScroll: { flexGrow: 0, marginBottom: 8 },
  catList: { paddingHorizontal: 16, gap: 8 },
  catPill: { paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1 },
  catText: { fontSize: 13, fontWeight: "500" },
  grid: { paddingHorizontal: 12 },
  addBtn: { alignSelf: "center", paddingHorizontal: 28, paddingVertical: 12, marginTop: 16 },
  addBtnText: { color: "#FFF", fontSize: 15, fontWeight: "600" },
});
