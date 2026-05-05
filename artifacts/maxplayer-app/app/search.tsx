import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ContentCard } from "@/components/ContentCard";
import { EmptyState } from "@/components/ErrorState";
import { searchContent } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

export default function SearchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(text), 400);
  };

  const { data, isFetching } = useQuery({
    queryKey: ["search", debouncedQuery],
    queryFn: () => searchContent(debouncedQuery),
    enabled: debouncedQuery.trim().length >= 2,
    retry: 1,
  });

  const hasResults =
    data && (data.movies.length > 0 || data.series.length > 0 || data.live.length > 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <View
          style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Feather name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Search movies, series, channels…"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={handleChange}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => { setQuery(""); setDebouncedQuery(""); }}>
              <Feather name="x" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.cancelBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={[styles.cancelText, { color: colors.primary }]}>Cancel</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.results, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {isFetching && (
          <View style={styles.loadingRow}>
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>Searching…</Text>
          </View>
        )}

        {!isFetching && debouncedQuery.length >= 2 && !hasResults && (
          <EmptyState message={`No results for "${debouncedQuery}"`} icon="search" />
        )}

        {!debouncedQuery.trim() && (
          <EmptyState message="Type to search across all content" icon="search" />
        )}

        {data && data.movies.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Movies</Text>
            <FlatList
              data={data.movies.slice(0, 20)}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => `movie-${item.id}`}
              contentContainerStyle={styles.horList}
              renderItem={({ item }) => (
                <ContentCard
                  title={item.name}
                  poster={item.poster}
                  meta={item.year ? String(item.year) : undefined}
                  onPress={() => { router.back(); router.push(`/movie/${item.id}`); }}
                />
              )}
            />
          </>
        )}

        {data && data.series.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Series</Text>
            <FlatList
              data={data.series.slice(0, 20)}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => `series-${item.id}`}
              contentContainerStyle={styles.horList}
              renderItem={({ item }) => (
                <ContentCard
                  title={item.name}
                  poster={item.cover}
                  meta={item.genre ?? undefined}
                  onPress={() => { router.back(); router.push(`/series/${item.id}`); }}
                />
              )}
            />
          </>
        )}

        {data && data.live.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Live TV</Text>
            {data.live.slice(0, 10).map((ch) => (
              <Pressable
                key={`live-${ch.id}`}
                onPress={() => router.push("/(tabs)/live")}
                style={({ pressed }) => [
                  styles.channelRow,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Feather name="radio" size={18} color={colors.primary} />
                <View style={styles.channelInfo}>
                  <Text style={[styles.channelName, { color: colors.text }]} numberOfLines={1}>
                    {ch.name}
                  </Text>
                  {ch.current_epg?.title && (
                    <Text style={[styles.channelEpg, { color: colors.textSecondary }]} numberOfLines={1}>
                      {ch.current_epg.title}
                    </Text>
                  )}
                </View>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
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
    paddingBottom: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  input: { flex: 1, fontSize: 16 },
  cancelBtn: { paddingVertical: 8 },
  cancelText: { fontSize: 16, fontWeight: "600" },
  results: { paddingHorizontal: 16, gap: 12, flexGrow: 1 },
  loadingRow: { alignItems: "center", paddingVertical: 24 },
  loadingText: { fontSize: 15 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginTop: 8 },
  horList: { gap: 8, paddingBottom: 4 },
  channelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderWidth: 1,
    marginBottom: 4,
  },
  channelInfo: { flex: 1, gap: 2 },
  channelName: { fontSize: 14, fontWeight: "600" },
  channelEpg: { fontSize: 12 },
});
