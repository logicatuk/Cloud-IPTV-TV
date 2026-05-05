import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ContentCard } from "@/components/ContentCard";
import { EmptyState } from "@/components/ErrorState";
import { useFavorites } from "@/context/FavoritesContext";
import { useColors } from "@/hooks/useColors";

const TABS = ["All", "Movies", "Series", "Channels"] as const;
type Tab = (typeof TABS)[number];

export default function FavoritesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { favorites } = useFavorites();
  const [tab, setTab] = useState<Tab>("All");
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const COLS = width > 600 ? 4 : 3;
  const CARD_WIDTH = (width - 16 * 2 - 8 * (COLS - 1)) / COLS;
  const CARD_HEIGHT = CARD_WIDTH * 1.5;

  const filtered = favorites.filter((f) => {
    if (tab === "All") return true;
    if (tab === "Movies") return f.type === "movie";
    if (tab === "Series") return f.type === "series";
    if (tab === "Channels") return f.type === "channel";
    return true;
  });

  const onPress = (id: string, type: string) => {
    if (type === "movie") router.push(`/movie/${id}`);
    else if (type === "series") router.push(`/series/${id}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Favorites</Text>
      </View>

      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {TABS.map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[
              styles.tabItem,
              tab === t && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                { color: tab === t ? colors.primary : colors.textSecondary },
              ]}
            >
              {t}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtered}
        numColumns={COLS}
        key={`cols-${COLS}`}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        renderItem={({ item }) => (
          <View style={{ padding: 4 }}>
            <ContentCard
              title={item.name}
              poster={item.poster}
              meta={item.meta}
              onPress={() => onPress(item.id, item.type)}
              width={CARD_WIDTH}
              height={CARD_HEIGHT}
            />
          </View>
        )}
        contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 84 }]}
        ListEmptyComponent={
          <EmptyState
            message={`No ${tab === "All" ? "" : tab.toLowerCase() + " "}favorites yet`}
            icon="heart"
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 26, fontWeight: "700", letterSpacing: -0.5, paddingTop: 8 },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
  },
  grid: { paddingHorizontal: 12 },
});
