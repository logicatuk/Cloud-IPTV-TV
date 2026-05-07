import { useApp } from "../context/AppContext";

export default function ActivationPage() {
  const { mac, deviceStatus, statusMessage, retry } = useApp();

  return (
    <div style={{
      width: "1920px",
      height: "1080px",
      background: "var(--bg-primary)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "48px",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Background gradient */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "radial-gradient(ellipse at center, rgba(229,9,20,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Logo */}
      <div className="app-logo" style={{ fontSize: "56px", marginBottom: "8px" }}>
        Max<span>Player</span>
      </div>

      {deviceStatus === "loading" || deviceStatus === "registering" ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "24px" }}>
          <div className="animate-spin" style={{
            width: "64px", height: "64px",
            border: "6px solid rgba(255,255,255,0.1)",
            borderTopColor: "var(--accent)",
            borderRadius: "50%",
          }} />
          <div style={{ color: "var(--text-secondary)", fontSize: "28px" }}>
            {deviceStatus === "loading" ? "Checking device status..." : "Registering device..."}
          </div>
        </div>
      ) : deviceStatus === "pending" ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "40px", animation: "fade-in 0.4s ease forwards" }}>
          <div style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "20px",
            padding: "48px 64px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "32px",
            maxWidth: "900px",
          }}>
            <div style={{ color: "var(--text-secondary)", fontSize: "28px" }}>
              Your Device ID
            </div>
            <div className="mac-display">{mac}</div>
            <div style={{
              color: "var(--text-primary)",
              fontSize: "26px",
              textAlign: "center",
              lineHeight: 1.6,
            }}>
              Provide this ID to your IPTV reseller to activate your device.
            </div>

            {/* Waiting animation */}
            <div style={{ display: "flex", alignItems: "center", gap: "16px", marginTop: "8px" }}>
              <div style={{ color: "var(--text-secondary)", fontSize: "22px" }}>
                Waiting for activation
              </div>
              <div>
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
            </div>
          </div>

          <div style={{ color: "var(--text-muted)", fontSize: "22px", textAlign: "center" }}>
            This screen will update automatically when your device is activated
          </div>
        </div>
      ) : deviceStatus === "suspended" ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "24px" }}>
          <div style={{ fontSize: "64px" }}>🔒</div>
          <div style={{ color: "#fff", fontSize: "36px", fontWeight: 700 }}>Device Suspended</div>
          <div style={{ color: "var(--text-secondary)", fontSize: "24px", textAlign: "center", maxWidth: "600px" }}>
            {statusMessage || "Your device has been suspended. Please contact your IPTV provider."}
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: "20px" }}>Your Device ID: {mac}</div>
        </div>
      ) : deviceStatus === "expired" ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "24px" }}>
          <div style={{ fontSize: "64px" }}>⏰</div>
          <div style={{ color: "#fff", fontSize: "36px", fontWeight: 700 }}>Subscription Expired</div>
          <div style={{ color: "var(--text-secondary)", fontSize: "24px", textAlign: "center", maxWidth: "600px" }}>
            {statusMessage || "Your subscription has expired. Please renew with your IPTV provider."}
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: "20px" }}>Your Device ID: {mac}</div>
        </div>
      ) : deviceStatus === "error" ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "32px" }}>
          <div style={{ fontSize: "64px" }}>⚠</div>
          <div style={{ color: "#fff", fontSize: "32px", fontWeight: 700 }}>Connection Error</div>
          <div style={{ color: "var(--text-secondary)", fontSize: "24px", textAlign: "center", maxWidth: "700px" }}>
            {statusMessage || "Could not reach the activation server. Check your network connection."}
          </div>
          <button
            className="tv-btn tv-btn-primary focused"
            onClick={retry}
            style={{ marginTop: "16px" }}
          >
            Try Again
          </button>
        </div>
      ) : null}

      {/* Footer */}
      <div style={{
        position: "absolute",
        bottom: "40px",
        color: "var(--text-muted)",
        fontSize: "20px",
        textAlign: "center",
      }}>
        MaxPlayer TV · Phase 4 · Samsung Tizen
      </div>
    </div>
  );
}
