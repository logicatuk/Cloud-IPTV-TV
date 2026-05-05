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
import { useFavorites, movieToFavorite } from "@/context/FavoritesContext";
import { getMovieDetail, getMovieStreamUrl } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

export default function MovieDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [isLoadingStream, setIsLoadingStream] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: movie, isLoading, error, refetch } = useQuery({
    queryKey: ["movie", id],
    queryFn: () => getMovieDetail(id!),
    enabled: !!id,
  });

  const fav = movie ? isFavorite(movie.id, "movie") : false;

  const playMovie = async () => {
    if (!movie) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoadingStream(true);
    try {
      const { url } = await getMovieStreamUrl(movie.id);
      router.push(`/player?url=${encodeURIComponent(url)}&title=${encodeURIComponent(movie.name)}&type=movie`);
    } catch {
    } finally {
      setIsLoadingStream(false);
    }
  };

  const IMG_H = width * 0.56;

  if (isLoading) {
    return (
      <View style={[styles.loader, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !movie) {
    return (
      <View style={[styles.loader, { backgroundColor: colors.background }]}>
        <ErrorState message="Failed to load movie" onRetry={refetch} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <View style={{ height: IMG_H }}>
          <Image
            source={{ uri: movie.backdrop || movie.poster }}
            style={[StyleSheet.absoluteFill]}
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
          <Text style={[styles.title, { color: colors.text }]}>{movie.name}</Text>

          <View style={styles.metaRow}>
            {movie.year && (
              <MetaBadge value={String(movie.year)} colors={colors} />
            )}
            {movie.rating && Number(movie.rating) > 0 && (
              <MetaBadge value={`★ ${Number(movie.rating).toFixed(1)}`} colors={colors} accent />
            )}
            {movie.genre && (
              <MetaBadge value={movie.genre.split(",")[0]} colors={colors} />
            )}
            {movie.duration && movie.duration > 0 && (
              <MetaBadge value={`${Math.floor(movie.duration / 60)}m`} colors={colors} />
            )}
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={playMovie}
              disabled={isLoadingStream}
              style={({ pressed }) => [
                styles.playBtn,
                { backgroundColor: colors.primary, borderRadius: colors.radius, opacity: pressed || isLoadingStream ? 0.7 : 1 },
              ]}
            >
              {isLoadingStream ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Feather name="play" size={18} color="#FFF" />
              )}
              <Text style={styles.playBtnText}>
                {isLoadingStream ? "Loading…" : "Play"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                if (movie) {
                  Haptics.selectionAsync();
                  toggleFavorite(movieToFavorite(movie));
                }
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
              <Feather
                name="heart"
                size={18}
                color={fav ? colors.primary : colors.textSecondary}
              />
            </Pressable>

            {movie.trailer_youtube && (
              <Pressable
                onPress={() => Linking.openURL(`https://youtube.com/watch?v=${movie.trailer_youtube}`)}
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

          {movie.plot && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Synopsis</Text>
              <Text style={[styles.plot, { color: colors.textSecondary }]}>{movie.plot}</Text>
            </View>
          )}

          {(movie.director || movie.cast) && (
            <View style={[styles.creditsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {movie.director && (
                <View style={styles.creditRow}>
                  <Text style={[styles.creditLabel, { color: colors.textMuted }]}>Director</Text>
                  <Text style={[styles.creditValue, { color: colors.text }]} numberOfLines={1}>
                    {movie.director}
                  </Text>
                </View>
              )}
              {movie.cast && (
                <View style={styles.creditRow}>
                  <Text style={[styles.creditLabel, { color: colors.textMuted }]}>Cast</Text>
                  <Text style={[styles.creditValue, { color: colors.text }]} numberOfLines={2}>
                    {movie.cast}
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
  actions: { flexDirection: "row", gap: 10, alignItems: "center" },
  playBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
  },
  playBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  favBtn: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  section: { gap: 8 },
  sectionTitle: { fontSize: 17, fontWeight: "700" },
  plot: { fontSize: 14, lineHeight: 22 },
  creditsCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    gap: 0,
  },
  creditRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 0,
  },
  creditLabel: { width: 60, fontSize: 13, fontWeight: "600" },
  creditValue: { flex: 1, fontSize: 13 },
});
