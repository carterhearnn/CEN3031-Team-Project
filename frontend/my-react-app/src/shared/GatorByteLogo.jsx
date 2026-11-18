const wordmarkStyle = {
  display: "inline-flex",
  alignItems: "center",
  color: "#192b21",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: 16,
  fontWeight: 800,
  letterSpacing: "1.7px",
  lineHeight: 1.6,
  whiteSpace: "nowrap",
};

export default function GatorByteLogo() {
  return <a href="/" className="gatorbyte-wordmark" aria-label="GatorByte home" style={wordmarkStyle}>
    GATOR<span style={{ color: "#1f7a4d" }}>BYTE</span>
  </a>;
}
