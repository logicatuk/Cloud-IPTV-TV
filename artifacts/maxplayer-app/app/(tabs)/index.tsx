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
import { getHomeContent } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { status, hasPlaylist, isAuthenticated, macAddress, refresh } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const {
    data: home,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["home"],
    queryFn: getHomeContent,
    enabled: isAuthenticated,
    retry: 1,
  });

  // ── Not activated at all ────────────────────────────────────────────────
  if (status !== "active") {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <View style={styles.centeredBox}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primary + "22" }]}>
            <Feather name="tv" size={40} color={colors.primary} />
          </View>
          <Text style={[styles.bigTitle, { color: colors.text }]}>Not Activated</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            Contact your provider and give them your MAC address to start watching.
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

  // ── Activated but no playlist yet ──────────────────────────────────────
  if (!hasPlaylist) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <View style={styles.centeredBox}>
          <View style={[styles.iconWrap, { backgroundColor: colors.success + "22" }]}>
            <Feather name="check-circle" size={40} color={colors.success} />
          </View>
          <Text style={[styles.bigTitle, { color: colors.text }]}>Device Activated!</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            Your device is registered. Your provider is setting up your playlist — this will update automatically.
          </Text>
          <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />
          <Pressable
            onPress={refresh}
            style={[styles.btn, { backgroundColor: colors.surface, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border }]}
          >
            <Feather name="refresh-cw" size={15} color={colors.textSecondary} style={{ marginRight: 6 }} />
            <Text style={[styles.btnText, { color: colors.textSecondary }]}>Check Again</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Authenticated + has playlist — show content ─────────────────────────
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

      {error && !isLoading && (
        <ErrorState message="Unable to load content" onRetry={refetch} />
      )}

      {home && (
        <>
          {home.recently_added_movies.length > 0 && (
            <>
              <SectionHeader
                title="Recently Added Movies"
                onSeeAll={() => router.push("/(tabs)/movies")}
              />
              <FlatList
                data={home.recently_added_movies}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item, index) => `movie-${item.id}-${index}`}
                contentContainerStyle={styles.row}
                renderItem={({ item }) => (
                  <ContentCard
                    title={item.name}
                    poster={item.poster}
                    meta={item.year ? String(item.year) : undefined}
                    onPress={() => router.push(`/movie/${item.id}`)}
                  />
                )}
              />
            </>
          )}

          {home.recently_added_series.length > 0 && (
            <>
              <SectionHeader
                title="Recently Added Series"
                onSeeAll={() => router.push("/(tabs)/series")}
              />
              <FlatList
                data={home.recently_added_series}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item, index) => `series-${item.id}-${index}`}
                contentContainerStyle={styles.row}
                renderItem={({ item }) => (
                  <ContentCard
                    title={item.name}
                    poster={item.cover}
                    meta={item.year ? String(item.year) : undefined}
                    onPress={() => router.push(`/series/${item.id}`)}
                  />
                )}
              />
            </>
          )}

          {home.recently_added_movies.length === 0 && home.recently_added_series.length === 0 && (
            <EmptyState
              message="Your playlist is connected but no content was loaded yet. Try again in a moment."
              icon="film"
            />
          )}
        </>
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
  bigTitle: {
    fontSize: 22,
    fontWeight: "700",
  },
  sub: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
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
    marginTop: 8,
  },
  btnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  searchBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  seeAll: {
    fontSize: 14,
    fontWeight: "600",
  },
  row: {
    paddingHorizontal: 16,
    gap: 8,
  },
});
