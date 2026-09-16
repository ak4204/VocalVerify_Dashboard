"use client";

/**
 * LiveAudioMonitor.tsx
 * ────────────────────
 * Connects to the FastAPI backend /ws/telephony WebSocket as a passive
 * "dashboard listener" and replays the raw PCM-16 chunks it receives
 * through the browser's Web Audio API in real-time.
 *
 * Includes:
 *  - Autoplay unblock & AudioContext resume handling
 *  - Real-time Audio Meter (Peak & RMS) to detect real voice vs silence
 *  - Live waveform visualizer canvas
 *  - "Test Speaker" chime button to verify browser audio works
 *  - 16 kHz (HD) / 8 kHz (Telephony) sample rate selector
 *  - Volume slider and Mute toggle
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { 
  Headphones, Volume2, VolumeX, Radio, Wifi, WifiOff, 
  Activity, BellRing, Sparkles, AlertCircle 
} from "lucide-react";
import { getBackendBaseUrl } from "../../hooks/useVocalVerify";

// ── PCM helpers ──────────────────────────────────────────────────────────────

interface DecodeResult {
  buffer: AudioBuffer;
  peak: number;
  rms: number;
}

/** Convert raw PCM-16 LE bytes to a Web Audio AudioBuffer with peak calculation */
function pcmBytesToAudioBuffer(
  ctx: AudioContext,
  bytes: Uint8Array,
  sampleRate: number = 16000
): DecodeResult | null {
  const samples = Math.floor(bytes.byteLength / 2);
  if (samples < 1) return null;

  const buf = ctx.createBuffer(1, samples, sampleRate);
  const channel = buf.getChannelData(0);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  let sumSquares = 0;
  let peak = 0;

  for (let i = 0; i < samples; i++) {
    const val = view.getInt16(i * 2, true) / 32768.0;
    channel[i] = val;
    const abs = Math.abs(val);
    if (abs > peak) peak = abs;
    sumSquares += val * val;
  }

  const rms = Math.sqrt(sumSquares / samples);
  return { buffer: buf, peak, rms };
}

/** Decode a base64 string to Uint8Array */
function b64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ── component ────────────────────────────────────────────────────────────────

export function LiveAudioMonitor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const wsRef = useRef<WebSocket | null>(null);
  const animRef = useRef<number>(0);
  const mountedRef = useRef(true);

  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(180);
  const [wsState, setWsState] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [chunksReceived, setChunksReceived] = useState(0);
  const [lastChunkMs, setLastChunkMs] = useState<number | null>(null);
  const [peakLevel, setPeakLevel] = useState(0); // 0 to 100
  const [audioCtxSuspended, setAudioCtxSuspended] = useState(false);
  const [sampleRate, setSampleRate] = useState<16000 | 8000>(16000);
  const [testPlaying, setTestPlaying] = useState(false);

  // ── Web Audio init ──────────────────────────────────────────────────────
  const initAudio = useCallback((): AudioContext | null => {
    if (audioCtxRef.current) {
      if (audioCtxRef.current.state === "suspended") {
        setAudioCtxSuspended(true);
      }
      return audioCtxRef.current;
    }

    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) return null;

      // Use default hardware sampleRate so browser driver never fails
      const ctx = new AudioCtxClass();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.7;

      // Dynamic compressor to cleanly boost quiet speakerphone speech without distortion
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-30, ctx.currentTime);
      compressor.knee.setValueAtTime(20, ctx.currentTime);
      compressor.ratio.setValueAtTime(8, ctx.currentTime);
      compressor.attack.setValueAtTime(0.005, ctx.currentTime);
      compressor.release.setValueAtTime(0.2, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.value = volume / 100;
      gain.connect(compressor);
      compressor.connect(analyser);
      analyser.connect(ctx.destination);

      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      gainRef.current = gain;
      nextPlayTimeRef.current = ctx.currentTime;

      if (ctx.state === "suspended") {
        setAudioCtxSuspended(true);
      }

      ctx.onstatechange = () => {
        if (!mountedRef.current) return;
        setAudioCtxSuspended(ctx.state === "suspended");
      };

      return ctx;
    } catch (err) {
      console.error("[LiveAudioMonitor] Failed to create AudioContext:", err);
      return null;
    }
  }, [volume]);

  // ── Ensure AudioContext is running ─────────────────────────────────────
  const ensureAudioRunning = useCallback(async () => {
    const ctx = initAudio();
    if (ctx && ctx.state === "suspended") {
      try {
        await ctx.resume();
        setAudioCtxSuspended(false);
      } catch (err) {
        console.warn("[LiveAudioMonitor] Resume failed:", err);
      }
    }
    return ctx;
  }, [initAudio]);

  // ── Test speaker chime ─────────────────────────────────────────────────
  const playTestChime = useCallback(async () => {
    const ctx = await ensureAudioRunning();
    if (!ctx) return;
    setTestPlaying(true);

    try {
      const g = gainRef.current;
      if (!g) return;

      const now = ctx.currentTime;
      // Tone 1: 523Hz (C5)
      const osc1 = ctx.createOscillator();
      const toneGain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(523.25, now);
      toneGain1.gain.setValueAtTime(0.3, now);
      toneGain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc1.connect(toneGain1);
      toneGain1.connect(g);
      osc1.start(now);
      osc1.stop(now + 0.18);

      // Tone 2: 659Hz (E5)
      const osc2 = ctx.createOscillator();
      const toneGain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(659.25, now + 0.12);
      toneGain2.gain.setValueAtTime(0.3, now + 0.12);
      toneGain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc2.connect(toneGain2);
      toneGain2.connect(g);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.35);

      setPeakLevel(85);
      setTimeout(() => {
        if (mountedRef.current) setTestPlaying(false);
      }, 400);
    } catch (e) {
      console.warn("Test chime error:", e);
      setTestPlaying(false);
    }
  }, [ensureAudioRunning]);

  // ── Waveform animation ──────────────────────────────────────────────────
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) {
      animRef.current = requestAnimationFrame(drawWaveform);
      return;
    }
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) {
      animRef.current = requestAnimationFrame(drawWaveform);
      return;
    }

    const bufLen = analyser.frequencyBinCount;
    const data = new Uint8Array(bufLen);
    analyser.getByteTimeDomainData(data);

    const W = canvas.width;
    const H = canvas.height;
    ctx2d.clearRect(0, 0, W, H);

    ctx2d.fillStyle = "#0a0a0f";
    ctx2d.fillRect(0, 0, W, H);

    // Subtle grid lines
    ctx2d.strokeStyle = "rgba(255,255,255,0.04)";
    ctx2d.lineWidth = 1;
    for (let y = H * 0.25; y < H; y += H * 0.25) {
      ctx2d.beginPath();
      ctx2d.moveTo(0, y);
      ctx2d.lineTo(W, y);
      ctx2d.stroke();
    }

    const isActive = wsState === "connected" && !isMuted;
    const hasSignal = peakLevel > 5;
    ctx2d.shadowColor = hasSignal ? "#4ec691" : (isActive ? "rgba(78,198,145,0.4)" : "transparent");
    ctx2d.shadowBlur = hasSignal ? 8 : 2;
    ctx2d.strokeStyle = hasSignal 
      ? "#4ec691" 
      : (isActive ? "rgba(78, 198, 145, 0.7)" : "rgba(100, 120, 160, 0.4)");
    ctx2d.lineWidth = hasSignal ? 2.5 : 1.5;
    ctx2d.beginPath();

    const sliceW = W / bufLen;
    let x = 0;
    for (let i = 0; i < bufLen; i++) {
      const v = data[i] / 128;
      const y = (v * H) / 2;
      if (i === 0) ctx2d.moveTo(x, y);
      else ctx2d.lineTo(x, y);
      x += sliceW;
    }
    ctx2d.lineTo(W, H / 2);
    ctx2d.stroke();
    ctx2d.shadowBlur = 0;

    animRef.current = requestAnimationFrame(drawWaveform);
  }, [wsState, isMuted, peakLevel]);

  // ── Play a PCM buffer ───────────────────────────────────────────────────
  const scheduleChunk = useCallback((audioBuf: AudioBuffer) => {
    const ctx = audioCtxRef.current;
    const gain = gainRef.current;
    if (!ctx || !gain) return;

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const src = ctx.createBufferSource();
    src.buffer = audioBuf;
    src.connect(gain);

    const now = ctx.currentTime;
    // Jitter buffer: ensure chunk plays immediately with at most 20ms buffer
    if (nextPlayTimeRef.current < now || nextPlayTimeRef.current > now + 0.35) {
      nextPlayTimeRef.current = now + 0.015;
    }
    src.start(nextPlayTimeRef.current);
    nextPlayTimeRef.current += audioBuf.duration;
  }, []);

  // ── Connect WebSocket ───────────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (wsRef.current) {
      try { wsRef.current.close(); } catch (_) {}
    }

    // Unmute & resume Web Audio inside this user click event
    await ensureAudioRunning();

    const base = getBackendBaseUrl();
    const wsUrl = base
      .replace(/^https:\/\//, "wss://")
      .replace(/^http:\/\//, "ws://");

    setWsState("connecting");
    const ws = new WebSocket(`${wsUrl}/ws/telephony/dashboard_audio_monitor`);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setWsState("connected");
      setIsListening(true);
      try { ws.send("ping"); } catch (_) {}
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;

      const ctx = audioCtxRef.current;
      if (!ctx) return;

      // 1. Binary frame = raw PCM-16 bytes
      if (event.data instanceof ArrayBuffer) {
        const bytes = new Uint8Array(event.data);
        if (bytes.length < 2) return;
        const res = pcmBytesToAudioBuffer(ctx, bytes, sampleRate);
        if (!res) return;

        setChunksReceived((n) => n + 1);
        setLastChunkMs(Date.now());
        setPeakLevel(Math.round(res.peak * 100));

        if (!isMuted) {
          scheduleChunk(res.buffer);
        }
        return;
      }

      // 2. Text frame — try to extract base64 audio
      if (typeof event.data === "string") {
        try {
          const data = JSON.parse(event.data);
          const b64 =
            data?.audio_bytes_base64 ||
            data?.audioBytesBase64 ||
            data?.audio_payload?.audio_bytes_base64 ||
            data?.audioPayload?.audioBytesBase64;
          if (b64 && typeof b64 === "string") {
            const bytes = b64ToBytes(b64);
            const res = pcmBytesToAudioBuffer(ctx, bytes, sampleRate);
            if (res) {
              setChunksReceived((n) => n + 1);
              setLastChunkMs(Date.now());
              setPeakLevel(Math.round(res.peak * 100));
              if (!isMuted) {
                scheduleChunk(res.buffer);
              }
            }
          }
        } catch (_) {}
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setWsState("idle");
      setIsListening(false);
    };

    ws.onerror = () => {
      if (!mountedRef.current) return;
      setWsState("error");
    };
  }, [ensureAudioRunning, isMuted, sampleRate, scheduleChunk]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      try { wsRef.current.close(); } catch (_) {}
      wsRef.current = null;
    }
    setIsListening(false);
    setWsState("idle");
    setChunksReceived(0);
    setLastChunkMs(null);
    setPeakLevel(0);
  }, []);

  // ── Volume / mute sync ──────────────────────────────────────────────────
  useEffect(() => {
    if (gainRef.current) {
      gainRef.current.gain.value = isMuted ? 0 : volume / 100;
    }
  }, [volume, isMuted]);

  // ── Decay peak level meter ──────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      setPeakLevel((p) => (p > 3 ? Math.floor(p * 0.82) : 0));
    }, 120);
    return () => clearInterval(timer);
  }, []);

  // ── Canvas animation ────────────────────────────────────────────────────
  useEffect(() => {
    animRef.current = requestAnimationFrame(drawWaveform);
    return () => { cancelAnimationFrame(animRef.current); };
  }, [drawWaveform]);

  // ── Cleanup ─────────────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      disconnect();
      cancelAnimationFrame(animRef.current);
      audioCtxRef.current?.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived status ──────────────────────────────────────────────────────
  const isStale = lastChunkMs !== null && Date.now() - lastChunkMs > 3500;
  const statusColor =
    wsState === "connected" ? (isStale ? "#f5a623" : "#4ec691")
    : wsState === "connecting" ? "#7dbdff"
    : wsState === "error"     ? "#ff626d"
    : "#555";

  const statusLabel =
    wsState === "connected" ? (isStale ? "Connected · Silence" : `Connected · ${chunksReceived} frames`)
    : wsState === "connecting" ? "Connecting…"
    : wsState === "error"     ? "Connection Error"
    : "Not Listening";

  return (
    <div
      id="live-audio-monitor"
      style={{
        marginTop: "24px",
        border: `1px solid ${wsState === "connected" ? "rgba(78,198,145,0.3)" : "#1e1e28"}`,
        borderRadius: "14px",
        background: "#0d0d12",
        overflow: "hidden",
        boxShadow: wsState === "connected" ? "0 4px 20px rgba(78,198,145,0.06)" : "none",
        transition: "all 0.3s ease",
      }}
    >
      {/* ── Audio Context Suspended Alert ── */}
      {audioCtxSuspended && (
        <div
          onClick={ensureAudioRunning}
          style={{
            background: "rgba(245, 166, 35, 0.15)",
            borderBottom: "1px solid rgba(245, 166, 35, 0.3)",
            padding: "8px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            fontSize: "12px",
            color: "#f5a623",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertCircle size={15} />
            <span>Browser audio is currently suspended by autoplay policy.</span>
          </div>
          <span style={{ textDecoration: "underline", fontWeight: 700 }}>
            Click here to unlock speaker audio
          </span>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 18px", borderBottom: "1px solid #181822",
        flexWrap: "wrap", gap: "10px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "34px", height: "34px", borderRadius: "10px",
            background: "rgba(78,198,145,0.12)", display: "grid",
            placeItems: "center", color: "#4ec691",
          }}>
            <Headphones size={18} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>
                Live Phone Audio Monitor
              </span>
              <span style={{
                fontSize: "10px", padding: "1px 7px", borderRadius: "10px",
                background: "rgba(78,198,145,0.1)", color: "#4ec691",
                fontWeight: 600, border: "1px solid rgba(78,198,145,0.25)"
              }}>
                Web Audio
              </span>
            </div>
            <div style={{ fontSize: "11px", color: "#666", marginTop: "2px" }}>
              Hear raw caller audio streamed from the phone in real-time
            </div>
          </div>
        </div>

        {/* Status pill + actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Test Chime button */}
          <button
            id="test-speaker-btn"
            onClick={playTestChime}
            disabled={testPlaying}
            style={{
              display: "flex", alignItems: "center", gap: "5px",
              background: "#161620", border: "1px solid #2a2a38",
              borderRadius: "8px", padding: "5px 10px",
              color: testPlaying ? "#4ec691" : "#aaa",
              fontSize: "11px", fontWeight: 600, cursor: "pointer",
              transition: "all 0.2s"
            }}
            title="Play a test tone to confirm your browser speakers are working"
          >
            <BellRing size={13} />
            {testPlaying ? "Playing Chime…" : "Test Speaker"}
          </button>

          {/* Sample rate toggle */}
          <div style={{
            display: "flex", background: "#14141c", borderRadius: "8px",
            padding: "2px", border: "1px solid #222230"
          }}>
            <button
              onClick={() => setSampleRate(16000)}
              style={{
                background: sampleRate === 16000 ? "rgba(78,198,145,0.2)" : "transparent",
                color: sampleRate === 16000 ? "#4ec691" : "#777",
                border: "none", borderRadius: "6px", padding: "3px 8px",
                fontSize: "10px", fontWeight: 700, cursor: "pointer"
              }}
            >
              16 kHz
            </button>
            <button
              onClick={() => setSampleRate(8000)}
              style={{
                background: sampleRate === 8000 ? "rgba(78,198,145,0.2)" : "transparent",
                color: sampleRate === 8000 ? "#4ec691" : "#777",
                border: "none", borderRadius: "6px", padding: "3px 8px",
                fontSize: "10px", fontWeight: 700, cursor: "pointer"
              }}
            >
              8 kHz
            </button>
          </div>

          {/* Status pill */}
          <div style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: "#13131a", border: `1px solid ${statusColor}44`,
            borderRadius: "20px", padding: "5px 12px",
            fontSize: "11px", color: statusColor, fontWeight: 600,
          }}>
            <div style={{
              width: "7px", height: "7px", borderRadius: "50%",
              background: statusColor,
              boxShadow: wsState === "connected" && !isStale ? `0 0 8px ${statusColor}` : "none",
            }} />
            {statusLabel}
          </div>

          {wsState === "connected" ? (
            <button
              onClick={disconnect}
              style={{
                background: "transparent", border: "none", color: "#888",
                cursor: "pointer", display: "grid", placeItems: "center"
              }}
              title="Disconnect"
            >
              <WifiOff size={15} />
            </button>
          ) : (
            <button
              onClick={connect}
              style={{
                background: "transparent", border: "none", color: "#7dbdff",
                cursor: "pointer", display: "grid", placeItems: "center"
              }}
              title="Connect"
            >
              <Wifi size={15} />
            </button>
          )}
        </div>
      </div>

      {/* ── Waveform Canvas + Live VU Level Meter ── */}
      <div style={{ position: "relative" }}>
        <canvas
          ref={canvasRef}
          width={900}
          height={85}
          style={{ width: "100%", height: "85px", display: "block" }}
        />

        {/* Live level bar at bottom of canvas */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          height: "3px", background: "rgba(255,255,255,0.06)",
        }}>
          <div style={{
            height: "100%", width: `${peakLevel}%`,
            background: peakLevel > 60 ? "#ff626d" : (peakLevel > 15 ? "#4ec691" : "#7dbdff"),
            boxShadow: `0 0 8px ${peakLevel > 60 ? "#ff626d" : "#4ec691"}`,
            transition: "width 0.08s ease-out",
          }} />
        </div>

        {wsState !== "connected" && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "12px", color: "#666", letterSpacing: "0.04em", gap: "8px",
            background: "rgba(10,10,15,0.65)", backdropFilter: "blur(2px)"
          }}>
            <Activity size={14} style={{ color: "#7dbdff" }} />
            <span>Click <strong style={{ color: "#4ec691" }}>Start Listening</strong> to stream live caller audio</span>
          </div>
        )}
      </div>

      {/* ── Controls Bar ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 18px", borderTop: "1px solid #181822",
        gap: "14px", flexWrap: "wrap",
      }}>
        {/* Start / Stop Listening Button */}
        <button
          id="live-monitor-toggle-btn"
          onClick={isListening ? disconnect : connect}
          style={{
            padding: "9px 22px", borderRadius: "9px", border: "none",
            background: isListening 
              ? "linear-gradient(135deg, rgba(255,98,109,0.2), rgba(255,98,109,0.1))" 
              : "linear-gradient(135deg, rgba(78,198,145,0.25), rgba(78,198,145,0.12))",
            border: isListening ? "1px solid rgba(255,98,109,0.4)" : "1px solid rgba(78,198,145,0.4)",
            color: isListening ? "#ff626d" : "#4ec691",
            fontWeight: 700, fontSize: "12px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: "8px",
            transition: "all 0.2s",
            boxShadow: isListening ? "0 0 12px rgba(255,98,109,0.15)" : "none"
          }}
        >
          <Radio size={14} />
          {isListening ? "Stop Listening" : "Start Listening"}
        </button>

        {/* Volume & Mute */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, maxWidth: "340px" }}>
          <button
            id="live-monitor-mute-btn"
            onClick={async () => {
              await ensureAudioRunning();
              setIsMuted((m) => !m);
            }}
            style={{
              background: "transparent", border: "none",
              color: isMuted ? "#ff626d" : "#4ec691",
              cursor: "pointer", padding: "4px", display: "flex",
            }}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <input
            id="live-monitor-volume-slider"
            type="range" min={0} max={300} step={5} value={volume}
            onChange={async (e) => {
              await ensureAudioRunning();
              setVolume(Number(e.target.value));
              setIsMuted(false);
            }}
            style={{ flex: 1, accentColor: volume > 100 ? "#ff9f43" : "#4ec691", cursor: "pointer" }}
          />
          <span style={{ 
            fontSize: "11px", 
            color: volume > 100 ? "#ff9f43" : "#888", 
            minWidth: "55px", 
            textAlign: "right", 
            fontWeight: 700 
          }}>
            {isMuted ? "MUTED" : volume > 100 ? `${volume}% ⚡` : `${volume}%`}
          </span>
        </div>

        {/* Activity & Peak level indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "11px", color: "#666" }}>
          {peakLevel > 4 ? (
            <span style={{
              color: "#4ec691", fontWeight: 700, display: "flex", alignItems: "center", gap: "5px",
              background: "rgba(78,198,145,0.1)", padding: "3px 8px", borderRadius: "6px"
            }}>
              <Sparkles size={11} /> Voice Active ({peakLevel}%)
            </span>
          ) : chunksReceived > 0 ? (
            <span style={{ color: "#777" }}>
              Silence / low audio
            </span>
          ) : null}

          <div>
            {chunksReceived > 0 ? (
              <>
                <strong style={{ color: "#4ec691" }}>{chunksReceived}</strong> frames received
              </>
            ) : (
              "Awaiting phone audio…"
            )}
          </div>
        </div>
      </div>

      {/* ── Info Footer ── */}
      <div style={{
        padding: "8px 18px", borderTop: "1px solid #14141a",
        fontSize: "11px", color: "#444",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: "6px",
      }}>
        <div>
          ℹ Plays directly to your local speakers. If silent, click <strong>Test Speaker</strong> above to verify browser audio output.
        </div>
        <div style={{ color: "#555" }}>
          Rate: {sampleRate} Hz · PCM 16-bit
        </div>
      </div>
    </div>
  );
}

export default LiveAudioMonitor;
