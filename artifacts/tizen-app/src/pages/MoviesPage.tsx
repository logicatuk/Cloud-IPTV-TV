import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useDpad } from "../hooks/useDpad";
import { useApp } from "../context/AppContext";
import { getVodCategories, getVodStreams, getVodInfo, buildVodStreamUrl } from "../lib/xtream";
import type { XCategory, XVodStream } from "../lib/xtream";
import { VideoPlayer } from "../components/VideoPlayer";

type Zone = "categories" | "grid";

const GRID_COLS = 5;

export default function MoviesPage() {
  const [, navigate] = useLocation();
  const { credentials } = useApp();
  const [zone, setZone] = useState<Zone>("categories");
  const [catIdx, setCatIdx] = useState(0);
  const [gridIdx, setGridIdx] = useState(0);
  const [selectedCat, setSelectedCat] = useState<XCategory | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [playingTitle, setPlayingTitle] = useState("");
  const [playingPoster, setPlayingPoster] = useState("");
  const catListRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const { data: categories = [], isLoading: catsLoading } = useQuery({
    queryKey: ["vod-categories", credentials?.host, credentials?.username],
    queryFn: () => getVodCategories(credentials!),
    enabled: !!credentials,
    staleTime: 5 * 60 * 1000,
  });

  const { data: movies = [], isLoading: moviesLoading } = useQuery({
    queryKey: ["vod-streams", credentials?.host, credentials?.username, selectedCat?.category_id],
    queryFn: () => getVodStreams(credentials!, selectedCat?.category_id),
    enabled: !!credentials,
    staleTime: 2 * 60 * 1000,
  });

  useEffect(() => {
    if (categories.length > 0 && !selectedCat) {
      setSelectedCat(categories[0]);
    }
  }, [categories, selectedCat]);

  useEffect(() => {
    if (catListRef.current) {
      const el = catListRef.current.children[catIdx] as HTMLElement;
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [catIdx]);

  useEffect(() => {
    if (gridRef.current) {
      const row = Math.floor(gridIdx / GRID_COLS);
      const el = gridRef.current.children[row] as HTMLElement;
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [gridIdx]);

  useDpad((dir) => {
    if (playingUrl) {
      if (dir === "back") setPlayingUrl(null);
      return;
    }

    if (dir === "back") {
      if (zone === "grid") { setZone("categories"); setGridIdx(0); }
      else navigate("/");
      return;
    }

    const maxGrid = movies.length;

    if (zone === "categories") {
      if (dir === "up") setCatIdx((i) => Math.max(0, i - 1));
      else if (dir === "down") setCatIdx((i) => Math.min(categories.length - 1, i + 1));
      else if (dir === "right") { setZone("grid"); }
      else if (dir === "enter") {
        setSelectedCat(categories[catIdx]);
        setGridIdx(0);
        setZone("grid");
      }
    } else if (zone === "grid") {
      if (dir === "up") setGridIdx((i) => Math.max(0, i - GRID_COLS));
      else if (dir === "down") setGridIdx((i) => Math.min(maxGrid - 1, i + GRID_COLS));
      else if (dir === "left") {
        if (gridIdx % GRID_COLS === 0) setZone("categories");
        else setGridIdx((i) => Math.max(0, i - 1));
      }
      else if (dir === "right") setGridIdx((i) => Math.min(maxGrid - 1, i + 1));
      else if (dir === "enter") {
        const movie = movies[gridIdx];
        if (movie && credentials) {
          setPlayingTitle(movie.name);
          setPlayingPoster(movie.stream_icon);
          setPlayingUrl(buildVodStreamUrl(credentials, movie.stream_id, movie.container_extension));
        }
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
        <div style={{ fontSize: "48px" }}>🎬</div>
        <div style={{ color: "#fff", fontSize: "32px" }}>No Playlist Connected</div>
        <button className="tv-btn tv-btn-primary focused" onClick={() => navigate("/add-playlist")}>Add Playlist</button>
      </div>
    );
  }

  if (playingUrl) {
    return (
      <VideoPlayer
        url={playingUrl}
        title={playingTitle}
        poster={playingPoster}
        onBack={() => setPlayingUrl(null)}
      />
    );
  }

  const gridRows: XVodStream[][] = [];
  for (let i = 0; i < movies.length; i += GRID_COLS) {
    gridRows.push(movies.slice(i, i + GRID_COLS));
  }

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
        }}>← Home</button>
        <div className="app-logo" style={{ fontSize: "32px" }}>Max<span>Player</span></div>
        <div style={{ color: "#fff", fontSize: "28px", fontWeight: 600 }}>Movies</div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Categories */}
        <div className="sidebar" style={{ padding: "16px 0" }}>
          <div style={{ padding: "12px 24px", color: "var(--text-muted)", fontSize: "18px", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>
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
                    zone === "categories" && catIdx === idx ? " focused" :
                    selectedCat?.category_id === cat.category_id ? " active" : ""
                  }`}
                  onClick={() => { setSelectedCat(cat); setCatIdx(idx); setGridIdx(0); setZone("grid"); }}
                >
                  <div style={{ flex: 1, fontSize: "22px", color: "#fff" }}>{cat.category_name}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Movie grid */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{
            padding: "20px 32px", borderBottom: "1px solid var(--border-subtle)",
            color: "var(--text-secondary)", fontSize: "22px",
          }}>
            {selectedCat?.category_name || "All Movies"}
            <span style={{ color: "var(--text-muted)", fontSize: "18px", marginLeft: "12px" }}>({movies.length})</span>
          </div>

          {moviesLoading ? (
            <div className="empty-state">
              <div className="animate-spin" style={{ width: "64px", height: "64px", border: "6px solid rgba(255,255,255,0.1)", borderTopColor: "var(--accent)", borderRadius: "50%" }} />
              <div style={{ color: "var(--text-secondary)", fontSize: "24px" }}>Loading movies...</div>
            </div>
          ) : movies.length === 0 ? (
            <div className="empty-state">
              <div style={{ fontSize: "48px" }}>🎬</div>
              <div style={{ fontSize: "24px" }}>No movies in this category</div>
            </div>
          ) : (
            <div ref={gridRef} className="tv-scroll" style={{ flex: 1, padding: "24px 32px" }}>
              {gridRows.map((row, rowIdx) => (
                <div key={rowIdx} style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
                  {row.map((movie, colIdx) => {
                    const absIdx = rowIdx * GRID_COLS + colIdx;
                    const isFocused = zone === "grid" && gridIdx === absIdx;
                    return (
                      <div
                        key={movie.stream_id}
                        className={`content-card${isFocused ? " focused" : ""}`}
                        style={{ width: "220px", flexShrink: 0 }}
                        onClick={() => {
                          setGridIdx(absIdx);
                          if (credentials) {
                            setPlayingTitle(movie.name);
                            setPlayingPoster(movie.stream_icon);
                            setPlayingUrl(buildVodStreamUrl(credentials, movie.stream_id, movie.container_extension));
                          }
                        }}
                        onMouseEnter={() => { setGridIdx(absIdx); setZone("grid"); }}
                      >
                        <div style={{ width: "220px", height: "310px", position: "relative", background: "var(--bg-elevated)" }}>
                          {movie.stream_icon ? (
                            <img
                              src={movie.stream_icon}
                              alt={movie.name}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              onError={(e) => { (e.target as HTMLImageElement).src = ""; }}
                            />
                          ) : (
                            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "48px" }}>🎬</div>
                          )}
                          <div className="card-gradient" />
                          {movie.rating_5based > 0 && (
                            <div style={{
                              position: "absolute", bottom: "8px", left: "8px",
                              background: "rgba(0,0,0,0.7)", color: "#ffd700",
                              fontSize: "16px", padding: "3px 8px", borderRadius: "4px",
                            }}>
                              ★ {movie.rating_5based.toFixed(1)}
                            </div>
                          )}
                        </div>
                        <div style={{ padding: "10px 12px" }}>
                          <div style={{
                            color: "#fff", fontSize: "18px", fontWeight: 600,
                            overflow: "hidden", textOverflow: "ellipsis",
                            whiteSpace: "nowrap", lineHeight: 1.3,
                          }}>{movie.name}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{
        position: "absolute", bottom: "12px", left: 0, right: 0,
        textAlign: "center", color: "var(--text-muted)", fontSize: "18px",
      }}>
        ← Switch to categories · ↑↓←→ Browse · OK = Play · Back = Home
      </div>
    </div>
  );
}
