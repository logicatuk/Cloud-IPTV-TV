import { Redirect } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { usePlaylist } from "@/context/PlaylistContext";

export default function Index() {
  const { isReady, isActive, macAddress, hasPlaylist } = useAuth();
  const { hasCredentials, isLoading: playlistLoading, tryFetchFromBackend } = usePlaylist();

  useEffect(() => {
    if (isActive && !hasCredentials && !playlistLoading && hasPlaylist && macAddress) {
      tryFetchFromBackend(macAddress);
    }
  }, [isActive, hasCredentials, playlistLoading, hasPlaylist, macAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isReady || playlistLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0A84FF" />
        <Text style={styles.text}>Loading…</Text>
      </View>
    );
  }

  if (isActive) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/activation" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F0F0F",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  text: { color: "#9A9A9A", fontSize: 15 },
});
