import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useDpad } from "../hooks/useDpad";
import { useApp } from "../context/AppContext";
import { getLiveCategories, getLiveStreams, buildLiveStreamUrl } from "../lib/xtream";
import type { XCategory, XLiveStream } from "../lib/xtream";
import { VideoPlayer } from "../components/VideoPlayer";

type Zone = "categories" | "channels" | "player";

export default function LiveTVPage() {
  const [, navigate] = useLocation();
  const { credentials } = useApp();
  const [zone, setZone] = useState<Zone>("categories");
  const [catIdx, setCatIdx] = useState(0);
  const [chanIdx, setChanIdx] = useState(0);
  const [selectedCat, setSelectedCat] = useState<XCategory | null>(null);
  const [activeStream, setActiveStream] = useState<XLiveStream | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const chanListRef = useRef<HTMLDivElement>(null);
  const catListRef = useRef<HTMLDivElement>(null);

  const { data: categories = [], isLoading: catsLoading } = useQuery({
    queryKey: ["live-categories", credentials?.host, credentials?.username],
    queryFn: () => getLiveCategories(credentials!),
    enabled: !!credentials,
    staleTime: 5 * 60 * 1000,
  });

  const { data: channels = [], isLoading: chansLoading } = useQuery({
    queryKey: ["live-streams", credentials?.host, credentials?.username, selectedCat?.category_id],
    queryFn: () => getLiveStreams(credentials!, selectedCat?.category_id),
    enabled: !!credentials,
    staleTime: 60 * 1000,
  });

  // Auto-select first category
  useEffect(() => {
    if (categories.length > 0 && !selectedCat) {
      setSelectedCat(categories[0]);
    }
  }, [categories, selectedCat]);

  // Scroll category list to keep focused item visible
  useEffect(() => {
    if (catListRef.current) {
      const el = catListRef.current.children[catIdx] as HTMLElement;
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [catIdx]);

  // Scroll channel list to keep focused item visible
  useEffect(() => {
    if (chanListRef.current) {
      const el = chanListRef.current.children[chanIdx] as HTMLElement;
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [chanIdx]);

  useDpad((dir) => {
    if (isFullscreen) {
      if (dir === "back") {
        setIsFullscreen(false);
        setZone("channels");
      }
      return;
    }

    if (dir === "back") {
      if (zone === "channels" || zone === "player") {
        setZone("categories");
      } else {
        navigate("/");
      }
      return;
    }

    if (zone === "categories") {
      if (dir === "up") setCatIdx((i) => Math.max(0, i - 1));
      else if (dir === "down") setCatIdx((i) => Math.min(categories.length - 1, i + 1));
      else if (dir === "right") setZone("channels");
      else if (dir === "enter") {
        setSelectedCat(categories[catIdx]);
        setChanIdx(0);
        setZone("channels");
      }
    } else if (zone === "channels") {
      if (dir === "up") setChanIdx((i) => Math.max(0, i - 1));
      else if (dir === "down") setChanIdx((i) => Math.min(channels.length - 1, i + 1));
      else if (dir === "left") setZone("categories");
      else if (dir === "right") setZone("player");
      else if (dir === "enter") {
        setActiveStream(channels[chanIdx]);
        setIsFullscreen(true);
      }
    } else if (zone === "player") {
      if (dir === "left") setZone("channels");
      else if (dir === "enter") {
        if (activeStream) setIsFullscreen(true);
      }
    }
  });

  if (!credentials) {
    return (
      <div style={{
        width: "1920px", height: "1080px",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        background: "var(--bg-primary)", gap: "24px",
      }}>
        <div style={{ fontSize: "48px" }}>📺</div>
        <div style={{ color: "#fff", fontSize: "32px" }}>No Playlist Connected</div>
        <div style={{ color: "var(--text-secondary)", fontSize: "24px" }}>Go to Add Playlist to connect your IPTV credentials.</div>
        <button className="tv-btn tv-btn-primary focused" onClick={() => navigate("/add-playlist")}>
          Add Playlist
        </button>
      </div>
    );
  }

  if (isFullscreen && activeStream && credentials) {
    return (
      <VideoPlayer
        url={buildLiveStreamUrl(credentials, activeStream.stream_id)}
        title={activeStream.name}
        poster={activeStream.stream_icon}
        onBack={() => { setIsFullscreen(false); setZone("channels"); }}
      />
    );
  }

  const streamUrl = activeStream ? buildLiveStreamUrl(credentials, activeStream.stream_id) : "";

  return (
    <div style={{
      width: "1920px", height: "1080px",
      background: "var(--bg-primary)",
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div className="page-header">
        <button onClick={() => navigate("/")} style={{
          background: "none", border: "none", color: "var(--text-secondary)",
          fontSize: "24px", cursor: "pointer", padding: "8px 16px",
        }}>
          ← Home
        </button>
        <div className="app-logo" style={{ fontSize: "32px" }}>Max<span>Player</span></div>
        <div style={{ color: "#fff", fontSize: "28px", fontWeight: 600 }}>Live TV</div>
        <div className="badge-live">LIVE</div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Categories sidebar */}
        <div className="sidebar" style={{ padding: "16px 0" }}>
          <div style={{
            padding: "12px 24px",
            color: "var(--text-muted)", fontSize: "18px",
            textTransform: "uppercase", letterSpacing: "0.1em",
            marginBottom: "8px",
          }}>
            Categories
          </div>
          {catsLoading ? (
            <div style={{ padding: "24px", color: "var(--text-secondary)", fontSize: "22px" }}>Loading...</div>
          ) : (
            <div ref={catListRef} className="tv-scroll" style={{ height: "calc(1080px - 80px - 32px)" }}>
              {categories.map((cat, idx) => (
                <div
                  key={cat.category_id}
                  className={`channel-item${
                    (zone === "categories" && catIdx === idx) ? " focused" :
                    selectedCat?.category_id === cat.category_id ? " active" : ""
                  }`}
                  onClick={() => {
                    setSelectedCat(cat);
                    setCatIdx(idx);
                    setChanIdx(0);
                    setZone("channels");
                  }}
                >
                  <div style={{ flex: 1, fontSize: "22px", color: "#fff" }}>{cat.category_name}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Channels list */}
        <div style={{
          width: "460px",
          height: "calc(1080px - 80px)",
          borderRight: "1px solid var(--border-subtle)",
          display: "flex", flexDirection: "column",
          overflow: "hidden", flexShrink: 0,
        }}>
          <div style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border-subtle)",
            color: "var(--text-secondary)", fontSize: "22px",
          }}>
            {selectedCat?.category_name || "All Channels"}
            <span style={{ color: "var(--text-muted)", fontSize: "18px", marginLeft: "12px" }}>
              ({channels.length})
            </span>
          </div>
          {chansLoading ? (
            <div style={{ padding: "24px", color: "var(--text-secondary)", fontSize: "22px" }}>Loading channels...</div>
          ) : channels.length === 0 ? (
            <div className="empty-state">
              <div>No channels in this category</div>
            </div>
          ) : (
            <div ref={chanListRef} className="tv-scroll" style={{ flex: 1 }}>
              {channels.map((ch, idx) => (
                <div
                  key={ch.stream_id}
                  className={`channel-item${
                    zone === "channels" && chanIdx === idx ? " focused" :
                    activeStream?.stream_id === ch.stream_id ? " active" : ""
                  }`}
                  onClick={() => {
                    setChanIdx(idx);
                    setActiveStream(ch);
                    setZone("player");
                  }}
                >
                  {ch.stream_icon ? (
                    <img
                      className="channel-logo"
                      src={ch.stream_icon}
                      alt={ch.name}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <div className="channel-logo" style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", fontSize: "24px" }}>
                      📺
                    </div>
                  )}
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div style={{ fontSize: "20px", color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ch.name}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preview / Player zone */}
        <div style={{
          flex: 1,
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>
          {activeStream && streamUrl ? (
            <div
              style={{ flex: 1, position: "relative", background: "#000", cursor: "pointer" }}
              onClick={() => setIsFullscreen(true)}
            >
              <video
                key={streamUrl}
                src={streamUrl}
                autoPlay
                muted
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
                playsInline
              />
              {/* Channel info overlay */}
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                padding: "24px 32px",
                background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)",
              }}>
                <div style={{ color: "#fff", fontSize: "28px", fontWeight: 700 }}>{activeStream.name}</div>
                <div style={{ color: "var(--text-secondary)", fontSize: "20px", marginTop: "6px" }}>
                  Press OK to watch fullscreen
                </div>
              </div>
              {zone === "player" && (
                <div style={{
                  position: "absolute", inset: 0,
                  border: "3px solid var(--accent)",
                  borderRadius: "4px",
                  pointerEvents: "none",
                  boxShadow: "var(--focus-ring)",
                }} />
              )}
            </div>
          ) : (
            <div className="empty-state">
              <div style={{ fontSize: "48px" }}>📺</div>
              <div style={{ fontSize: "26px" }}>Select a channel to preview</div>
              <div style={{ fontSize: "20px", color: "var(--text-muted)" }}>← Browse categories and channels</div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation hint */}
      <div style={{
        position: "absolute", bottom: "12px", left: 0, right: 0,
        textAlign: "center", color: "var(--text-muted)", fontSize: "18px",
      }}>
        ← → Switch sections · ↑↓ Navigate · OK Select · Back = Home
      </div>
    </div>
  );
}
