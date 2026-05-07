import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { useDpad } from "../hooks/useDpad";

interface VideoPlayerProps {
  url: string;
  title?: string;
  poster?: string;
  onBack: () => void;
  autoPlay?: boolean;
}

export function VideoPlayer({ url, title, poster, onBack, autoPlay = true }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [buffering, setBuffering] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showControlsTemporarily = () => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => setShowControls(false), 4000);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    setError(null);
    setBuffering(true);

    const cleanup = () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };

    cleanup();

    const isHls = url.includes(".m3u8") || url.includes("live/");

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
      });
      hlsRef.current = hls;

      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (autoPlay) {
          video.play().catch(() => {});
        }
      });

      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data.fatal) {
          setError("Stream error. Please try again.");
          setBuffering(false);
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl") && isHls) {
      // Native HLS (Safari / Tizen with native support)
      video.src = url;
      if (autoPlay) video.play().catch(() => {});
    } else {
      video.src = url;
      if (autoPlay) video.play().catch(() => {});
    }

    const onPlay = () => { setIsPlaying(true); showControlsTemporarily(); };
    const onPause = () => { setIsPlaying(false); setShowControls(true); };
    const onWaiting = () => setBuffering(true);
    const onCanPlay = () => setBuffering(false);
    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onDurationChange = () => setDuration(video.duration);
    const onError = () => setError("Failed to load stream.");

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("durationchange", onDurationChange);
    video.addEventListener("error", onError);

    return () => {
      cleanup();
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("durationchange", onDurationChange);
      video.removeEventListener("error", onError);
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, [url, autoPlay]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
    showControlsTemporarily();
  };

  const seek = (delta: number) => {
    const video = videoRef.current;
    if (!video || !isFinite(video.duration)) return;
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + delta));
    showControlsTemporarily();
  };

  useDpad((dir) => {
    if (dir === "back") {
      onBack();
      return;
    }
    if (dir === "enter" || dir === "play" || dir === "pause") {
      togglePlay();
      return;
    }
    if (dir === "right") { seek(10); return; }
    if (dir === "left") { seek(-10); return; }
    showControlsTemporarily();
  });

  const formatTime = (s: number) => {
    if (!isFinite(s)) return "--:--";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      style={{
        width: "1920px",
        height: "1080px",
        background: "#000",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <video
        ref={videoRef}
        poster={poster}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
        playsInline
      />

      {/* Buffering spinner */}
      {buffering && !error && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.5)",
        }}>
          <div style={{
            width: "80px", height: "80px", borderRadius: "50%",
            border: "6px solid rgba(255,255,255,0.15)",
            borderTopColor: "var(--accent)",
            animation: "spin 0.9s linear infinite",
          }} />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.8)", gap: "24px",
        }}>
          <div style={{ fontSize: "48px" }}>⚠</div>
          <div style={{ color: "#fff", fontSize: "28px" }}>{error}</div>
          <div style={{ color: "var(--text-secondary)", fontSize: "22px" }}>Press Back to return</div>
        </div>
      )}

      {/* Controls overlay */}
      <div
        className={`player-overlay ${showControls ? "visible" : ""}`}
        style={{ pointerEvents: "none" }}
      />

      {showControls && (
        <>
          {/* Top: title + back hint */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0,
            padding: "40px 64px",
            display: "flex", alignItems: "center", gap: "24px",
          }}>
            <span style={{
              color: "var(--text-secondary)", fontSize: "22px",
              background: "rgba(0,0,0,0.5)", padding: "8px 16px", borderRadius: "8px",
            }}>
              ← Back
            </span>
            {title && (
              <span style={{ color: "#fff", fontSize: "32px", fontWeight: 700 }}>
                {title}
              </span>
            )}
          </div>

          {/* Bottom: progress + time */}
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            padding: "32px 64px 48px",
          }}>
            {duration > 0 && (
              <>
                <div className="progress-bar" style={{ marginBottom: "16px" }}>
                  <div className="progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  color: "var(--text-secondary)", fontSize: "20px",
                }}>
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </>
            )}

            {/* Play/pause indicator */}
            <div style={{
              textAlign: "center", marginTop: "16px",
              color: "rgba(255,255,255,0.7)", fontSize: "20px",
            }}>
              {isPlaying
                ? "OK = Pause  |  ← → = ±10s  |  Back = Exit"
                : "OK = Play  |  Back = Exit"
              }
            </div>
          </div>
        </>
      )}
    </div>
  );
}
