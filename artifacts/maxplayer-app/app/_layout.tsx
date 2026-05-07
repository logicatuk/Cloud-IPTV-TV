import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/context/AuthContext";
import { FavoritesProvider } from "@/context/FavoritesContext";
import { getLastHandledResponseId, markResponseHandled } from "@/lib/notifications";
import { PinProvider } from "@/context/PinContext";
import { PlaylistProvider } from "@/context/PlaylistContext";
import { WatchHistoryProvider } from "@/context/WatchHistoryContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 1 },
  },
});

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0F0F0F" } }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="activation" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="player"
        options={{ headerShown: false, presentation: "fullScreenModal" }}
      />
      <Stack.Screen
        name="movie/[id]"
        options={{ headerShown: false, presentation: "modal" }}
      />
      <Stack.Screen
        name="series/[id]"
        options={{ headerShown: false, presentation: "modal" }}
      />
      <Stack.Screen name="search" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="add-playlist" options={{ headerShown: false, presentation: "modal" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Deep-link to Settings when a MaxPlayer notification is tapped.
  // Handles both live (foreground/background) and cold-start (terminated) states.
  useEffect(() => {
    if (Platform.OS === "web") return;

    // Cold start: app launched by tapping a notification while terminated.
    // Uses persistent ID tracking to avoid re-navigating on subsequent launches.
    Notifications.getLastNotificationResponseAsync()
      .then(async (response) => {
        if (!response) return;
        const { identifier } = response.notification.request;
        const data = response.notification.request.content.data;
        if (data?.type !== "maxplayer") return;
        const alreadyHandled = await getLastHandledResponseId();
        if (alreadyHandled === identifier) return;
        await markResponseHandled(identifier);
        router.navigate("/(tabs)/settings");
      })
      .catch(() => {});

    // Live: app running in foreground or background.
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type === "maxplayer") {
        router.navigate("/(tabs)/settings");
      }
    });
    return () => sub.remove();
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <PlaylistProvider>
              <PinProvider>
              <FavoritesProvider>
                <WatchHistoryProvider>
                  <GestureHandlerRootView style={{ flex: 1 }}>
                    <KeyboardProvider>
                      <RootLayoutNav />
                    </KeyboardProvider>
                  </GestureHandlerRootView>
                </WatchHistoryProvider>
              </FavoritesProvider>
              </PinProvider>
            </PlaylistProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
