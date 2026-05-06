import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ErrorState } from "@/components/ErrorState";
import { useFavorites } from "@/context/FavoritesContext";
import { usePlaylist } from "@/context/PlaylistContext";
import { useWatchHistory } from "@/context/WatchHistoryContext";
import { useColors } from "@/hooks/useColors";
import { getSeriesInfo, buildEpisodeStreamUrl, type XEpisode } from "@/lib/xtream";

export default function SeriesDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { credentials } = usePlaylist();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { getEntry } = useWatchHistory();
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [loadingEp, setLoadingEp] = useState<string | null>(null);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: series, isLoading, error, refetch } = useQuery({
    queryKey: ["xtream-series-info", credentials?.host, credentials?.username, id],
    queryFn: () => getSeriesInfo(credentials!, Number(id)),
    enabled: !!credentials && !!id,
  });

  React.useEffect(() => {
    if (series?.episodes) {
      const keys = Object.keys(series.episodes);
      if (keys.length > 0 && !selectedSeason) setSelectedSeason(keys[0]);
    }
  }, [series]); // eslint-disable-line react-hooks/exhaustive-deps

  const seriesInfo = series?.info;
  const seasonKeys = series?.episodes ? Object.keys(series.episodes).sort((a, b) => Number(a) - Number(b)) : [];
  const activeSeason = selectedSeason ?? seasonKeys[0] ?? null;
  const rawEpisodes = activeSeason ? (series?.episodes?.[activeSeason] ?? []) : [];
  const episodes: XEpisode[] = Array.isArray(rawEpisodes) ? rawEpisodes : [];

  const title = seriesInfo?.name ?? "Series";
  const cover = seriesInfo?.cover ?? "";
  const backdrop = seriesInfo?.backdrop_path?.[0] ?? cover;
  const fav = isFavorite(String(id), "series");

  const playEpisode = (ep: XEpisode) => {
    if (!credentials) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoadingEp(ep.id);
    const url = buildEpisodeStreamUrl(credentials, ep.id, ep.container_extension);
    const epTitle = `${title} S${ep.season ?? "?"} E${ep.episode_num} – ${ep.title}`;
    const watchEntry = getEntry(ep.id, "episode");
    const params = new URLSearchParams({
      url,
      title: epTitle,
      type: "episode",
      contentId: ep.id,
      poster: cover || "",
    });
    if (watchEntry && watchEntry.positionMs > 0) {
      params.set("startAt", String(Math.floor(watchEntry.positionMs / 1000)));
    }
    router.push(`/player?${params.toString()}`);
    setTimeout(() => setLoadingEp(null), 2000);
  };

  const IMG_H = width * 0.56;

  if (isLoading) {
    return (
      <View style={[styles.loader, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !series) {
    return (
      <View style={[styles.loader, { backgroundColor: colors.background }]}>
        <ErrorState message="Failed to load series" onRetry={refetch} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        <View style={{ height: IMG_H }}>
          <Image
            source={{ uri: backdrop || cover }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
          <LinearGradient
            colors={["rgba(0,0,0,0.1)", colors.background]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0.4 }}
            end={{ x: 0, y: 1 }}
          />
          <Pressable
            onPress={() => router.back()}
            style={[styles.backBtn, { top: topPad + 8 }]}
          >
            <Feather name="chevron-left" size={26} color="#FFF" />
          </Pressable>
        </View>

        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

          <View style={styles.metaRow}>
            {seriesInfo?.releaseDate && (
              <MetaBadge value={seriesInfo.releaseDate.slice(0, 4)} colors={colors} />
            )}
            {seriesInfo?.rating && Number(seriesInfo.rating) > 0 && (
              <MetaBadge value={`★ ${Number(seriesInfo.rating).toFixed(1)}`} colors={colors} accent />
            )}
            {seriesInfo?.genre && (
              <MetaBadge value={seriesInfo.genre.split(",")[0]} colors={colors} />
            )}
          </View>

          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              toggleFavorite({
                id: String(id),
                type: "series",
                name: title,
                poster: cover,
                meta: seriesInfo?.genre?.split(",")[0],
              });
            }}
            style={({ pressed }) => [
              styles.favBtn,
              {
                backgroundColor: fav ? colors.primary + "22" : colors.surface,
                borderColor: fav ? colors.primary : colors.border,
                borderRadius: colors.radius,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Feather name="heart" size={16} color={fav ? colors.primary : colors.textSecondary} />
            <Text style={[styles.favBtnText, { color: fav ? colors.primary : colors.textSecondary }]}>
              {fav ? "In Favorites" : "Add to Favorites"}
            </Text>
          </Pressable>

          {seriesInfo?.plot && (
            <Text style={[styles.plot, { color: colors.textSecondary }]}>{seriesInfo.plot}</Text>
          )}

          {seasonKeys.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Seasons</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.seasonList}
              >
                {seasonKeys.map((key) => (
                  <Pressable
                    key={key}
                    onPress={() => setSelectedSeason(key)}
                    style={[
                      styles.seasonPill,
                      {
                        backgroundColor: activeSeason === key ? colors.primary : colors.surface,
                        borderColor: activeSeason === key ? colors.primary : colors.border,
                        borderRadius: 20,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.seasonText,
                        { color: activeSeason === key ? "#FFF" : colors.textSecondary },
                      ]}
                    >
                      Season {key}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Episodes ({episodes.length})
              </Text>

              {episodes.map((ep) => {
                const epEntry = getEntry(ep.id, "episode");
                const epProgress =
                  epEntry && epEntry.durationMs > 0
                    ? Math.min(1, epEntry.positionMs / epEntry.durationMs)
                    : 0;
                const hasProgress = epProgress > 0.01;

                return (
                  <Pressable
                    key={ep.id}
                    onPress={() => playEpisode(ep)}
                    style={({ pressed }) => [
                      styles.epRow,
                      {
                        backgroundColor: colors.surface,
                        borderColor: hasProgress ? colors.primary + "44" : colors.border,
                        borderRadius: colors.radius,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <View style={[styles.epNum, { backgroundColor: colors.surfaceHigh }]}>
                      {loadingEp === ep.id ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <Text style={[styles.epNumText, { color: colors.textSecondary }]}>
                          {ep.episode_num}
                        </Text>
                      )}
                    </View>
                    <View style={styles.epInfo}>
                      <Text style={[styles.epTitle, { color: colors.text }]} numberOfLines={1}>
                        {ep.title || `Episode ${ep.episode_num}`}
                      </Text>
                      {ep.info?.plot && (
                        <Text style={[styles.epPlot, { color: colors.textSecondary }]} numberOfLines={2}>
                          {ep.info.plot}
                        </Text>
                      )}
                      {ep.info?.duration_secs && ep.info.duration_secs > 0 && (
                        <Text style={[styles.epDur, { color: colors.textMuted }]}>
                          {Math.floor(ep.info.duration_secs / 60)}m
                        </Text>
                      )}
                      {hasProgress && (
                        <View style={[styles.epProgressTrack, { backgroundColor: colors.surfaceHigh }]}>
                          <View
                            style={[
                              styles.epProgressFill,
                              { backgroundColor: colors.primary, width: `${epProgress * 100}%` as any },
                            ]}
                          />
                        </View>
                      )}
                    </View>
                    <Feather
                      name={hasProgress ? "play" : "play-circle"}
                      size={22}
                      color={colors.primary}
                    />
                  </Pressable>
                );
              })}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function MetaBadge({
  value,
  colors,
  accent,
}: {
  value: string;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  accent?: boolean;
}) {
  return (
    <View style={[mStyles.badge, { backgroundColor: accent ? colors.primary + "22" : colors.surfaceHigh }]}>
      <Text style={[mStyles.text, { color: accent ? colors.primary : colors.textSecondary }]}>
        {value}
      </Text>
    </View>
  );
}

const mStyles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  text: { fontSize: 13, fontWeight: "500" },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  backBtn: {
    position: "absolute",
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  content: { padding: 16, gap: 16 },
  title: { fontSize: 24, fontWeight: "700", lineHeight: 30 },
  metaRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  favBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: "flex-start",
  },
  favBtnText: { fontSize: 14, fontWeight: "600" },
  plot: { fontSize: 14, lineHeight: 22 },
  sectionTitle: { fontSize: 17, fontWeight: "700", marginTop: 4 },
  seasonList: { gap: 8 },
  seasonPill: { paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1 },
  seasonText: { fontSize: 13, fontWeight: "500" },
  epRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderWidth: 1,
  },
  epNum: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  epNumText: { fontSize: 13, fontWeight: "600" },
  epInfo: { flex: 1, gap: 3 },
  epTitle: { fontSize: 14, fontWeight: "600" },
  epPlot: { fontSize: 12, lineHeight: 16 },
  epDur: { fontSize: 12 },
  epProgressTrack: {
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
    marginTop: 4,
  },
  epProgressFill: {
    height: "100%",
    borderRadius: 2,
  },
});
