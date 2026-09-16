"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface PLADResult {
  jitter: number;
  shimmer: number;
  breathEnergy: number;
  spectralFlux: number;
  livenessScore: number;
  verdict: "REAL" | "FAKE";
}

export interface SpeakerVerificationResult {
  similarityScore: number;
  embeddingDimensions: number;
  sameSpeaker: boolean;
  verdict: "MATCH" | "MISMATCH";
  youtubeReferenceUrl?: string;
  referenceTitle?: string;
  referenceScores?: number[];
  centroidScore?: number;
  sampleCount?: number;
}

export interface ScanResult {
  id: string;
  timestamp: Date;
  mode: "quick" | "call" | "public_figure";
  filename: string;
  duration: number;
  claimedIdentity?: string;
  plad: PLADResult;
  mlScore: number;
  deepScore: number;
  speakerMatch?: SpeakerVerificationResult;
  finalScore: number;
  riskTier: "HIGH" | "MEDIUM" | "LOW" | "SAFE";
  outcomeCode: "AI_IMPERSONATION" | "AI_UNCERTAIN" | "REAL_WRONG_SPEAKER" | "GENUINE";
  geminiExplanation: string;
}

export interface ScanHistoryItem {
  id: string;
  filename: string;
  verdict: "REAL" | "FAKE" | "UNCERTAIN" | "SAFE";
  timestamp: Date;
  mode: string;
  riskTier: "HIGH" | "MEDIUM" | "LOW" | "SAFE";
}

type ViewType = "home" | "call_verify" | "fake_video" | "saved_scans" | "threat_analytics" | "telemetry";
type ModalType = "solutions" | "documentation" | "research" | "api_docs" | null;

/**
 * Resolves the backend base URL. A static dashboard served by app.py must use
 * its current origin (including ngrok tunnels or public proxies), not localhost.
 */
export function getBackendBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (envUrl && envUrl.trim() !== "") {
    const configured = envUrl.trim().replace(/\/+$/, "");
    // NEXT_PUBLIC_BACKEND_URL is embedded at build time. A localhost value is
    // correct for `npm run dev`, but must not make a dashboard opened through
    // an ngrok tunnel call the viewer's own localhost.
    if (typeof window !== "undefined") {
      const configuredHost = new URL(configured).hostname;
      const pageHost = window.location.hostname;
      const configuredIsLocal = configuredHost === "localhost" || configuredHost === "127.0.0.1";
      const pageIsLocal = pageHost === "localhost" || pageHost === "127.0.0.1";
      if (configuredIsLocal && !pageIsLocal) return window.location.origin;
    }
    return configured;
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "http://localhost:8080";
}

/**
 * Dynamically converts the backend URL protocol to WebSocket protocol:
 * https:// -> wss:// (ngrok tunnels *.ngrok-free.app, *.ngrok.app, *.ngrok.io)
 * http://  -> ws://  (Localhost / plain HTTP)
 */
export function getBackendWsUrl(path: string = "/ws/dashboard"): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const baseUrl = getBackendBaseUrl();

  if (baseUrl.startsWith("https://")) {
    return baseUrl.replace(/^https:\/\//i, "wss://") + cleanPath;
  }
  if (baseUrl.startsWith("http://")) {
    return baseUrl.replace(/^http:\/\//i, "ws://") + cleanPath;
  }
  if (baseUrl.startsWith("wss://") || baseUrl.startsWith("ws://")) {
    return baseUrl.replace(/\/+$/, "") + cleanPath;
  }
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}${cleanPath}`;
  }
  return `ws://localhost:8080${cleanPath}`;
}

// Fake Video Demos
const fakeVideoResult: ScanResult = {
  id: "SCAN-92A1",
  timestamp: new Date(),
  mode: "public_figure",
  filename: "press-briefing-clip.mp4",
  duration: 42,
  claimedIdentity: "Narendra Modi",
  plad: { jitter: 14.2, shimmer: 8.5, breathEnergy: 0.12, spectralFlux: 0.45, livenessScore: 0.08, verdict: "FAKE" },
  mlScore: 0.91,
  deepScore: 0.97,
  speakerMatch: { similarityScore: 18.4, embeddingDimensions: 192, sameSpeaker: false, verdict: "MISMATCH", youtubeReferenceUrl: "youtube.com/watch?v=demo_reference" },
  finalScore: 0.95,
  riskTier: "HIGH",
  outcomeCode: "AI_IMPERSONATION",
  geminiExplanation: "The clip contains strong synthetic-speech artifacts and does not match the reference speaker's vocal embedding. Treat this as a likely voice-cloning impersonation."
};

const realVideoResult: ScanResult = {
  id: "SCAN-92A2",
  timestamp: new Date(),
  mode: "public_figure",
  filename: "official-address.mp4",
  duration: 76,
  claimedIdentity: "Narendra Modi",
  plad: { jitter: 2.1, shimmer: 1.4, breathEnergy: 0.85, spectralFlux: 0.92, livenessScore: 0.96, verdict: "REAL" },
  mlScore: 0.05,
  deepScore: 0.04,
  speakerMatch: { similarityScore: 96.2, embeddingDimensions: 192, sameSpeaker: true, verdict: "MATCH", youtubeReferenceUrl: "youtube.com/watch?v=demo_reference" },
  finalScore: 0.06,
  riskTier: "SAFE",
  outcomeCode: "GENUINE",
  geminiExplanation: "The recording shows natural speech characteristics and a high speaker match against the selected reference. No material synthesis signals were found in this demo."
};

// Call Verify Demos
const ceoVishingScamResult: ScanResult = {
  id: "CALL-301X",
  timestamp: new Date(),
  mode: "call",
  filename: "suspicious_ceo_transfer.wav",
  duration: 18,
  claimedIdentity: "John Doe (CEO)",
  plad: { jitter: 18.5, shimmer: 10.1, breathEnergy: 0.05, spectralFlux: 0.3, livenessScore: 0.03, verdict: "FAKE" },
  mlScore: 0.95,
  deepScore: 0.98,
  speakerMatch: { similarityScore: 94.2, embeddingDimensions: 192, sameSpeaker: true, verdict: "MATCH" },
  finalScore: 0.968,
  riskTier: "HIGH",
  outcomeCode: "AI_IMPERSONATION",
  geminiExplanation: "Warning: The caller is utilizing a synthetic AI voice clone engineered to mimic CFO John Doe. The acoustic signal exhibits a 96.8% synthetic vocoder probability and matching voice embeddings. Do not authorize financial requests."
};

const bankOtpFraudResult: ScanResult = {
  id: "CALL-302Y",
  timestamp: new Date(),
  mode: "call",
  filename: "bank_manager_otp_call.wav",
  duration: 24,
  claimedIdentity: "SBI Support Vault",
  plad: { jitter: 12.4, shimmer: 9.0, breathEnergy: 0.15, spectralFlux: 0.5, livenessScore: 0.12, verdict: "FAKE" },
  mlScore: 0.88,
  deepScore: 0.94,
  speakerMatch: { similarityScore: 12.5, embeddingDimensions: 192, sameSpeaker: false, verdict: "MISMATCH" },
  finalScore: 0.912,
  riskTier: "MEDIUM",
  outcomeCode: "AI_UNCERTAIN",
  geminiExplanation: "Warning: The caller is using an automated synthetic voice (91.2% probability) and does not match any enrolled bank support profiles. This is likely a robocall or automated phishing scam."
};

const verifiedExecutiveCallResult: ScanResult = {
  id: "CALL-303Z",
  timestamp: new Date(),
  mode: "call",
  filename: "legit_cfo_briefing.wav",
  duration: 55,
  claimedIdentity: "Sarah Jenkins (CFO)",
  plad: { jitter: 1.8, shimmer: 1.2, breathEnergy: 0.88, spectralFlux: 0.95, livenessScore: 0.98, verdict: "REAL" },
  mlScore: 0.02,
  deepScore: 0.01,
  speakerMatch: { similarityScore: 98.1, embeddingDimensions: 192, sameSpeaker: true, verdict: "MATCH" },
  finalScore: 0.015,
  riskTier: "SAFE",
  outcomeCode: "GENUINE",
  geminiExplanation: "The call has been verified. The acoustic signal is authentic human speech, and the speaker strongly matches the enrolled profile for Sarah Jenkins (CFO)."
};


export function useVocalVerify() {
  const [activeView, setActiveView] = useState<ViewType>("home");
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  // ── Fake Video Analysis Mode State ────────────────────────────────
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoFileName, setVideoFileName] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<string | null>(null);
  const [videoReferenceFile, setVideoReferenceFile] = useState<File | null>(null);
  const [videoReferenceName, setVideoReferenceName] = useState<string | null>(null);
  const [videoIsManualReferenceUpload, setVideoIsManualReferenceUpload] = useState(false);
  const [publicFigureTarget, setPublicFigureTarget] = useState("");
  const [videoIsAnalyzing, setVideoIsAnalyzing] = useState(false);
  const [videoAnalysisStep, setVideoAnalysisStep] = useState(0);
  const [videoOverlayMessage, setVideoOverlayMessage] = useState<string | null>(null);
  const [videoResult, setVideoResult] = useState<ScanResult | null>(null);

  // ── Call Verify Mode State ────────────────────────────────────────
  const [callFile, setCallFile] = useState<File | null>(null);
  const [callFileName, setCallFileName] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState<string | null>(null);
  const [callReferenceFile, setCallReferenceFile] = useState<File | null>(null);
  const [callReferenceName, setCallReferenceName] = useState<string | null>(null);
  const [callTarget, setCallTarget] = useState("");
  const [callSimilarityThreshold, setCallSimilarityThreshold] = useState(85);
  const [callIsAnalyzing, setCallIsAnalyzing] = useState(false);
  const [callAnalysisStep, setCallAnalysisStep] = useState(0);
  const [callOverlayMessage, setCallOverlayMessage] = useState<string | null>(null);
  const [callResult, setCallResult] = useState<ScanResult | null>(null);

  // Live Phone & Backend WebSocket state
  const [liveCall, setLiveCall] = useState<any | null>(null);
  const [isPhoneConnected, setIsPhoneConnected] = useState(false);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [activePhoneDevice, setActivePhoneDevice] = useState<string | null>(null);


  // Timers for demo presets
  const videoTimer = useRef<number | null>(null);
  const callTimer = useRef<number | null>(null);

  const clearVideoTimer = useCallback(() => {
    if (videoTimer.current) window.clearTimeout(videoTimer.current);
    videoTimer.current = null;
  }, []);

  const clearCallTimer = useCallback(() => {
    if (callTimer.current) window.clearTimeout(callTimer.current);
    callTimer.current = null;
  }, []);

  useEffect(() => {
    return () => {
      clearVideoTimer();
      clearCallTimer();
    };
  }, [clearVideoTimer, clearCallTimer]);

  // ── Fake Video Process & Demos ────────────────────────────────────
  const runVideoPresetProcess = useCallback((preset: ScanResult, maxSteps: number) => {
    clearVideoTimer();
    setVideoResult(null);
    setVideoIsAnalyzing(true);
    setVideoAnalysisStep(1);
    setVideoOverlayMessage("Analyzing media features...");
    let nextStep = 1;
    const advance = () => {
      if (nextStep >= maxSteps) {
        setVideoAnalysisStep(maxSteps);
        setVideoResult(preset);
        setVideoIsAnalyzing(false);
        setVideoOverlayMessage(null);
        videoTimer.current = null;
        return;
      }
      nextStep += 1;
      setVideoAnalysisStep(nextStep);
      videoTimer.current = window.setTimeout(advance, 1200);
    };
    videoTimer.current = window.setTimeout(advance, 1200);
  }, [clearVideoTimer]);

  const loadDemoFakeVideo = useCallback(() => {
    setVideoFileName("press-briefing-clip.mp4");
    setVideoDuration("00:42");
    setPublicFigureTarget("Narendra Modi");
    setVideoIsManualReferenceUpload(false);
    runVideoPresetProcess(fakeVideoResult, 6);
  }, [runVideoPresetProcess]);

  const loadDemoRealVideo = useCallback(() => {
    setVideoFileName("official-address.mp4");
    setVideoDuration("01:16");
    setPublicFigureTarget("Narendra Modi");
    setVideoIsManualReferenceUpload(false);
    runVideoPresetProcess(realVideoResult, 6);
  }, [runVideoPresetProcess]);

  const resetVideoAnalysis = useCallback(() => {
    clearVideoTimer();
    setVideoResult(null);
    setVideoIsAnalyzing(false);
    setVideoAnalysisStep(0);
    setVideoOverlayMessage(null);
    setVideoFileName(null);
    setVideoDuration(null);
    setVideoFile(null);
    setVideoReferenceFile(null);
    setVideoReferenceName(null);
  }, [clearVideoTimer]);

  const runRealVideoAnalysis = useCallback(async () => {
    if (!videoFile) {
      loadDemoFakeVideo();
      return;
    }

    clearVideoTimer();
    setVideoResult(null);
    setVideoIsAnalyzing(true);
    setVideoAnalysisStep(1);
    setVideoOverlayMessage("Extracting audio from media container (FFmpeg)...");

    let currentStep = 1;
    const interval = window.setInterval(() => {
      if (currentStep < 5) {
        currentStep += 1;
        setVideoAnalysisStep((prev) => Math.max(prev, currentStep));
      }
    }, 1100);

    try {
      const formData = new FormData();
      formData.append("file", videoFile);
      if (publicFigureTarget) {
        formData.append("public_figure_name", publicFigureTarget);
      }
      if (videoReferenceFile) {
        formData.append("reference_file", videoReferenceFile);
      }

      const backendBase = getBackendBaseUrl();
      let response: Response | undefined;
      try {
        response = await fetch(`${backendBase}/api/v1/verify-public-figure`, {
          method: "POST",
          body: formData,
        });
      } catch (err1) {
        console.warn(`Primary fetch to ${backendBase} failed, trying relative fallback:`, err1);
        try {
          response = await fetch("/api/v1/verify-public-figure", {
            method: "POST",
            body: formData,
          });
        } catch (err2) {
          console.error("Both direct and fallback fetch failed:", err1, err2);
        }
      }

      window.clearInterval(interval);
      setVideoAnalysisStep(6);
      setVideoOverlayMessage("Cross-verification complete");

      if (response && response.ok) {
        const data = await response.json();
        setVideoResult({
          ...data,
          timestamp: new Date(data.timestamp || Date.now()),
        });
      } else {
        const errDetail = response ? await response.text() : "Network error";
        console.error("Verification backend returned error:", errDetail);
        alert("Backend analysis error: " + errDetail);
      }
    } catch (err: any) {
      console.error("Pipeline execution error:", err);
      window.clearInterval(interval);
      setVideoAnalysisStep(6);
      alert("Error running analysis: " + (err?.message || err));
    } finally {
      window.clearInterval(interval);
      setVideoIsAnalyzing(false);
      setVideoOverlayMessage(null);
    }
  }, [videoFile, videoReferenceFile, publicFigureTarget, clearVideoTimer, loadDemoFakeVideo]);

  // ── Call Verify Process & Demos ───────────────────────────────────
  const runCallPresetProcess = useCallback((preset: ScanResult, maxSteps: number) => {
    clearCallTimer();
    setCallResult(null);
    setCallIsAnalyzing(true);
    setCallAnalysisStep(1);
    setCallOverlayMessage("Screening call audio...");
    let nextStep = 1;
    const advance = () => {
      if (nextStep >= maxSteps) {
        setCallAnalysisStep(maxSteps);
        setCallResult(preset);
        setCallIsAnalyzing(false);
        setCallOverlayMessage(null);
        callTimer.current = null;
        return;
      }
      nextStep += 1;
      setCallAnalysisStep(nextStep);
      callTimer.current = window.setTimeout(advance, 1000);
    };
    callTimer.current = window.setTimeout(advance, 1000);
  }, [clearCallTimer]);

  const loadDemoCeoVishing = useCallback(() => {
    setCallFileName("suspicious_ceo_transfer.wav");
    setCallTarget("John Doe (CEO)");
    runCallPresetProcess(ceoVishingScamResult, 5);
  }, [runCallPresetProcess]);

  const loadDemoBankOtp = useCallback(() => {
    setCallFileName("bank_manager_otp_call.wav");
    setCallTarget("SBI Support Vault");
    runCallPresetProcess(bankOtpFraudResult, 5);
  }, [runCallPresetProcess]);

  const loadDemoVerifiedExec = useCallback(() => {
    setCallFileName("legit_cfo_briefing.wav");
    setCallTarget("Sarah Jenkins (CFO)");
    runCallPresetProcess(verifiedExecutiveCallResult, 5);
  }, [runCallPresetProcess]);

  const resetCallAnalysis = useCallback(() => {
    clearCallTimer();
    setCallResult(null);
    setCallIsAnalyzing(false);
    setCallAnalysisStep(0);
    setCallOverlayMessage(null);
    setCallFileName(null);
    setCallDuration(null);
    setCallFile(null);
    setCallReferenceFile(null);
    setCallReferenceName(null);
  }, [clearCallTimer]);

  const runRealCallAnalysis = useCallback(async () => {
    if (!callFile) {
      loadDemoCeoVishing();
      return;
    }

    clearCallTimer();
    setCallResult(null);
    setCallIsAnalyzing(true);
    setCallAnalysisStep(1);
    setCallOverlayMessage("Normalizing Telephony Codec: AMR-WB / PCM -> 16kHz Mono WAV...");

    let currentStep = 1;
    const interval = window.setInterval(() => {
      if (currentStep < 4) {
        currentStep += 1;
        setCallAnalysisStep((prev) => Math.max(prev, currentStep));
      }
    }, 1000);

    try {
      const formData = new FormData();
      formData.append("file", callFile);
      if (callTarget) {
        formData.append("public_figure_name", callTarget);
      }
      if (callReferenceFile) {
        formData.append("reference_file", callReferenceFile);
      }

      const backendBase = getBackendBaseUrl();
      let response: Response | undefined;
      try {
        response = await fetch(`${backendBase}/api/v1/verify-public-figure`, {
          method: "POST",
          body: formData,
        });
      } catch (err1) {
        console.warn(`Primary fetch to ${backendBase} failed, trying relative fallback:`, err1);
        try {
          response = await fetch("/api/v1/verify-public-figure", {
            method: "POST",
            body: formData,
          });
        } catch (err2) {
          console.error("Both direct and fallback fetch failed:", err1, err2);
        }
      }

      window.clearInterval(interval);
      setCallAnalysisStep(5);
      setCallOverlayMessage("Telephony analysis complete");

      if (response && response.ok) {
        const data = await response.json();
        setCallResult({
          ...data,
          mode: "call",
          timestamp: new Date(data.timestamp || Date.now()),
        });
      } else {
        const errDetail = response ? await response.text() : "Network error";
        console.error("Call verification backend error:", errDetail);
        alert("Backend analysis error: " + errDetail);
      }
    } catch (err: any) {
      console.error("Call verification error:", err);
      window.clearInterval(interval);
      setCallAnalysisStep(5);
      alert("Error running call analysis: " + (err?.message || err));
    } finally {
      window.clearInterval(interval);
      setCallIsAnalyzing(false);
      setCallOverlayMessage(null);
    }
  }, [callFile, callTarget, callReferenceFile, clearCallTimer, loadDemoCeoVishing]);

  // ── Dynamic WebSocket Protocol & Live Stream Sync ─────────────────
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;
    let pingInterval: any = null;
    let isMounted = true;

    const connectWs = () => {
      try {
        if (typeof window === "undefined" || !isMounted) return;
        const wsUrl = getBackendWsUrl("/ws/dashboard");
        console.log(`[VocalVerify WS] Connecting to: ${wsUrl}`);

        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          if (!isMounted) return;
          console.log(`[VocalVerify WS] Dashboard socket established with ${wsUrl}`);
          setIsBackendConnected(true);

          // Keep alive ping every 20s for ngrok / proxy tunnels
          if (pingInterval) clearInterval(pingInterval);
          pingInterval = setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
              try { ws.send("ping"); } catch (_) {}
            }
          }, 20000);
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            if (event.data === "pong") return;
            const data = JSON.parse(event.data);

            // Step-by-step progress sync from backend
            if (data.event_type === "PIPELINE_PROGRESS" || data.type === "progress") {
              if (typeof data.step === "number" && data.step > 0) {
                setVideoAnalysisStep(data.step);
                setCallAnalysisStep(data.step);
              }
              if (data.message) {
                setVideoOverlayMessage(data.message);
                setCallOverlayMessage(data.message);
              }
              return;
            }

            // Real-time Mobile Phone Connection status events
            if (data.event_type === "PHONE_CONNECTED") {
              console.log("[VocalVerify WS] Mobile phone connected:", data.device_id);
              setIsPhoneConnected(true);
              if (data.device_id) setActivePhoneDevice(data.device_id);
              return;
            }

            if (data.event_type === "PHONE_DISCONNECTED") {
              console.log("[VocalVerify WS] Mobile phone disconnected:", data.device_id);
              setIsPhoneConnected(Boolean(data.is_phone_connected));
              if (!data.is_phone_connected) setActivePhoneDevice(null);
              return;
            }

            if (data.event_type === "PHONE_STATUS") {
              setIsPhoneConnected(Boolean(data.is_phone_connected));
              if (data.connected_devices && data.connected_devices.length > 0) {
                setActivePhoneDevice(data.connected_devices[0]);
              }
              return;
            }

            // Real-time Inbound Call Verdict Broadcasts from Mobile Overlay
            if (data.event_type === "NEW_VERDICT") {
              setIsPhoneConnected(true);
              if (data.device_id) setActivePhoneDevice(data.device_id);
              setLiveCall(data);
              const v = data.verdict;
              if (v) {
                const caller = data.caller_number || "Incoming";
                setCallFileName(`Live Call: ${caller}`);
                setCallDuration(`${Math.round((v.audioDurationMs || 3000) / 1000)}s`);
                if (v.matchedTarget) setCallTarget(v.matchedTarget);

                setCallResult({
                  id: v.sessionId || `CALL-${Date.now().toString().slice(-4)}`,
                  timestamp: new Date(),
                  mode: "call",
                  filename: `Live Call: ${caller}`,
                  duration: Math.round((v.audioDurationMs || 3000) / 1000),
                  claimedIdentity: v.matchedTarget || "Unknown Caller",
                  plad: {
                    jitter: 2.5,
                    shimmer: 1.8,
                    breathEnergy: 0.75,
                    spectralFlux: 0.8,
                    livenessScore: v.pladScore || (1.0 - v.syntheticScore),
                    verdict: (v.pladScore || 0) >= 0.5 ? "REAL" : "FAKE",
                  },
                  mlScore: v.mlScore || 0,
                  deepScore: v.dlScore || 0,
                  speakerMatch: {
                    similarityScore: (1.0 - (v.syntheticScore || 0)) * 100,
                    embeddingDimensions: 192,
                    sameSpeaker: v.outcomeCode === "GENUINE",
                    verdict: v.outcomeCode === "GENUINE" ? "MATCH" : "MISMATCH",
                  },
                  finalScore: v.syntheticScore || 0,
                  riskTier: v.riskTier || "LOW",
                  outcomeCode: v.outcomeCode || "GENUINE",
                  geminiExplanation: `Live call screening event for caller ${caller}. Synthetic score: ${((v.syntheticScore || 0) * 100).toFixed(1)}%. Risk tier: ${v.riskTier || "LOW"}.`,
                });
              }
            }
          } catch (e) {
            // ignore non-json
          }
        };

        ws.onclose = () => {
          if (pingInterval) { clearInterval(pingInterval); pingInterval = null; }
          if (!isMounted) return;
          console.warn("[VocalVerify WS] Dashboard socket closed. Reconnecting in 3s...");
          setIsBackendConnected(false);
          reconnectTimeout = setTimeout(connectWs, 3000);
        };

        ws.onerror = (err) => {
          console.warn("[VocalVerify WS] Socket error:", err);
        };
      } catch (err) {
        console.error("[VocalVerify WS] Initialization error:", err);
        if (isMounted) {
          setIsBackendConnected(false);
          reconnectTimeout = setTimeout(connectWs, 4000);
        }
      }
    };

    connectWs();
    return () => {
      isMounted = false;
      if (pingInterval) clearInterval(pingInterval);
      if (ws) {
        try { ws.close(); } catch (_) {}
      }
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  return {
    // Navigation
    activeView, setActiveView,
    activeModal, setActiveModal,

    // ── Fake Video Specific State & Actions ──
    publicFigureTarget, setPublicFigureTarget,
    videoFile, setVideoFile,
    videoFileName, setVideoFileName,
    videoDuration, setVideoDuration,
    videoReferenceFile, setVideoReferenceFile,
    videoReferenceName, setVideoReferenceName,
    videoIsManualReferenceUpload, setVideoIsManualReferenceUpload,
    videoIsAnalyzing, videoAnalysisStep, videoOverlayMessage, videoResult,
    resetVideoAnalysis,
    runRealVideoAnalysis,
    loadDemoFakeVideo, loadDemoRealVideo,

    // ── Call Verify Specific State & Actions ──
    callTarget, setCallTarget,
    callSimilarityThreshold, setCallSimilarityThreshold,
    callFile, setCallFile,
    callFileName, setCallFileName,
    callDuration, setCallDuration,
    callReferenceFile, setCallReferenceFile,
    callReferenceName, setCallReferenceName,
    callIsAnalyzing, callAnalysisStep, callOverlayMessage, callResult,
    resetCallAnalysis,
    loadDemoCeoVishing, loadDemoBankOtp, loadDemoVerifiedExec,
    runRealCallAnalysis,
    liveCall, isPhoneConnected, isBackendConnected, activePhoneDevice,


    // ── Active View Adapters (for convenience / backward compatibility) ──
    uploadedFile: activeView === "call_verify" ? callFile : videoFile,
    setUploadedFile: (f: File | null) => activeView === "call_verify" ? setCallFile(f) : setVideoFile(f),
    uploadedFileName: activeView === "call_verify" ? callFileName : videoFileName,
    setUploadedFileName: (n: string | null) => activeView === "call_verify" ? setCallFileName(n) : setVideoFileName(n),
    uploadedDuration: activeView === "call_verify" ? callDuration : videoDuration,
    setUploadedDuration: (d: string | null) => activeView === "call_verify" ? setCallDuration(d) : setVideoDuration(d),
    manualReferenceFile: activeView === "call_verify" ? callReferenceFile : videoReferenceFile,
    setManualReferenceFile: (f: File | null) => activeView === "call_verify" ? setCallReferenceFile(f) : setVideoReferenceFile(f),
    manualReferenceName: activeView === "call_verify" ? callReferenceName : videoReferenceName,
    setManualReferenceName: (n: string | null) => activeView === "call_verify" ? setCallReferenceName(n) : setVideoReferenceName(n),
    isManualReferenceUpload: activeView === "call_verify" ? false : videoIsManualReferenceUpload,
    setIsManualReferenceUpload: (val: boolean) => setVideoIsManualReferenceUpload(val),
    isAnalyzing: activeView === "call_verify" ? callIsAnalyzing : videoIsAnalyzing,
    analysisStep: activeView === "call_verify" ? callAnalysisStep : videoAnalysisStep,
    overlayMessage: activeView === "call_verify" ? callOverlayMessage : videoOverlayMessage,
    result: activeView === "call_verify" ? callResult : videoResult,
    resetAnalysis: activeView === "call_verify" ? resetCallAnalysis : resetVideoAnalysis,
  };
}
