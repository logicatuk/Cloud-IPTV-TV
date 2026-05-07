import { useState } from "react";
import { useLocation } from "wouter";
import { useDpad } from "../hooks/useDpad";
import { useApp } from "../context/AppContext";

const MENU_ITEMS = [
  {
    id: "live",
    label: "Live TV",
    icon: "📺",
    description: "Watch live channels",
    path: "/live",
  },
  {
    id: "movies",
    label: "Movies",
    icon: "🎬",
    description: "Browse movies on demand",
    path: "/movies",
  },
  {
    id: "series",
    label: "Series",
    icon: "🎭",
    description: "TV shows & series",
    path: "/series",
  },
  {
    id: "playlist",
    label: "Add Playlist",
    icon: "➕",
    description: "Connect Xtream credentials",
    path: "/add-playlist",
  },
];

export default function HomePage() {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [, navigate] = useLocation();
  const { mac, credentials } = useApp();

  useDpad((dir) => {
    if (dir === "up") {
      setFocusedIndex((i) => Math.max(0, i - 1));
    } else if (dir === "down") {
      setFocusedIndex((i) => Math.min(MENU_ITEMS.length - 1, i + 1));
    } else if (dir === "enter") {
      navigate(MENU_ITEMS[focusedIndex].path);
    }
  });

  return (
    <div style={{
      width: "1920px",
      height: "1080px",
      background: "var(--bg-primary)",
      display: "flex",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Background gradient */}
      <div style={{
        position: "absolute",
        top: 0, left: 0, right: 0, bottom: 0,
        background: "radial-gradient(ellipse at 20% 50%, rgba(229,9,20,0.05) 0%, transparent 60%)",
        pointerEvents: "none",
      }} />

      {/* Left panel — branding */}
      <div style={{
        width: "640px",
        height: "1080px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "0 80px",
        background: "linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-primary) 100%)",
        borderRight: "1px solid var(--border-subtle)",
        flexShrink: 0,
      }}>
        <div className="app-logo" style={{ fontSize: "64px", marginBottom: "16px" }}>
          Max<span>Player</span>
        </div>
        <div style={{
          color: "var(--text-secondary)",
          fontSize: "26px",
          lineHeight: 1.5,
          marginBottom: "48px",
        }}>
          Your premium IPTV experience
        </div>

        {credentials && (
          <div style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "12px",
            padding: "20px 24px",
            marginBottom: "24px",
          }}>
            <div style={{ color: "var(--text-muted)", fontSize: "18px", marginBottom: "6px" }}>
              Connected to
            </div>
            <div style={{ color: "#fff", fontSize: "22px", fontWeight: 600, wordBreak: "break-all" }}>
              {credentials.name}
            </div>
          </div>
        )}

        {!credentials && (
          <div style={{
            background: "rgba(229,9,20,0.08)",
            border: "1px solid rgba(229,9,20,0.3)",
            borderRadius: "12px",
            padding: "20px 24px",
            color: "var(--text-secondary)",
            fontSize: "20px",
            lineHeight: 1.5,
          }}>
            No playlist connected. Select "Add Playlist" to get started.
          </div>
        )}

        <div style={{
          marginTop: "auto",
          color: "var(--text-muted)",
          fontSize: "18px",
        }}>
          Device: {mac.slice(-8)}
        </div>
      </div>

      {/* Right panel — menu */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "0 120px",
        gap: "24px",
      }}>
        <div style={{
          color: "var(--text-secondary)",
          fontSize: "24px",
          marginBottom: "16px",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}>
          Select a Section
        </div>

        {MENU_ITEMS.map((item, idx) => (
          <div
            key={item.id}
            className={`home-menu-item${focusedIndex === idx ? " focused" : ""}`}
            style={{ animationDelay: `${idx * 0.06}s` }}
            onClick={() => navigate(item.path)}
            onMouseEnter={() => setFocusedIndex(idx)}
          >
            <div className="menu-icon">{item.icon}</div>
            <div>
              <div style={{ color: "#fff", fontSize: "30px", fontWeight: 700, marginBottom: "6px" }}>
                {item.label}
              </div>
              <div style={{ color: "var(--text-secondary)", fontSize: "22px" }}>
                {item.description}
              </div>
            </div>
            {focusedIndex === idx && (
              <div style={{ marginLeft: "auto", color: "var(--accent)", fontSize: "28px" }}>
                ›
              </div>
            )}
          </div>
        ))}

        <div style={{
          marginTop: "24px",
          color: "var(--text-muted)",
          fontSize: "20px",
        }}>
          ↑↓ Navigate · OK Select
        </div>
      </div>
    </div>
  );
}
