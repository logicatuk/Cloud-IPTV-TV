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
import { useColors } from "@/hooks/useColors";
import { getVodStreams, getSeriesList, type XVodStream, type XSeriesStream } from "@/lib/xtream";

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isActive, macAddress, status } = useAuth();
  const { credentials, hasCredentials, isLoading: playlistLoading, tryFetchFromBackend } = usePlaylist();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const enabled = isActive && hasCredentials && !!credentials;

  const { data: movies, isLoading: moviesLoading, error: moviesError, refetch: refetchMovies } = useQuery({
    queryKey: ["xtream-home-movies", credentials?.host, credentials?.username],
    queryFn: () => getVodStreams(credentials!),
    enabled,
    staleTime: 1000 * 60 * 15,
    select: (data) =>
      [...data].sort((a, b) => Number(b.added) - Number(a.added)).slice(0, 30),
  });

  const { data: series, isLoading: seriesLoading, error: seriesError, refetch: refetchSeries } = useQuery({
    queryKey: ["xtream-home-series", credentials?.host, credentials?.username],
    queryFn: () => getSeriesList(credentials!),
    enabled,
    staleTime: 1000 * 60 * 15,
    select: (data) =>
      [...data].sort((a, b) => Number(b.last_modified) - Number(a.last_modified)).slice(0, 30),
  });

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
            Add your IPTV playlist to start watching. Your provider may have assigned one — tap below to check.
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
            style={[
              styles.btn,
              {
                backgroundColor: colors.surface,
                borderRadius: colors.radius,
                borderWidth: 1,
                borderColor: colors.border,
              },
            ]}
          >
            <Feather name="refresh-cw" size={15} color={colors.textSecondary} style={{ marginRight: 6 }} />
            <Text style={[styles.btnText, { color: colors.textSecondary }]}>Check Provider Playlist</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const isLoading = moviesLoading && seriesLoading;
  const hasError = moviesError && seriesError;

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

      {isLoading && (
        <>
          <SectionHeader title="Recently Added Movies" />
          <LoadingRow />
          <SectionHeader title="Recently Added Series" />
          <LoadingRow />
        </>
      )}

      {hasError && !isLoading && (
        <ErrorState
          message="Unable to load content"
          onRetry={() => { refetchMovies(); refetchSeries(); }}
        />
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

      {!isLoading && !hasError && (!movies?.length && !series?.length) && (
        <EmptyState message="No content found. Check your playlist credentials." icon="film" />
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
  centeredBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  bigTitle: { fontSize: 22, fontWeight: "700" },
  sub: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  macDisplay: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 1.5,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 28,
    paddingVertical: 12,
    marginTop: 4,
  },
  btnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 26, fontWeight: "700", letterSpacing: -0.5 },
  searchBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  seeAll: { fontSize: 14, fontWeight: "600" },
  row: { paddingHorizontal: 16, gap: 8 },
});
