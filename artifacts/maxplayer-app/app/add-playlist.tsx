import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
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
import { createXtreamCredentials, verifyCredentials } from "@/lib/xtream";

export default function AddPlaylistScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { saveCredentials } = usePlaylist();

  const [host, setHost] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ valid: boolean; message?: string } | null>(null);

  const canTest = host.trim() && username.trim() && password.trim();

  const handleTest = async () => {
    if (!canTest) return;
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

  const handleSave = async () => {
    if (!canTest) return;
    setIsSaving(true);
    try {
      const creds = createXtreamCredentials(
        host.trim(),
        username.trim(),
        password.trim(),
        name.trim() || "My Playlist"
      );
      await saveCredentials(creds);
      router.dismissAll();
    } catch {
      setTestResult({ valid: false, message: "Failed to save" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
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
            style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Feather name="x" size={22} color={colors.textSecondary} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Add Playlist</Text>
          <View style={{ width: 36 }} />
        </View>

        <Text style={[styles.description, { color: colors.textSecondary }]}>
          Enter your Xtream Codes credentials from your IPTV provider.
        </Text>

        <View style={styles.form}>
          <Field
            label="Playlist Name (optional)"
            placeholder="e.g. My IPTV"
            value={name}
            onChangeText={setName}
            colors={colors}
          />

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
        </View>

        {testResult && (
          <View
            style={[
              styles.resultBox,
              {
                backgroundColor: testResult.valid
                  ? colors.success + "22"
                  : colors.destructive + "22",
                borderColor: testResult.valid ? colors.success : colors.destructive,
              },
            ]}
          >
            <Feather
              name={testResult.valid ? "check-circle" : "alert-circle"}
              size={16}
              color={testResult.valid ? colors.success : colors.destructive}
            />
            <Text
              style={[
                styles.resultText,
                { color: testResult.valid ? colors.success : colors.destructive },
              ]}
            >
              {testResult.valid ? "Connected successfully!" : testResult.message ?? "Failed"}
            </Text>
          </View>
        )}

        <View style={styles.actions}>
          <Pressable
            onPress={handleTest}
            disabled={!canTest || isTesting}
            style={({ pressed }) => [
              styles.testBtn,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: colors.radius,
                opacity: !canTest || isTesting || pressed ? 0.5 : 1,
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
            disabled={!canTest || isSaving}
            style={({ pressed }) => [
              styles.saveBtn,
              {
                backgroundColor: colors.primary,
                borderRadius: colors.radius,
                opacity: !canTest || isSaving || pressed ? 0.6 : 1,
              },
            ]}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Feather name="check" size={16} color="#FFF" />
            )}
            <Text style={styles.saveBtnText}>{isSaving ? "Saving…" : "Save Playlist"}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChangeText,
  autoCapitalize,
  keyboardType,
  secureTextEntry,
  colors,
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
        style={[
          styles.input,
          { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
        ]}
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
  container: { paddingHorizontal: 20, gap: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  description: { fontSize: 14, lineHeight: 20 },
  form: { gap: 12 },
  fieldWrap: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  resultBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  resultText: { fontSize: 14, fontWeight: "500", flex: 1 },
  actions: { gap: 10, marginTop: 8 },
  testBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderWidth: 1,
  },
  testBtnText: { fontSize: 15, fontWeight: "600" },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  saveBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});
