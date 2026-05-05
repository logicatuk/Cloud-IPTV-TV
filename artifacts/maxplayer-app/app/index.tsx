import { Redirect } from "expo-router";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/context/AuthContext";

export default function Index() {
  const { isReady, status, hasPlaylist } = useAuth();

  if (!isReady) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0A84FF" />
        <Text style={styles.text}>Loading…</Text>
      </View>
    );
  }

  if (status === "active" && hasPlaylist) {
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
  text: {
    color: "#9A9A9A",
    fontSize: 15,
  },
});
