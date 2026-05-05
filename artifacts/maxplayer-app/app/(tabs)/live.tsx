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
import {
  getLiveCategories,
  getLiveStreams,
  buildLiveStreamUrl,
} from "@/lib/xtream";

export default function LiveScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isActive } = useAuth();
  const { credentials, hasCredentials } = usePlaylist();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [playingId, setPlayingId] = useState<number | null>(null);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const enabled = isActive && hasCredentials && !!credentials;

  const { data: categories } = useQuery({
    queryKey: ["xtream-live-cats", credentials?.host, credentials?.username],
    queryFn: () => getLiveCategories(credentials!),
    enabled,
    staleTime: 1000 * 60 * 30,
  });

  const { data: channels, isLoading, error, refetch } = useQuery({
    queryKey: ["xtream-live-streams", credentials?.host, credentials?.username, selectedCategory],
    queryFn: () => getLiveStreams(credentials!, selectedCategory === "all" ? undefined : selectedCategory),
    enabled,
    staleTime: 1000 * 60 * 10,
  });

  const filtered = useMemo(() => {
    if (!channels) return [];
    if (!search.trim()) return channels;
    const q = search.toLowerCase();
    return channels.filter((c) => c.name.toLowerCase().includes(q));
  }, [channels, search]);

  const allCategories = [{ category_id: "all", category_name: "All Channels" }, ...(categories ?? [])];

  const playChannel = (streamId: number, name: string) => {
    if (!credentials) return;
    setPlayingId(streamId);
    const url = buildLiveStreamUrl(credentials, streamId);
    router.push(`/player?url=${encodeURIComponent(url)}&title=${encodeURIComponent(name)}&type=live`);
  };

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
          <Pressable onPress={() => setSearch("")}>
            <Feather name="x" size={16} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryList}
      >
        {allCategories.map((cat) => (
          <Pressable
            key={cat.category_id}
            onPress={() => setSelectedCategory(cat.category_id)}
            style={[
              styles.catPill,
              {
                backgroundColor: selectedCategory === cat.category_id ? colors.primary : colors.surface,
                borderColor: selectedCategory === cat.category_id ? colors.primary : colors.border,
                borderRadius: 20,
              },
            ]}
          >
            <Text
              style={[
                styles.catPillText,
                { color: selectedCategory === cat.category_id ? "#FFF" : colors.textSecondary },
              ]}
            >
              {cat.category_name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {isLoading && <LoadingList count={10} />}
      {error && !isLoading && (
        <ErrorState message="Unable to load channels" onRetry={refetch} />
      )}

      {!isLoading && !error && (
        <FlatList
          data={filtered}
          keyExtractor={(item, index) => `ch-${item.stream_id}-${index}`}
          renderItem={({ item }) => (
            <ChannelCard
              channel={{
                id: item.stream_id,
                name: item.name,
                icon: item.stream_icon,
                category_id: item.category_id,
                epg_channel_id: item.epg_channel_id,
              }}
              isActive={playingId === item.stream_id}
              onPress={() => playChannel(item.stream_id, item.name)}
            />
          )}
          contentContainerStyle={[styles.channelList, { paddingBottom: insets.bottom + 84 }]}
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
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 26, fontWeight: "700", letterSpacing: -0.5, paddingTop: 8 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15 },
  categoryScroll: { flexGrow: 0, marginBottom: 8 },
  categoryList: { paddingHorizontal: 16, gap: 8 },
  catPill: { paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1 },
  catPillText: { fontSize: 13, fontWeight: "500" },
  channelList: { paddingHorizontal: 12, paddingTop: 4 },
  addBtn: { alignSelf: "center", paddingHorizontal: 28, paddingVertical: 12, marginTop: 16 },
  addBtnText: { color: "#FFF", fontSize: 15, fontWeight: "600" },
});
