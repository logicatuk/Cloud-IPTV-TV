import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useDpad } from "../hooks/useDpad";
import { useApp } from "../context/AppContext";
import { getSeriesCategories, getSeriesList, getSeriesInfo, buildEpisodeStreamUrl } from "../lib/xtream";
import type { XCategory, XSeriesStream, XEpisode } from "../lib/xtream";
import { VideoPlayer } from "../components/VideoPlayer";

type Zone = "categories" | "grid" | "detail";
const GRID_COLS = 4;

export default function SeriesPage() {
  const [, navigate] = useLocation();
  const { credentials } = useApp();
  const [zone, setZone] = useState<Zone>("categories");
  const [catIdx, setCatIdx] = useState(0);
  const [gridIdx, setGridIdx] = useState(0);
  const [detailIdx, setDetailIdx] = useState(0);
  const [selectedCat, setSelectedCat] = useState<XCategory | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<XSeriesStream | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<string>("1");
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [playingTitle, setPlayingTitle] = useState("");
  const catListRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const episodeListRef = useRef<HTMLDivElement>(null);

  const { data: categories = [], isLoading: catsLoading } = useQuery({
    queryKey: ["series-categories", credentials?.host, credentials?.username],
    queryFn: () => getSeriesCategories(credentials!),
    enabled: !!credentials,
    staleTime: 5 * 60 * 1000,
  });

  const { data: seriesList = [], isLoading: seriesLoading } = useQuery({
    queryKey: ["series-list", credentials?.host, credentials?.username, selectedCat?.category_id],
    queryFn: () => getSeriesList(credentials!, selectedCat?.category_id),
    enabled: !!credentials,
    staleTime: 2 * 60 * 1000,
  });

  const { data: seriesInfo } = useQuery({
    queryKey: ["series-info", credentials?.host, credentials?.username, selectedSeries?.series_id],
    queryFn: () => getSeriesInfo(credentials!, selectedSeries!.series_id),
    enabled: !!credentials && !!selectedSeries,
    staleTime: 5 * 60 * 1000,
  });

  const seasons = seriesInfo ? Object.keys(seriesInfo.episodes).sort((a, b) => Number(a) - Number(b)) : [];
  const episodes: XEpisode[] = seriesInfo?.episodes[selectedSeason] ?? [];

  useEffect(() => {
    if (categories.length > 0 && !selectedCat) setSelectedCat(categories[0]);
  }, [categories, selectedCat]);

  useEffect(() => {
    if (seasons.length > 0 && !seasons.includes(selectedSeason)) setSelectedSeason(seasons[0]);
  }, [seasons, selectedSeason]);

  useEffect(() => {
    if (catListRef.current) {
      const el = catListRef.current.children[catIdx] as HTMLElement;
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [catIdx]);

  useEffect(() => {
    if (episodeListRef.current) {
      const el = episodeListRef.current.children[detailIdx] as HTMLElement;
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [detailIdx]);

  useDpad((dir) => {
    if (playingUrl) {
      if (dir === "back") setPlayingUrl(null);
      return;
    }

    if (dir === "back") {
      if (zone === "detail") { setZone("grid"); setSelectedSeries(null); }
      else if (zone === "grid") { setZone("categories"); setGridIdx(0); }
      else navigate("/");
      return;
    }

    if (zone === "categories") {
      if (dir === "up") setCatIdx((i) => Math.max(0, i - 1));
      else if (dir === "down") setCatIdx((i) => Math.min(categories.length - 1, i + 1));
      else if (dir === "right") setZone("grid");
      else if (dir === "enter") {
        setSelectedCat(categories[catIdx]);
        setGridIdx(0);
        setZone("grid");
      }
    } else if (zone === "grid") {
      const maxGrid = seriesList.length;
      if (dir === "up") setGridIdx((i) => Math.max(0, i - GRID_COLS));
      else if (dir === "down") setGridIdx((i) => Math.min(maxGrid - 1, i + GRID_COLS));
      else if (dir === "left") {
        if (gridIdx % GRID_COLS === 0) setZone("categories");
        else setGridIdx((i) => Math.max(0, i - 1));
      }
      else if (dir === "right") setGridIdx((i) => Math.min(maxGrid - 1, i + 1));
      else if (dir === "enter") {
        setSelectedSeries(seriesList[gridIdx]);
        setDetailIdx(0);
        setZone("detail");
      }
    } else if (zone === "detail") {
      if (dir === "up") setDetailIdx((i) => Math.max(0, i - 1));
      else if (dir === "down") setDetailIdx((i) => Math.min(episodes.length - 1, i + 1));
      else if (dir === "enter") {
        const ep = episodes[detailIdx];
        if (ep && credentials && selectedSeries) {
          setPlayingTitle(`${selectedSeries.name} S${selectedSeason}E${ep.episode_num}`);
          setPlayingUrl(buildEpisodeStreamUrl(credentials, ep.id, ep.container_extension));
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
        <div style={{ fontSize: "48px" }}>🎭</div>
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
        onBack={() => setPlayingUrl(null)}
      />
    );
  }

  const gridRows: XSeriesStream[][] = [];
  for (let i = 0; i < seriesList.length; i += GRID_COLS) {
    gridRows.push(seriesList.slice(i, i + GRID_COLS));
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
        <div style={{ color: "#fff", fontSize: "28px", fontWeight: 600 }}>
          {zone === "detail" && selectedSeries ? selectedSeries.name : "Series"}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Categories */}
        {zone !== "detail" && (
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
        )}

        {/* Series grid or detail view */}
        {zone !== "detail" ? (
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "20px 32px", borderBottom: "1px solid var(--border-subtle)", color: "var(--text-secondary)", fontSize: "22px" }}>
              {selectedCat?.category_name || "All Series"}
              <span style={{ color: "var(--text-muted)", fontSize: "18px", marginLeft: "12px" }}>({seriesList.length})</span>
            </div>
            {seriesLoading ? (
              <div className="empty-state">
                <div className="animate-spin" style={{ width: "64px", height: "64px", border: "6px solid rgba(255,255,255,0.1)", borderTopColor: "var(--accent)", borderRadius: "50%" }} />
              </div>
            ) : seriesList.length === 0 ? (
              <div className="empty-state"><div>No series in this category</div></div>
            ) : (
              <div ref={gridRef} className="tv-scroll" style={{ flex: 1, padding: "24px 32px" }}>
                {gridRows.map((row, rowIdx) => (
                  <div key={rowIdx} style={{ display: "flex", gap: "24px", marginBottom: "24px" }}>
                    {row.map((series, colIdx) => {
                      const absIdx = rowIdx * GRID_COLS + colIdx;
                      const isFocused = zone === "grid" && gridIdx === absIdx;
                      return (
                        <div
                          key={series.series_id}
                          className={`content-card${isFocused ? " focused" : ""}`}
                          style={{ width: "270px", flexShrink: 0 }}
                          onClick={() => { setGridIdx(absIdx); setSelectedSeries(series); setDetailIdx(0); setZone("detail"); }}
                          onMouseEnter={() => { setGridIdx(absIdx); setZone("grid"); }}
                        >
                          <div style={{ width: "270px", height: "370px", position: "relative", background: "var(--bg-elevated)" }}>
                            {series.cover ? (
                              <img src={series.cover} alt={series.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { (e.target as HTMLImageElement).src = ""; }} />
                            ) : (
                              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "56px" }}>🎭</div>
                            )}
                            <div className="card-gradient" />
                          </div>
                          <div style={{ padding: "12px 14px" }}>
                            <div style={{ color: "#fff", fontSize: "19px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{series.name}</div>
                            {series.rating_5based > 0 && (
                              <div style={{ color: "#ffd700", fontSize: "16px", marginTop: "4px" }}>★ {series.rating_5based.toFixed(1)}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Detail view */
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            {/* Poster + info */}
            <div style={{ width: "480px", flexShrink: 0, padding: "32px", display: "flex", flexDirection: "column", gap: "20px", overflow: "hidden" }}>
              {selectedSeries?.cover && (
                <div style={{ width: "100%", height: "400px", borderRadius: "12px", overflow: "hidden", background: "var(--bg-elevated)" }}>
                  <img src={selectedSeries.cover} alt={selectedSeries.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { (e.target as HTMLImageElement).src = ""; }} />
                </div>
              )}
              <div style={{ color: "#fff", fontSize: "26px", fontWeight: 700 }}>{selectedSeries?.name}</div>
              {selectedSeries?.genre && <div style={{ color: "var(--text-secondary)", fontSize: "20px" }}>{selectedSeries.genre}</div>}
              {selectedSeries?.rating_5based && <div style={{ color: "#ffd700", fontSize: "22px" }}>★ {selectedSeries.rating_5based.toFixed(1)}</div>}
              {selectedSeries?.plot && (
                <div style={{ color: "var(--text-secondary)", fontSize: "18px", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical" }}>
                  {selectedSeries.plot}
                </div>
              )}
            </div>

            {/* Episodes */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", borderLeft: "1px solid var(--border-subtle)" }}>
              {/* Season selector */}
              {seasons.length > 1 && (
                <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", gap: "12px", overflowX: "auto" }}>
                  {seasons.map((s) => (
                    <button
                      key={s}
                      className={`category-pill${selectedSeason === s ? " active" : ""}`}
                      onClick={() => { setSelectedSeason(s); setDetailIdx(0); }}
                    >
                      Season {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Episode list */}
              <div ref={episodeListRef} className="tv-scroll" style={{ flex: 1, padding: "8px 0" }}>
                {episodes.map((ep, idx) => (
                  <div
                    key={ep.id}
                    className={`channel-item${zone === "detail" && detailIdx === idx ? " focused" : ""}`}
                    style={{ padding: "18px 24px" }}
                    onClick={() => {
                      setDetailIdx(idx);
                      if (credentials && selectedSeries) {
                        setPlayingTitle(`${selectedSeries.name} S${selectedSeason}E${ep.episode_num}`);
                        setPlayingUrl(buildEpisodeStreamUrl(credentials, ep.id, ep.container_extension));
                      }
                    }}
                    onMouseEnter={() => setDetailIdx(idx)}
                  >
                    <div style={{
                      width: "48px", height: "48px", borderRadius: "8px",
                      background: "var(--accent-dim)", border: "1px solid var(--accent)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "var(--accent)", fontSize: "20px", fontWeight: 700, flexShrink: 0,
                    }}>
                      {ep.episode_num}
                    </div>
                    <div style={{ flex: 1, overflow: "hidden" }}>
                      <div style={{ color: "#fff", fontSize: "22px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {ep.title || `Episode ${ep.episode_num}`}
                      </div>
                      {ep.info?.plot && (
                        <div style={{ color: "var(--text-muted)", fontSize: "16px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "4px" }}>
                          {ep.info.plot}
                        </div>
                      )}
                    </div>
                    <div style={{ color: "var(--accent)", fontSize: "22px" }}>▶</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{
        position: "absolute", bottom: "12px", left: 0, right: 0,
        textAlign: "center", color: "var(--text-muted)", fontSize: "18px",
      }}>
        ↑↓←→ Navigate · OK Select · Back = Previous screen
      </div>
    </div>
  );
}
