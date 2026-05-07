import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { useDpad } from "../hooks/useDpad";
import { createXtreamCredentials, verifyCredentials } from "../lib/xtream";
import { useApp } from "../context/AppContext";

const FIELDS = ["name", "host", "username", "password"] as const;
type Field = typeof FIELDS[number];

const LABELS: Record<Field, string> = {
  name: "Playlist Name",
  host: "Server URL",
  username: "Username",
  password: "Password",
};

const PLACEHOLDERS: Record<Field, string> = {
  name: "My IPTV",
  host: "http://example.com:8080",
  username: "user123",
  password: "password123",
};

export default function AddPlaylistPage() {
  const [, navigate] = useLocation();
  const { setCredentials } = useApp();
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [values, setValues] = useState<Record<Field, string>>({
    name: "",
    host: "",
    username: "",
    password: "",
  });
  const [status, setStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const inputRefs = useRef<Record<Field, HTMLInputElement | null>>({
    name: null, host: null, username: null, password: null,
  });

  // 4 fields + 2 buttons (Test, Save)
  const TOTAL_ITEMS = FIELDS.length + 2;
  const TEST_IDX = FIELDS.length;
  const SAVE_IDX = FIELDS.length + 1;

  useDpad((dir) => {
    if (dir === "back") {
      navigate("/");
      return;
    }
    if (dir === "up") {
      setFocusedIndex((i) => Math.max(0, i - 1));
    } else if (dir === "down") {
      setFocusedIndex((i) => Math.min(TOTAL_ITEMS - 1, i + 1));
    } else if (dir === "enter") {
      if (focusedIndex < FIELDS.length) {
        // Focus the input
        const field = FIELDS[focusedIndex];
        inputRefs.current[field]?.focus();
      } else if (focusedIndex === TEST_IDX) {
        handleTest();
      } else if (focusedIndex === SAVE_IDX) {
        handleSave();
      }
    }
  });

  const handleTest = async () => {
    if (!values.host || !values.username || !values.password) {
      setMessage("Please fill in Server URL, Username, and Password.");
      setStatus("error");
      return;
    }
    setStatus("testing");
    setMessage("Testing connection...");
    try {
      const creds = createXtreamCredentials(values.host, values.username, values.password, values.name || "My Playlist");
      const result = await verifyCredentials(creds);
      if (result.valid) {
        setStatus("success");
        setMessage("Connection successful!");
      } else {
        setStatus("error");
        setMessage(result.message || "Connection failed.");
      }
    } catch (e: unknown) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Unknown error");
    }
  };

  const handleSave = () => {
    if (!values.host || !values.username || !values.password) {
      setMessage("Please fill in all required fields.");
      setStatus("error");
      return;
    }
    const creds = createXtreamCredentials(
      values.host,
      values.username,
      values.password,
      values.name || "My Playlist"
    );
    setCredentials(creds);
    navigate("/");
  };

  return (
    <div style={{
      width: "1920px",
      height: "1080px",
      background: "var(--bg-primary)",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div className="page-header">
        <button
          onClick={() => navigate("/")}
          style={{
            background: "none", border: "none", color: "var(--text-secondary)",
            fontSize: "24px", cursor: "pointer", padding: "8px 16px",
            display: "flex", alignItems: "center", gap: "8px",
          }}
        >
          ← Back
        </button>
        <div className="app-logo" style={{ fontSize: "32px" }}>Max<span>Player</span></div>
        <div style={{ color: "var(--text-primary)", fontSize: "28px", fontWeight: 600 }}>
          Add Playlist
        </div>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px",
      }}>
        <div style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "20px",
          padding: "56px 72px",
          width: "900px",
          display: "flex",
          flexDirection: "column",
          gap: "28px",
        }}>
          <div style={{ color: "#fff", fontSize: "30px", fontWeight: 700, marginBottom: "8px" }}>
            Xtream Codes Credentials
          </div>

          {FIELDS.map((field, idx) => (
            <div key={field} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <label style={{ color: "var(--text-secondary)", fontSize: "22px" }}>
                {LABELS[field]}
              </label>
              <input
                ref={(el) => { inputRefs.current[field] = el; }}
                type={field === "password" ? "password" : "text"}
                className={`tv-input${focusedIndex === idx ? " focused" : ""}`}
                placeholder={PLACEHOLDERS[field]}
                value={values[field]}
                onChange={(e) => setValues((v) => ({ ...v, [field]: e.target.value }))}
                onFocus={() => setFocusedIndex(idx)}
              />
            </div>
          ))}

          {/* Status message */}
          {message && (
            <div style={{
              padding: "16px 24px",
              borderRadius: "8px",
              background: status === "success" ? "rgba(0,200,100,0.1)" : "rgba(229,9,20,0.1)",
              border: `1px solid ${status === "success" ? "rgba(0,200,100,0.3)" : "rgba(229,9,20,0.3)"}`,
              color: status === "success" ? "#00c864" : "#ff4444",
              fontSize: "22px",
            }}>
              {message}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: "flex", gap: "20px", marginTop: "8px" }}>
            <button
              className={`tv-btn tv-btn-secondary${focusedIndex === TEST_IDX ? " focused" : ""}`}
              style={{ flex: 1 }}
              onClick={handleTest}
              onFocus={() => setFocusedIndex(TEST_IDX)}
              disabled={status === "testing"}
            >
              {status === "testing" ? "Testing..." : "Test Connection"}
            </button>
            <button
              className={`tv-btn tv-btn-primary${focusedIndex === SAVE_IDX ? " focused" : ""}`}
              style={{ flex: 1 }}
              onClick={handleSave}
              onFocus={() => setFocusedIndex(SAVE_IDX)}
            >
              Save &amp; Connect
            </button>
          </div>

          <div style={{ color: "var(--text-muted)", fontSize: "20px", textAlign: "center" }}>
            ↑↓ Navigate · OK Select · Back = Home
          </div>
        </div>
      </div>
    </div>
  );
}
