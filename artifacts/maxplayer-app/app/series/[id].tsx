import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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
import { useFavorites, seriesToFavorite } from "@/context/FavoritesContext";
import { getSeriesDetail, getEpisodeStreamUrl, type Episode } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

export default function SeriesDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [loadingEp, setLoadingEp] = useState<string | number | null>(null);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: series, isLoading, error, refetch } = useQuery({
    queryKey: ["series", id],
    queryFn: () => getSeriesDetail(id!),
    enabled: !!id,
  });

  React.useEffect(() => {
    if (series?.seasons) {
      const keys = Object.keys(series.seasons);
      if (keys.length > 0 && !selectedSeason) setSelectedSeason(keys[0]);
    }
  }, [series]); // eslint-disable-line react-hooks/exhaustive-deps

  const fav = series ? isFavorite(series.id, "series") : false;
  const IMG_H = width * 0.56;

  const seasonKeys = series?.seasons ? Object.keys(series.seasons) : [];
  const activeSeason = selectedSeason ?? seasonKeys[0] ?? null;
  const episodes: Episode[] = activeSeason && series?.seasons?.[activeSeason]
    ? series.seasons[activeSeason].episodes
    : [];

  const playEpisode = async (ep: Episode, seriesName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoadingEp(ep.id);
    try {
      const { url } = await getEpisodeStreamUrl(ep.id);
      const title = `${seriesName} S${ep.season ?? "?"} E${ep.episode_num} – ${ep.title}`;
      router.push(`/player?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}&type=episode`);
    } catch {
    } finally {
      setLoadingEp(null);
    }
  };

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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <View style={{ height: IMG_H }}>
          <Image
            source={{ uri: series.backdrop || series.cover }}
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
          <Text style={[styles.title, { color: colors.text }]}>{series.name}</Text>

          <View style={styles.metaRow}>
            {series.year && <MetaBadge value={String(series.year)} colors={colors} />}
            {series.rating && Number(series.rating) > 0 && (
              <MetaBadge value={`★ ${Number(series.rating).toFixed(1)}`} colors={colors} accent />
            )}
            {series.genre && <MetaBadge value={series.genre.split(",")[0]} colors={colors} />}
          </View>

          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              toggleFavorite(seriesToFavorite(series));
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

          {series.plot && (
            <Text style={[styles.plot, { color: colors.textSecondary }]}>{series.plot}</Text>
          )}

          {seasonKeys.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Seasons</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.seasonList}>
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
                      {series.seasons![key].name || `Season ${series.seasons![key].season_number}`}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Episodes ({episodes.length})
              </Text>

              {episodes.map((ep) => (
                <Pressable
                  key={String(ep.id)}
                  onPress={() => playEpisode(ep, series.name)}
                  style={({ pressed }) => [
                    styles.epRow,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
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
                    {ep.plot && (
                      <Text style={[styles.epPlot, { color: colors.textSecondary }]} numberOfLines={2}>
                        {ep.plot}
                      </Text>
                    )}
                    {ep.duration && ep.duration > 0 && (
                      <Text style={[styles.epDur, { color: colors.textMuted }]}>
                        {Math.floor(ep.duration / 60)}m
                      </Text>
                    )}
                  </View>
                  <Feather name="play-circle" size={22} color={colors.primary} />
                </Pressable>
              ))}
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
});
