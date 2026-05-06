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
import { ChannelCard } from "@/components/ChannelCard";
import { EmptyState, ErrorState } from "@/components/ErrorState";
import { LoadingList } from "@/components/LoadingGrid";
import { useAuth } from "@/context/AuthContext";
import { usePlaylist } from "@/context/PlaylistContext";
import { useColors } from "@/hooks/useColors";
import { fetchAndParseM3U, type M3UChannel } from "@/lib/m3u";
import type { M3UPlaylist } from "@/lib/playlist-types";
import { getLiveCategories, getLiveStreams, buildLiveStreamUrl, type XLiveStream } from "@/lib/xtream";

interface Category { id: string; name: string }

function CategoryPills({
  categories,
  selected,
  onSelect,
}: {
  categories: Category[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const colors = useColors();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.pillList}
      style={styles.pillScroll}
    >
      {categories.map((cat) => {
        const active = selected === cat.id;
        return (
          <Pressable
            key={cat.id}
            onPress={() => onSelect(cat.id)}
            style={[
              styles.pill,
              {
                backgroundColor: active ? colors.primary : colors.surface,
                borderColor: active ? colors.primary : colors.border,
              },
            ]}
          >
            <Text style={[styles.pillText, { color: active ? "#FFF" : colors.textSecondary }]}>
              {cat.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export default function LiveScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isActive } = useAuth();
  const { activePlaylist, credentials, hasCredentials } = usePlaylist();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const isXtream = activePlaylist?.type === "xtream";
  const isM3U = activePlaylist?.type === "m3u";
  const xtreamEnabled = isActive && isXtream && !!credentials;
  const m3uEnabled = isActive && isM3U;
  const m3uUrl = isM3U ? (activePlaylist as M3UPlaylist).url : "";

  const { data: xtreamCategories } = useQuery({
    queryKey: ["xtream-live-cats", credentials?.host, credentials?.username],
    queryFn: () => getLiveCategories(credentials!),
    enabled: xtreamEnabled,
    staleTime: 1000 * 60 * 30,
  });

  const {
    data: xtreamChannels,
    isLoading: xtreamLoading,
    error: xtreamError,
    refetch: refetchXtream,
  } = useQuery({
    queryKey: ["xtream-live-streams", credentials?.host, credentials?.username, selectedCategory],
    queryFn: () =>
      getLiveStreams(credentials!, selectedCategory === "all" ? undefined : selectedCategory),
    enabled: xtreamEnabled,
    staleTime: 1000 * 60 * 10,
  });

  const {
    data: m3uData,
    isLoading: m3uLoading,
    error: m3uError,
    refetch: refetchM3U,
  } = useQuery({
    queryKey: ["m3u-parsed", m3uUrl],
    queryFn: () => fetchAndParseM3U(m3uUrl),
    enabled: m3uEnabled,
    staleTime: 1000 * 60 * 30,
  });

  const isLoading = isXtream ? xtreamLoading : m3uLoading;
  const error = isXtream ? xtreamError : m3uError;
  const refetch = isXtream ? refetchXtream : refetchM3U;

  const allCategories = useMemo((): Category[] => {
    if (isXtream) {
      return [
        { id: "all", name: "All" },
        ...(xtreamCategories ?? []).map((c) => ({ id: c.category_id, name: c.category_name })),
      ];
    }
    return [
      { id: "all", name: "All" },
      ...(m3uData?.categories ?? []).map((c) => ({ id: c.id, name: c.name })),
    ];
  }, [isXtream, xtreamCategories, m3uData]);

  const filteredXtream = useMemo((): XLiveStream[] => {
    if (!isXtream) return [];
    const base = xtreamChannels ?? [];
    const categorized =
      selectedCategory === "all" ? base : base.filter((c) => c.category_id === selectedCategory);
    const q = search.toLowerCase().trim();
    return q ? categorized.filter((c) => c.name.toLowerCase().includes(q)) : categorized;
  }, [isXtream, xtreamChannels, selectedCategory, search]);

  const filteredM3U = useMemo((): M3UChannel[] => {
    if (!isM3U) return [];
    const base = m3uData?.channels ?? [];
    const categorized =
      selectedCategory === "all" ? base : base.filter((c) => c.group === selectedCategory);
    const q = search.toLowerCase().trim();
    return q ? categorized.filter((c) => c.name.toLowerCase().includes(q)) : categorized;
  }, [isM3U, m3uData, selectedCategory, search]);

  if (!isActive) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <EmptyState message="Activate your device to watch live TV" icon="tv" />
      </View>
    );
  }

  if (!hasCredentials) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <EmptyState message="Add a playlist to watch live TV" icon="tv" />
        <Pressable
          onPress={() => router.push("/add-playlist")}
          style={[styles.addBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
        >
          <Text style={styles.addBtnText}>Add Playlist</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Live TV</Text>
        {isM3U && (
          <View style={[styles.badge, { backgroundColor: colors.success + "28" }]}>
            <Text style={[styles.badgeText, { color: colors.success }]}>M3U</Text>
          </View>
        )}
      </View>

      <View style={[styles.searchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search channels…"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")} hitSlop={8}>
            <Feather name="x" size={16} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      <CategoryPills
        categories={allCategories}
        selected={selectedCategory}
        onSelect={setSelectedCategory}
      />

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {isLoading && <LoadingList count={12} />}
      {error && !isLoading && <ErrorState message="Unable to load channels" onRetry={refetch} />}

      {!isLoading && !error && isXtream && (
        <FlatList<XLiveStream>
          data={filteredXtream}
          keyExtractor={(item, index) => `xt-${item.stream_id}-${index}`}
          renderItem={({ item, index }) => (
            <>
              <ChannelCard
                channel={{
                  id: String(item.stream_id),
                  name: item.name,
                  icon: item.stream_icon,
                  category_id: item.category_id,
                  epg_channel_id: item.epg_channel_id,
                }}
                isActive={playingId === String(item.stream_id)}
                onPress={() => {
                  if (!credentials) return;
                  const chId = String(item.stream_id);
                  setPlayingId(chId);
                  const url = buildLiveStreamUrl(credentials, item.stream_id);
                  router.push(
                    `/player?url=${encodeURIComponent(url)}&title=${encodeURIComponent(item.name)}&type=live`
                  );
                }}
              />
              {index < filteredXtream.length - 1 && (
                <View style={[styles.separator, { backgroundColor: colors.border }]} />
              )}
            </>
          )}
          contentContainerStyle={{ paddingBottom: insets.bottom + 84 }}
          ListEmptyComponent={<EmptyState message="No channels found" icon="tv" />}
          showsVerticalScrollIndicator={false}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={10}
        />
      )}

      {!isLoading && !error && isM3U && (
        <FlatList<M3UChannel>
          data={filteredM3U}
          keyExtractor={(item, index) => `m3u-${item.id}-${index}`}
          renderItem={({ item, index }) => (
            <>
              <ChannelCard
                channel={{ id: item.id, name: item.name, icon: item.icon }}
                isActive={playingId === item.id}
                onPress={() => {
                  setPlayingId(item.id);
                  router.push(
                    `/player?url=${encodeURIComponent(item.url)}&title=${encodeURIComponent(item.name)}&type=live`
                  );
                }}
              />
              {index < filteredM3U.length - 1 && (
                <View style={[styles.separator, { backgroundColor: colors.border }]} />
              )}
            </>
          )}
          contentContainerStyle={{ paddingBottom: insets.bottom + 84 }}
          ListEmptyComponent={<EmptyState message="No channels found" icon="tv" />}
          showsVerticalScrollIndicator={false}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={10}
        />
      )}
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
    paddingTop: 8,
    paddingBottom: 10,
  },
  headerTitle: { fontSize: 26, fontWeight: "700", letterSpacing: -0.5 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15 },
  pillScroll: { flexGrow: 0 },
  pillList: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillText: { fontSize: 13, fontWeight: "600" },
  divider: { height: 1 },
  separator: { height: 1, marginLeft: 92 },
  addBtn: { alignSelf: "center", paddingHorizontal: 28, paddingVertical: 12, marginTop: 16 },
  addBtnText: { color: "#FFF", fontSize: 15, fontWeight: "600" },
});
