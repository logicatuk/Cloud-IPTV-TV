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
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ContentCard } from "@/components/ContentCard";
import { EmptyState } from "@/components/ErrorState";
import { usePlaylist } from "@/context/PlaylistContext";
import { useColors } from "@/hooks/useColors";
import { getLiveStreams, getVodStreams, getSeriesList } from "@/lib/xtream";

export default function SearchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { credentials, hasCredentials } = usePlaylist();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(text), 400);
  };

  const enabled = hasCredentials && !!credentials;

  const { data: liveStreams } = useQuery({
    queryKey: ["xtream-live-streams", credentials?.host, credentials?.username, "all"],
    queryFn: () => getLiveStreams(credentials!),
    enabled,
    staleTime: 1000 * 60 * 15,
  });

  const { data: vodStreams } = useQuery({
    queryKey: ["xtream-vod-streams", credentials?.host, credentials?.username, "all"],
    queryFn: () => getVodStreams(credentials!),
    enabled,
    staleTime: 1000 * 60 * 15,
  });

  const { data: seriesList } = useQuery({
    queryKey: ["xtream-series-list", credentials?.host, credentials?.username, "all"],
    queryFn: () => getSeriesList(credentials!),
    enabled,
    staleTime: 1000 * 60 * 15,
  });

  const q = debouncedQuery.trim().toLowerCase();
  const hasQuery = q.length >= 2;

  const filteredMovies = useMemo(() => {
    if (!hasQuery || !vodStreams) return [];
    return vodStreams.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 20);
  }, [vodStreams, q, hasQuery]);

  const filteredSeries = useMemo(() => {
    if (!hasQuery || !seriesList) return [];
    return seriesList.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 20);
  }, [seriesList, q, hasQuery]);

  const filteredLive = useMemo(() => {
    if (!hasQuery || !liveStreams) return [];
    return liveStreams.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 10);
  }, [liveStreams, q, hasQuery]);

  const hasResults = filteredMovies.length > 0 || filteredSeries.length > 0 || filteredLive.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
        {!hasQuery && (
          <EmptyState message="Type to search movies, series, and channels" icon="search" />
        )}

        {hasQuery && !hasResults && (
          <EmptyState message={`No results for "${debouncedQuery}"`} icon="search" />
        )}

        {filteredMovies.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Movies</Text>
            <FlatList
              data={filteredMovies}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => `movie-${item.stream_id}`}
              contentContainerStyle={styles.horList}
              renderItem={({ item }) => (
                <ContentCard
                  title={item.name}
                  poster={item.stream_icon}
                  meta={item.rating ? `★ ${Number(item.rating).toFixed(1)}` : undefined}
                  onPress={() => {
                    router.back();
                    router.push(`/movie/${item.stream_id}?ext=${item.container_extension}`);
                  }}
                />
              )}
            />
          </>
        )}

        {filteredSeries.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Series</Text>
            <FlatList
              data={filteredSeries}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => `series-${item.series_id}`}
              contentContainerStyle={styles.horList}
              renderItem={({ item }) => (
                <ContentCard
                  title={item.name}
                  poster={item.cover}
                  meta={item.genre || undefined}
                  onPress={() => {
                    router.back();
                    router.push(`/series/${item.series_id}`);
                  }}
                />
              )}
            />
          </>
        )}

        {filteredLive.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Live TV</Text>
            {filteredLive.map((ch) => (
              <Pressable
                key={`live-${ch.stream_id}`}
                onPress={() => {
                  router.back();
                  router.push("/(tabs)/live");
                }}
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
                <Text style={[styles.channelName, { color: colors.text }]} numberOfLines={1}>
                  {ch.name}
                </Text>
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
  channelName: { fontSize: 14, fontWeight: "600", flex: 1 },
});
