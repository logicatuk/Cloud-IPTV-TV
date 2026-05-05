import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { useState } from "react";
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
import { getMovieCategories, getMovies } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

export default function MoviesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { status, hasPlaylist } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string | number>("all");
  const [search, setSearch] = useState("");
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const COLS = width > 600 ? 4 : 3;
  const CARD_WIDTH = (width - 16 * 2 - 8 * (COLS - 1)) / COLS;
  const CARD_HEIGHT = CARD_WIDTH * 1.5;

  const { data: categories } = useQuery({
    queryKey: ["movie-categories"],
    queryFn: getMovieCategories,
    enabled: status === "active" && hasPlaylist,
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["movies", selectedCategory, search],
    queryFn: () =>
      getMovies({
        category_id: selectedCategory === "all" ? undefined : selectedCategory,
        search: search || undefined,
        limit: 80,
      }),
    enabled: status === "active" && hasPlaylist,
    retry: 1,
  });

  const allCats = [{ id: "all", name: "All" }, ...(categories ?? [])];

  if (status !== "active" || !hasPlaylist) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <EmptyState message="Activate your device to browse movies" icon="film" />
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
            key={String(cat.id)}
            onPress={() => setSelectedCategory(cat.id)}
            style={[
              styles.catPill,
              {
                backgroundColor: selectedCategory === cat.id ? colors.primary : colors.surface,
                borderColor: selectedCategory === cat.id ? colors.primary : colors.border,
                borderRadius: 20,
              },
            ]}
          >
            <Text
              style={[
                styles.catText,
                { color: selectedCategory === cat.id ? "#FFF" : colors.textSecondary },
              ]}
            >
              {cat.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {isLoading && <LoadingGrid columns={COLS} rows={3} cardHeight={CARD_HEIGHT} />}
      {error && !isLoading && <ErrorState message="Unable to load movies" onRetry={refetch} />}

      {data && !isLoading && (
        <FlatList
          data={data.movies}
          numColumns={COLS}
          key={`cols-${COLS}`}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <View style={{ padding: 4 }}>
              <ContentCard
                title={item.name}
                poster={item.poster}
                meta={item.year ? String(item.year) : undefined}
                onPress={() => router.push(`/movie/${item.id}`)}
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
});
