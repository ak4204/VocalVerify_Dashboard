import { FileAudio, Sparkles, Video } from "lucide-react";

const STATS = [
  { label: "Voice Clone Threshold", value: "3 sec", sub: "of audio required" },
  { label: "Financial Fraud Vector", value: "68%", sub: "involve voice deception" },
  { label: "Detection Latency", value: "<50ms", sub: "real-time streaming" },
  { label: "Ensemble Accuracy", value: "96.2%", sub: "on benchmark datasets" },
];

const CAPABILITIES = [
  {
    num: "01",
    title: "Multi-Layer Voice Authenticity",
    desc: "Acoustic & spectral deep learning detects synthesis artifacts, phase inconsistencies, and prosody anomalies that distinguish AI-generated speech from natural human voice.",
  },
  {
    num: "02",
    title: "Real-Time Risk Scoring Engine",
    desc: "Continuous per-frame confidence scoring with configurable threshold alerts — designed for high-value transaction calls, privileged access approvals, and live telephony.",
  },
  {
    num: "03",
    title: "Alerting & Workflow Automation",
    desc: "Multi-channel alerts with pre-transaction warnings, MFA escalation triggers, and configurable automated responses when impersonation risk crosses operator-defined thresholds.",
  },
  {
    num: "04",
    title: "Privacy-Preserving by Design",
    desc: "On-device and edge inference options minimise central audio retention. Feature-only logging aligns with DPDPA and enterprise data governance requirements.",
  },
  {
    num: "05",
    title: "Multilingual Indian Coverage",
    desc: "Language-agnostic feature extraction paired with acoustic models tuned for diverse Indian accents, regional dialects, and multilingual code-switching.",
  },
  {
    num: "06",
    title: "Platform & Telecom Integration",
    desc: "REST and WebSocket APIs with SDKs for core banking, contact centres, VoIP stacks, and enterprise collaboration tools. Sub-50ms latency on streaming endpoints.",
  },
];

export function HomeView(props: any) {
  return (
    <>
      {/* ── Hero (untouched) ────────────────────────────────── */}
      <section className="hero-card">
        <div className="hero-grid" />
        <div className="hero-content">
          <p className="overline">VOICE INTELLIGENCE WORKSPACE</p>
          <h1>Verify every voice<br />with confidence.</h1>
          <p>Screen suspicious media, compare speakers, and make a safer decision in one focused workspace.</p>
          <div className="hero-pills">
            <span><FileAudio size={15} /> Audio analysis</span>
            <span><Video size={15} /> Public figure check</span>
            <span><Sparkles size={15} /> Client-side demo</span>
          </div>
        </div>
      </section>

      {/* ── PS header ───────────────────────────────────────── */}
      <div style={{ margin: "28px 0 18px", display: "flex", alignItems: "baseline", gap: "14px" }}>
        <p className="overline" style={{ color: "var(--red)" }}>SIH 2026 · PS-26104</p>
        <div style={{ height: "1px", flex: 1, background: "var(--line)" }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "22px", alignItems: "start" }}>

        {/* ── Left column ─────────────────────────────────── */}
        <div>

          {/* Title block */}
          <h2 style={{ fontSize: "20px", letterSpacing: "-0.8px", margin: "0 0 6px" }}>
            AI-Powered Real-Time Detection of Voice Cloning Impersonation
          </h2>
          <p style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.7, margin: "0 0 20px", maxWidth: "560px" }}>
            Generative AI has reduced the barrier for high-fidelity voice cloning to&nbsp;
            <span style={{ color: "#ddd" }}>as little as 3 seconds</span> of recorded audio.
            Threat actors exploit this to impersonate CXOs, government officials, and financial institutions —
            bypassing conventional caller-ID and voice-familiarity verification that is&nbsp;
            <span style={{ color: "#ddd" }}>no longer sufficient</span> in high-pressure telephony environments.
          </p>

          {/* Stat row */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "1px",
            background: "var(--line)",
            border: "1px solid var(--line)",
            borderRadius: "10px",
            overflow: "hidden",
            marginBottom: "20px",
          }}>
            {STATS.map((s) => (
              <div key={s.label} style={{ background: "#111114", padding: "14px 16px" }}>
                <p style={{ margin: "0 0 4px", fontSize: "9px", letterSpacing: "1px", color: "#666", fontWeight: 700 }}>
                  {s.label.toUpperCase()}
                </p>
                <p style={{ margin: "0 0 2px", fontSize: "22px", fontWeight: 800, letterSpacing: "-1px", color: "#fff" }}>
                  {s.value}
                </p>
                <p style={{ margin: 0, fontSize: "10px", color: "#555" }}>{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Capabilities — numbered list style */}
          <p style={{ margin: "0 0 12px", fontSize: "9px", letterSpacing: "1.5px", color: "#555", fontWeight: 700 }}>
            KEY COMPONENTS
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px", background: "var(--line)", border: "1px solid var(--line)", borderRadius: "10px", overflow: "hidden" }}>
            {CAPABILITIES.map((c) => (
              <div key={c.num} style={{ background: "#111114", padding: "16px 18px" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "7px" }}>
                  <span style={{ fontSize: "10px", fontFamily: "ui-monospace, monospace", color: "var(--blue-hi)", fontWeight: 700 }}>{c.num}</span>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#e8e8ec", letterSpacing: "-0.2px" }}>{c.title}</span>
                </div>
                <p style={{ margin: 0, fontSize: "11px", color: "#666", lineHeight: 1.65 }}>{c.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right column ────────────────────────────────── */}
        <div style={{ display: "grid", gap: "12px" }}>

          {/* Context box */}
          <div className="dark-card" style={{ padding: "18px" }}>
            <p style={{ margin: "0 0 10px", fontSize: "9px", letterSpacing: "1.5px", color: "#555", fontWeight: 700 }}>
              THREAT CONTEXT
            </p>
            <p style={{ margin: "0 0 10px", fontSize: "12px", color: "#aaa", lineHeight: 1.7 }}>
              Voice cloning attacks are increasingly orchestrated over VoIP, mobile networks, and enterprise collaboration platforms —
              often combined with leaked personal information to construct highly convincing narratives.
            </p>
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: "10px", marginTop: "4px" }}>
              <p style={{ margin: "0 0 6px", fontSize: "9px", letterSpacing: "1px", color: "#555", fontWeight: 700 }}>ATTACK VECTORS</p>
              {["CFO / CEO vishing fraud", "Bank OTP robocall scams", "Govt. official impersonation", "Social engineering over VoIP"].map((v) => (
                <div key={v} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: "var(--red)", flexShrink: 0 }} />
                  <span style={{ fontSize: "11px", color: "#888" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Outcomes box */}
          <div className="dark-card" style={{ padding: "18px" }}>
            <p style={{ margin: "0 0 10px", fontSize: "9px", letterSpacing: "1.5px", color: "#555", fontWeight: 700 }}>
              EXPECTED OUTCOMES
            </p>
            {[
              "Reduction in voice-enabled financial fraud.",
              "Improved trust in telephony verification.",
              "Proactive AI social-engineering containment.",
              "Reusable layer aligned with national cyber objectives.",
            ].map((o, i) => (
              <div key={i} style={{ display: "flex", gap: "10px", marginBottom: "9px" }}>
                <span style={{ fontSize: "9px", fontFamily: "ui-monospace, monospace", color: "var(--green)", flexShrink: 0, marginTop: "2px" }}>✓</span>
                <span style={{ fontSize: "11px", color: "#888", lineHeight: 1.55 }}>{o}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => props.setActiveView?.("call_verify")}
              style={{ flex: 1, height: "38px", background: "var(--blue)", border: "none", borderRadius: "8px", color: "#fff", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
            >
              Call Verify →
            </button>
            <button
              onClick={() => props.setActiveView?.("threat_analytics")}
              style={{ flex: 1, height: "38px", background: "transparent", border: "1px solid var(--line)", borderRadius: "8px", color: "#aaa", fontSize: "12px", cursor: "pointer" }}
            >
              Threat Analytics
            </button>
          </div>

        </div>
      </div>
    </>
  );
}

