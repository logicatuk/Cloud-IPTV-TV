import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import {
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
  const { status, hasPlaylist, macAddress } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const {
    data: home,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["home"],
    queryFn: getHomeContent,
    enabled: status === "active" && hasPlaylist,
    retry: 1,
  });

  if (status !== "active" || !hasPlaylist) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <View style={styles.notActivated}>
          <View style={[styles.tvIcon, { backgroundColor: colors.primary + "22" }]}>
            <Feather name="tv" size={40} color={colors.primary} />
          </View>
          <Text style={[styles.notActivatedTitle, { color: colors.text }]}>Not Activated</Text>
          <Text style={[styles.notActivatedSub, { color: colors.textSecondary }]}>
            Contact your provider and give them your MAC address to start watching.
          </Text>
          <Text style={[styles.macDisplay, { color: colors.primary }]}>
            {macAddress ?? "Loading…"}
          </Text>
          <Pressable
            onPress={() => router.push("/activation")}
            style={[styles.activateBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
          >
            <Text style={styles.activateBtnText}>View Activation</Text>
          </Pressable>
        </View>
      </View>
    );
  }

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
                keyExtractor={(item) => String(item.id)}
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
                keyExtractor={(item) => String(item.id)}
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
  notActivated: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
  tvIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  notActivatedTitle: {
    fontSize: 22,
    fontWeight: "700",
  },
  notActivatedSub: {
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
  activateBtn: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    marginTop: 8,
  },
  activateBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
});
