export default function NotFound() {
  return (
    <div style={{
      width: "1920px", height: "1080px",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "var(--bg-primary)",
      color: "var(--text-primary)",
      gap: "24px",
    }}>
      <div style={{ fontSize: "96px", color: "var(--accent)" }}>404</div>
      <div style={{ fontSize: "36px" }}>Page not found</div>
      <div style={{ fontSize: "24px", color: "var(--text-secondary)" }}>Press Back to return</div>
    </div>
  );
}
