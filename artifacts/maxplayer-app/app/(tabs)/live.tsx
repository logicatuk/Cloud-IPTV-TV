import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { useState } from "react";
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
import { getLiveCategories, getLiveChannels, getLiveStreamUrl } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

export default function LiveScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { status, hasPlaylist } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string | number>("all");
  const [search, setSearch] = useState("");
  const [playingId, setPlayingId] = useState<string | number | null>(null);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: categories } = useQuery({
    queryKey: ["live-categories"],
    queryFn: getLiveCategories,
    enabled: status === "active" && hasPlaylist,
  });

  const { data: channelData, isLoading, error, refetch } = useQuery({
    queryKey: ["live-channels", selectedCategory, search],
    queryFn: () =>
      getLiveChannels({
        category_id: selectedCategory === "all" ? undefined : selectedCategory,
        search: search || undefined,
        limit: 200,
      }),
    enabled: status === "active" && hasPlaylist,
    retry: 1,
  });

  const playChannel = async (channelId: string | number, name: string) => {
    try {
      setPlayingId(channelId);
      const { url } = await getLiveStreamUrl(channelId);
      router.push(`/player?url=${encodeURIComponent(url)}&title=${encodeURIComponent(name)}&type=live`);
    } catch {
      setPlayingId(null);
    }
  };

  if (status !== "active" || !hasPlaylist) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <EmptyState message="Activate your device to watch live TV" icon="tv" />
      </View>
    );
  }

  const allCategories = [{ id: "all", name: "All Channels" }, ...(categories ?? [])];

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
            key={String(cat.id)}
            onPress={() => setSelectedCategory(cat.id)}
            style={[
              styles.catPill,
              {
                backgroundColor:
                  selectedCategory === cat.id ? colors.primary : colors.surface,
                borderColor:
                  selectedCategory === cat.id ? colors.primary : colors.border,
                borderRadius: 20,
              },
            ]}
          >
            <Text
              style={[
                styles.catPillText,
                {
                  color:
                    selectedCategory === cat.id ? "#FFFFFF" : colors.textSecondary,
                },
              ]}
            >
              {cat.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {isLoading && <LoadingList count={10} />}
      {error && !isLoading && (
        <ErrorState message="Unable to load channels" onRetry={refetch} />
      )}

      {channelData && !isLoading && (
        <FlatList
          data={channelData.channels}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <ChannelCard
              channel={item}
              isActive={playingId === item.id}
              onPress={() => playChannel(item.id, item.name)}
            />
          )}
          contentContainerStyle={[
            styles.channelList,
            { paddingBottom: insets.bottom + 84 },
          ]}
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
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.5,
    paddingTop: 8,
  },
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
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  categoryScroll: {
    flexGrow: 0,
    marginBottom: 8,
  },
  categoryList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  catPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
  },
  catPillText: {
    fontSize: 13,
    fontWeight: "500",
  },
  channelList: {
    paddingHorizontal: 12,
    paddingTop: 4,
  },
});
