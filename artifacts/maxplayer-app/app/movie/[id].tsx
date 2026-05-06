import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Linking,
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
import { getVodInfo, buildVodStreamUrl } from "@/lib/xtream";

export default function MovieDetailScreen() {
  const { id, ext } = useLocalSearchParams<{ id: string; ext?: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { credentials } = usePlaylist();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { getEntry } = useWatchHistory();
  const [isPlayLoading, setIsPlayLoading] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: info, isLoading, error, refetch } = useQuery({
    queryKey: ["xtream-vod-info", credentials?.host, credentials?.username, id],
    queryFn: () => getVodInfo(credentials!, Number(id)),
    enabled: !!credentials && !!id,
  });

  const movieInfo = info?.info;
  const movieData = info?.movie_data;
  const poster = movieInfo?.cover_big || movieInfo?.movie_image || "";
  const backdrop = (movieInfo?.backdrop_path?.[0]) || poster;
  const title = movieInfo?.name || movieData?.name || "Movie";
  const extension = ext || movieData?.container_extension || "mp4";
  const streamId = Number(id);

  const fav = isFavorite(String(id), "movie");
  const watchEntry = getEntry(String(id), "movie");
  const resumeProgress = watchEntry && watchEntry.durationMs > 0
    ? watchEntry.positionMs / watchEntry.durationMs
    : 0;

  const buildPlayerUrl = (startAtMs?: number) => {
    if (!credentials) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const url = buildVodStreamUrl(credentials, streamId, extension);
    const params = new URLSearchParams({
      url,
      title,
      type: "movie",
      contentId: String(id),
      poster: poster || "",
    });
    if (startAtMs && startAtMs > 0) {
      params.set("startAt", String(Math.floor(startAtMs / 1000)));
    }
    router.push(`/player?${params.toString()}`);
  };

  const IMG_H = width * 0.56;

  if (isLoading) {
    return (
      <View style={[styles.loader, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !info) {
    return (
      <View style={[styles.loader, { backgroundColor: colors.background }]}>
        <ErrorState message="Failed to load movie" onRetry={refetch} />
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
            source={{ uri: backdrop || poster }}
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
            <Feather name="chevron-left" size={26} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

          <View style={styles.metaRow}>
            {movieInfo?.releasedate && (
              <MetaBadge value={movieInfo.releasedate.slice(0, 4)} colors={colors} />
            )}
            {movieInfo?.rating !== undefined && Number(movieInfo.rating) > 0 && (
              <MetaBadge value={`★ ${Number(movieInfo.rating).toFixed(1)}`} colors={colors} accent />
            )}
            {movieInfo?.genre && (
              <MetaBadge value={movieInfo.genre.split(",")[0]} colors={colors} />
            )}
            {movieInfo?.duration_secs && movieInfo.duration_secs > 0 && (
              <MetaBadge value={`${Math.floor(movieInfo.duration_secs / 60)}m`} colors={colors} />
            )}
          </View>

          <View style={styles.actions}>
            {watchEntry && resumeProgress > 0.01 ? (
              <>
                <View style={{ flex: 1, gap: 8 }}>
                  <Pressable
                    onPress={() => buildPlayerUrl(watchEntry.positionMs)}
                    style={({ pressed }) => [
                      styles.playBtn,
                      {
                        backgroundColor: colors.primary,
                        borderRadius: colors.radius,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Feather name="play" size={18} color="#FFF" />
                    <Text style={styles.playBtnText}>Resume</Text>
                  </Pressable>
                  <View style={[styles.resumeTrack, { backgroundColor: colors.surfaceHigh }]}>
                    <View
                      style={[
                        styles.resumeFill,
                        { backgroundColor: colors.primary, width: `${Math.min(resumeProgress, 1) * 100}%` as any },
                      ]}
                    />
                  </View>
                  <Pressable onPress={() => buildPlayerUrl(0)}>
                    <Text style={[styles.startOverText, { color: colors.textMuted }]}>
                      Start from beginning
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <Pressable
                onPress={() => buildPlayerUrl(0)}
                style={({ pressed }) => [
                  styles.playBtn,
                  {
                    backgroundColor: colors.primary,
                    borderRadius: colors.radius,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Feather name="play" size={18} color="#FFF" />
                <Text style={styles.playBtnText}>Play</Text>
              </Pressable>
            )}

            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                toggleFavorite({
                  id: String(id),
                  type: "movie",
                  name: title,
                  poster,
                  meta: movieInfo?.releasedate?.slice(0, 4),
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
              <Feather name="heart" size={18} color={fav ? colors.primary : colors.textSecondary} />
            </Pressable>

            {movieInfo?.youtube_trailer && (
              <Pressable
                onPress={() =>
                  Linking.openURL(`https://youtube.com/watch?v=${movieInfo.youtube_trailer}`)
                }
                style={({ pressed }) => [
                  styles.favBtn,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Feather name="youtube" size={18} color={colors.textSecondary} />
              </Pressable>
            )}
          </View>

          {movieInfo?.description && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Synopsis</Text>
              <Text style={[styles.plot, { color: colors.textSecondary }]}>
                {movieInfo.description}
              </Text>
            </View>
          )}

          {(movieInfo?.director || movieInfo?.actors) && (
            <View
              style={[
                styles.creditsCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              {movieInfo.director && (
                <View style={styles.creditRow}>
                  <Text style={[styles.creditLabel, { color: colors.textMuted }]}>Director</Text>
                  <Text style={[styles.creditValue, { color: colors.text }]} numberOfLines={1}>
                    {movieInfo.director}
                  </Text>
                </View>
              )}
              {movieInfo.actors && (
                <View style={styles.creditRow}>
                  <Text style={[styles.creditLabel, { color: colors.textMuted }]}>Cast</Text>
                  <Text style={[styles.creditValue, { color: colors.text }]} numberOfLines={2}>
                    {movieInfo.actors}
                  </Text>
                </View>
              )}
            </View>
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
    <View
      style={[
        metaStyles.badge,
        { backgroundColor: accent ? colors.primary + "22" : colors.surfaceHigh },
      ]}
    >
      <Text style={[metaStyles.text, { color: accent ? colors.primary : colors.textSecondary }]}>
        {value}
      </Text>
    </View>
  );
}

const metaStyles = StyleSheet.create({
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
  actions: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  playBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
  },
  playBtnText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  resumeTrack: {
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
  },
  resumeFill: {
    height: "100%",
    borderRadius: 2,
  },
  startOverText: { fontSize: 12, textAlign: "center" },
  favBtn: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 17, fontWeight: "700" },
  plot: { fontSize: 14, lineHeight: 22 },
  creditsCard: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  creditRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  creditLabel: { width: 60, fontSize: 13, fontWeight: "600" },
  creditValue: { flex: 1, fontSize: 13 },
});
