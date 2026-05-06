import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// ─── Notification identifiers (fixed so we can cancel + reschedule) ───────────

const ACTIVATION_ID = "maxplayer-activation";
const EXPIRY_7D_ID = "maxplayer-expiry-7d";
const EXPIRY_1D_ID = "maxplayer-expiry-1d";

// ─── Foreground handler (set once at module level) ────────────────────────────

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

// ─── Permission request ────────────────────────────────────────────────────────

export async function requestPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

// ─── Activation notification ──────────────────────────────────────────────────

export async function scheduleActivationNotification(): Promise<void> {
  if (Platform.OS === "web") return;

  await Notifications.cancelScheduledNotificationAsync(ACTIVATION_ID).catch(() => {});

  await Notifications.scheduleNotificationAsync({
    identifier: ACTIVATION_ID,
    content: {
      title: "MaxPlayer Activated!",
      body: "Your device is now active. Start watching.",
      data: { type: "maxplayer" },
    },
    trigger: null,
  });
}

// ─── Expiry reminders ─────────────────────────────────────────────────────────

export async function scheduleExpiryReminder(expiresAt: string): Promise<void> {
  if (Platform.OS === "web") return;

  const expiryMs = new Date(expiresAt).getTime();
  if (isNaN(expiryMs)) return;

  const now = Date.now();
  const sevenDaysMs = expiryMs - 7 * 24 * 60 * 60 * 1000;
  const oneDayMs = expiryMs - 24 * 60 * 60 * 1000;

  // Cancel existing reminders before rescheduling so IDs stay unique
  await Promise.all([
    Notifications.cancelScheduledNotificationAsync(EXPIRY_7D_ID).catch(() => {}),
    Notifications.cancelScheduledNotificationAsync(EXPIRY_1D_ID).catch(() => {}),
  ]);

  if (sevenDaysMs > now) {
    await Notifications.scheduleNotificationAsync({
      identifier: EXPIRY_7D_ID,
      content: {
        title: "License Expiring Soon",
        body: "Your MaxPlayer license expires in 7 days. Contact your provider to renew.",
        data: { type: "maxplayer" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(sevenDaysMs),
      },
    });
  }

  if (oneDayMs > now) {
    await Notifications.scheduleNotificationAsync({
      identifier: EXPIRY_1D_ID,
      content: {
        title: "License Expiring Tomorrow",
        body: "Your MaxPlayer license expires tomorrow. Contact your provider to renew.",
        data: { type: "maxplayer" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(oneDayMs),
      },
    });
  }
}

// ─── Cancel all ───────────────────────────────────────────────────────────────

export async function cancelAllNotifications(): Promise<void> {
  if (Platform.OS === "web") return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}
