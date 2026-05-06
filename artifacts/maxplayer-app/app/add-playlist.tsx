import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePlaylist } from "@/context/PlaylistContext";
import { useColors } from "@/hooks/useColors";
import type { M3UPlaylist, XtreamPlaylist } from "@/lib/playlist-types";
import { fetchAndParseM3U } from "@/lib/m3u";
import { createXtreamCredentials, verifyCredentials } from "@/lib/xtream";

type Tab = "xtream" | "m3u";

export default function AddPlaylistScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const { playlists, addPlaylist, updatePlaylist, connectPlaylist } = usePlaylist();

  const editPlaylist = editId ? playlists.find((p) => p.id === editId) : null;
  const isEditing = !!editPlaylist;

  const [tab, setTab] = useState<Tab>(editPlaylist?.type === "m3u" ? "m3u" : "xtream");
  const [name, setName] = useState(editPlaylist?.name ?? "");
  const [host, setHost] = useState(editPlaylist?.type === "xtream" ? editPlaylist.host : "");
  const [username, setUsername] = useState(editPlaylist?.type === "xtream" ? editPlaylist.username : "");
  const [password, setPassword] = useState(editPlaylist?.type === "xtream" ? editPlaylist.password : "");
  const [m3uUrl, setM3uUrl] = useState(editPlaylist?.type === "m3u" ? editPlaylist.url : "");

  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ valid: boolean; message?: string } | null>(null);

  useEffect(() => {
    setTestResult(null);
  }, [tab]);

  const canSaveXtream = host.trim().length > 0 && username.trim().length > 0 && password.trim().length > 0;
  const canSaveM3U = m3uUrl.trim().startsWith("http");
  const canSave = isEditing
    ? (editPlaylist?.type === "xtream" ? canSaveXtream : canSaveM3U)
    : (tab === "xtream" ? canSaveXtream : canSaveM3U);

  const handleTestXtream = async () => {
    if (!canSaveXtream) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const creds = createXtreamCredentials(host.trim(), username.trim(), password.trim());
      const result = await verifyCredentials(creds);
      setTestResult(result);
    } catch {
      setTestResult({ valid: false, message: "Connection error" });
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestM3U = async () => {
    if (!canSaveM3U) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await fetchAndParseM3U(m3uUrl.trim());
      if (result.channels.length > 0) {
        setTestResult({ valid: true, message: `Found ${result.channels.length} channels` });
      } else {
        setTestResult({ valid: false, message: "No channels found in this URL" });
      }
    } catch {
      setTestResult({ valid: false, message: "Could not connect or parse playlist" });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!canSave) return;
    setIsSaving(true);
    try {
      if (isEditing && editPlaylist) {
        if (editPlaylist.type === "xtream") {
          await updatePlaylist(editPlaylist.id, {
            name: name.trim() || "My Playlist",
            host: host.trim(),
            username: username.trim(),
            password: password.trim(),
          });
        } else {
          await updatePlaylist(editPlaylist.id, {
            name: name.trim() || "M3U Playlist",
            url: m3uUrl.trim(),
          });
        }
        router.back();
      } else {
        if (tab === "xtream") {
          const data: Omit<XtreamPlaylist, "id" | "addedAt"> = {
            type: "xtream",
            name: name.trim() || "My Playlist",
            host: host.trim(),
            username: username.trim(),
            password: password.trim(),
          };
          const newPl = await addPlaylist(data);
          await connectPlaylist(newPl.id);
        } else {
          const data: Omit<M3UPlaylist, "id" | "addedAt"> = {
            type: "m3u",
            name: name.trim() || "M3U Playlist",
            url: m3uUrl.trim(),
          };
          const newPl = await addPlaylist(data);
          await connectPlaylist(newPl.id);
        }
        router.dismissAll();
      }
    } catch {
      setTestResult({ valid: false, message: "Failed to save. Please try again." });
    } finally {
      setIsSaving(false);
    }
  };

  const activeTab = isEditing ? editPlaylist!.type : tab;
  const onTest = activeTab === "xtream" ? handleTestXtream : handleTestM3U;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Feather name="x" size={22} color={colors.textSecondary} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {isEditing ? "Edit Playlist" : "Add Playlist"}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        {!isEditing && (
          <View style={[styles.tabRow, { backgroundColor: colors.surfaceHigh, borderRadius: 10 }]}>
            {(["xtream", "m3u"] as Tab[]).map((t) => (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                style={[
                  styles.tabBtn,
                  { backgroundColor: tab === t ? colors.primary : "transparent", borderRadius: 8 },
                ]}
              >
                <Feather
                  name={t === "xtream" ? "tv" : "link"}
                  size={14}
                  color={tab === t ? "#FFF" : colors.textSecondary}
                />
                <Text style={[styles.tabText, { color: tab === t ? "#FFF" : colors.textSecondary }]}>
                  {t === "xtream" ? "Xtream Codes" : "M3U URL"}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <Field
          label="Playlist Name (optional)"
          placeholder={activeTab === "xtream" ? "e.g. My IPTV" : "e.g. My M3U List"}
          value={name}
          onChangeText={setName}
          colors={colors}
        />

        {activeTab === "xtream" && (
          <>
            <Field
              label="Server URL"
              placeholder="http://myiptv.com:8080"
              value={host}
              onChangeText={(t) => { setHost(t); setTestResult(null); }}
              autoCapitalize="none"
              keyboardType="url"
              colors={colors}
            />
            <Field
              label="Username"
              placeholder="username"
              value={username}
              onChangeText={(t) => { setUsername(t); setTestResult(null); }}
              autoCapitalize="none"
              colors={colors}
            />
            <Field
              label="Password"
              placeholder="password"
              value={password}
              onChangeText={(t) => { setPassword(t); setTestResult(null); }}
              autoCapitalize="none"
              secureTextEntry
              colors={colors}
            />
          </>
        )}

        {activeTab === "m3u" && (
          <>
            <Field
              label="M3U URL"
              placeholder="http://myiptv.com/get.php?username=…&type=m3u"
              value={m3uUrl}
              onChangeText={(t) => { setM3uUrl(t); setTestResult(null); }}
              autoCapitalize="none"
              keyboardType="url"
              colors={colors}
            />
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              M3U playlists support Live TV channels. For Movies & Series, use Xtream Codes.
            </Text>
          </>
        )}

        {testResult && (
          <View
            style={[
              styles.resultBox,
              {
                backgroundColor: testResult.valid ? colors.success + "22" : colors.destructive + "22",
                borderColor: testResult.valid ? colors.success : colors.destructive,
              },
            ]}
          >
            <Feather
              name={testResult.valid ? "check-circle" : "alert-circle"}
              size={16}
              color={testResult.valid ? colors.success : colors.destructive}
            />
            <Text style={[styles.resultText, { color: testResult.valid ? colors.success : colors.destructive }]}>
              {testResult.valid
                ? `Connected! ${testResult.message ?? ""}`.trim()
                : (testResult.message ?? "Failed")}
            </Text>
          </View>
        )}

        <View style={styles.btnGroup}>
          <Pressable
            onPress={onTest}
            disabled={!canSave || isTesting}
            style={({ pressed }) => [
              styles.testBtn,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: colors.radius,
                opacity: !canSave || isTesting || pressed ? 0.5 : 1,
              },
            ]}
          >
            {isTesting ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Feather name="wifi" size={16} color={colors.primary} />
            )}
            <Text style={[styles.testBtnText, { color: colors.primary }]}>
              {isTesting ? "Testing…" : "Test Connection"}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleSave}
            disabled={!canSave || isSaving}
            style={({ pressed }) => [
              styles.saveBtn,
              {
                backgroundColor: colors.primary,
                borderRadius: colors.radius,
                opacity: !canSave || isSaving || pressed ? 0.6 : 1,
              },
            ]}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Feather name="check" size={16} color="#FFF" />
            )}
            <Text style={styles.saveBtnText}>
              {isSaving ? "Saving…" : isEditing ? "Save Changes" : "Add Playlist"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label, placeholder, value, onChangeText, autoCapitalize, keyboardType, secureTextEntry, colors,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  autoCapitalize?: "none" | "sentences";
  keyboardType?: "default" | "url";
  secureTextEntry?: boolean;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize={autoCapitalize ?? "none"}
        keyboardType={keyboardType ?? "default"}
        secureTextEntry={secureTextEntry}
        autoCorrect={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, gap: 14 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  iconBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  tabRow: { flexDirection: "row", padding: 4, gap: 4 },
  tabBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9 },
  tabText: { fontSize: 14, fontWeight: "600" },
  fieldWrap: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: "600" },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  hint: { fontSize: 13, lineHeight: 18 },
  resultBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  resultText: { fontSize: 14, fontWeight: "500", flex: 1 },
  btnGroup: { gap: 10, marginTop: 4 },
  testBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderWidth: 1 },
  testBtnText: { fontSize: 15, fontWeight: "600" },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14 },
  saveBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});
