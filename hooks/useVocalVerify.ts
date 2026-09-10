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

  // Common analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [result, setResult] = useState<ScanResult | null>(null);
  
  // Fake Video Mode State
  const [publicFigureTarget, setPublicFigureTarget] = useState("");
  const [isManualReferenceUpload, setIsManualReferenceUpload] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedDuration, setUploadedDuration] = useState<string | null>(null);
  const [manualReferenceName, setManualReferenceName] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [manualReferenceFile, setManualReferenceFile] = useState<File | null>(null);

  // Call Verify Mode State
  const [callTarget, setCallTarget] = useState("");
  const [callSimilarityThreshold, setCallSimilarityThreshold] = useState(85);

  const timer = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const runAnalysisProcess = useCallback((preset: ScanResult, maxSteps: number) => {
    clearTimer();
    setResult(null);
    setIsAnalyzing(true);
    setAnalysisStep(1);
    let nextStep = 1;
    const advance = () => {
      if (nextStep >= maxSteps) {
        setAnalysisStep(maxSteps);
        setResult(preset);
        setIsAnalyzing(false);
        timer.current = null;
        return;
      }
      nextStep += 1;
      setAnalysisStep(nextStep);
      const delay = preset.mode === 'call' ? 1000 : 1200; 
      timer.current = window.setTimeout(advance, delay);
    };
    timer.current = window.setTimeout(advance, preset.mode === 'call' ? 1000 : 1200);
  }, [clearTimer]);

  const loadDemoFakeVideo = useCallback(() => {
    setUploadedFileName("press-briefing-clip.mp4");
    setUploadedDuration("00:42");
    setPublicFigureTarget("Narendra Modi");
    setIsManualReferenceUpload(false);
    runAnalysisProcess(fakeVideoResult, 6);
  }, [runAnalysisProcess]);

  const loadDemoRealVideo = useCallback(() => {
    setUploadedFileName("official-address.mp4");
    setUploadedDuration("01:16");
    setPublicFigureTarget("Narendra Modi");
    setIsManualReferenceUpload(false);
    runAnalysisProcess(realVideoResult, 6);
  }, [runAnalysisProcess]);

  // Real backend pipeline caller
  const runRealVideoAnalysis = useCallback(async () => {
    if (!uploadedFile) {
      loadDemoFakeVideo();
      return;
    }

    clearTimer();
    setResult(null);
    setIsAnalyzing(true);
    setAnalysisStep(1);

    // Progress animation through the 6 pipeline stages while processing
    let currentStep = 1;
    const interval = window.setInterval(() => {
      if (currentStep < 5) {
        currentStep += 1;
        setAnalysisStep(currentStep);
      }
    }, 1100);

    try {
      const formData = new FormData();
      formData.append("file", uploadedFile);
      if (publicFigureTarget) {
        formData.append("public_figure_name", publicFigureTarget);
      }
      if (manualReferenceFile) {
        formData.append("reference_file", manualReferenceFile);
      }

      let response: Response | undefined;
      try {
        response = await fetch("/api/v1/verify-public-figure", {
          method: "POST",
          body: formData,
        });
      } catch (err1) {
        try {
          response = await fetch("http://127.0.0.1:8000/api/v1/verify-public-figure", {
            method: "POST",
            body: formData,
          });
        } catch (err2) {
          console.error("Both relative and direct fetch failed:", err1, err2);
        }
      }

      window.clearInterval(interval);
      setAnalysisStep(6);

      if (response && response.ok) {
        const data = await response.json();
        setResult({
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
      setAnalysisStep(6);
      alert("Error running analysis: " + (err?.message || err));
    } finally {
      window.clearInterval(interval);
      setIsAnalyzing(false);
    }
  }, [uploadedFile, manualReferenceFile, publicFigureTarget, clearTimer, loadDemoFakeVideo]);

  const loadDemoCeoVishing = useCallback(() => {
    setUploadedFileName("suspicious_ceo_transfer.wav");
    setCallTarget("John Doe (CEO)");
    runAnalysisProcess(ceoVishingScamResult, 5);
  }, [runAnalysisProcess]);

  const loadDemoBankOtp = useCallback(() => {
    setUploadedFileName("bank_manager_otp_call.wav");
    setCallTarget("SBI Support Vault");
    runAnalysisProcess(bankOtpFraudResult, 5);
  }, [runAnalysisProcess]);

  const loadDemoVerifiedExec = useCallback(() => {
    setUploadedFileName("legit_cfo_briefing.wav");
    setCallTarget("Sarah Jenkins (CFO)");
    runAnalysisProcess(verifiedExecutiveCallResult, 5);
  }, [runAnalysisProcess]);

  const resetAnalysis = useCallback(() => {
    clearTimer();
    setResult(null);
    setIsAnalyzing(false);
    setAnalysisStep(0);
    setUploadedFileName(null);
    setUploadedDuration(null);
    setUploadedFile(null);
    setManualReferenceFile(null);
  }, [clearTimer]);

  // Real call analysis caller
  const runRealCallAnalysis = useCallback(async () => {
    if (!uploadedFile) {
      loadDemoCeoVishing();
      return;
    }

    clearTimer();
    setResult(null);
    setIsAnalyzing(true);
    setAnalysisStep(1);

    let currentStep = 1;
    const interval = window.setInterval(() => {
      if (currentStep < 5) {
        currentStep += 1;
        setAnalysisStep(currentStep);
      }
    }, 1000);

    try {
      const formData = new FormData();
      formData.append("file", uploadedFile);
      if (callTarget) {
        formData.append("public_figure_name", callTarget);
      }
      if (manualReferenceFile) {
        formData.append("reference_file", manualReferenceFile);
      }

      let response: Response | undefined;
      try {
        response = await fetch("/api/v1/verify-public-figure", {
          method: "POST",
          body: formData,
        });
      } catch (err1) {
        try {
          response = await fetch("http://127.0.0.1:8000/api/v1/verify-public-figure", {
            method: "POST",
            body: formData,
          });
        } catch (err2) {
          console.error("Both relative and direct fetch failed:", err1, err2);
        }
      }

      window.clearInterval(interval);
      setAnalysisStep(5);

      if (response && response.ok) {
        const data = await response.json();
        setResult({
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
      setAnalysisStep(5);
      alert("Error running call analysis: " + (err?.message || err));
    } finally {
      window.clearInterval(interval);
      setIsAnalyzing(false);
    }
  }, [uploadedFile, callTarget, manualReferenceFile, clearTimer, loadDemoCeoVishing]);

  // Live Phone WebSocket state
  const [liveCall, setLiveCall] = useState<any | null>(null);
  const [isPhoneConnected, setIsPhoneConnected] = useState(false);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connectWs = () => {
      try {
        if (typeof window === "undefined") return;
        const isLocalDev = window.location.port === "3000";
        const wsUrl = isLocalDev
          ? "ws://127.0.0.1:8000/ws/dashboard"
          : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws/dashboard`;

        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setIsPhoneConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            if (event.data === "pong") return;
            const data = JSON.parse(event.data);
            if (data.event_type === "NEW_VERDICT") {
              setLiveCall(data);
              const v = data.verdict;
              if (v) {
                setResult({
                  id: v.sessionId || `CALL-${Date.now().toString().slice(-4)}`,
                  timestamp: new Date(),
                  mode: "call",
                  filename: `Live Call: ${data.caller_number || "Incoming"}`,
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
                  geminiExplanation: `Live call screening event for caller ${data.caller_number || "unknown"}. Synthetic score: ${((v.syntheticScore || 0) * 100).toFixed(1)}%.`,
                });
              }
            }
          } catch (e) {
            // ignore non-json
          }
        };

        ws.onclose = () => {
          setIsPhoneConnected(false);
          reconnectTimeout = setTimeout(connectWs, 4000);
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch (err) {
        reconnectTimeout = setTimeout(connectWs, 5000);
      }
    };

    connectWs();
    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  return {
    // Navigation
    activeView, setActiveView,
    activeModal, setActiveModal,
    
    // Process State
    isAnalyzing, analysisStep, result, resetAnalysis,

    // Fake Video Mode
    publicFigureTarget, setPublicFigureTarget,
    isManualReferenceUpload, setIsManualReferenceUpload,
    uploadedFileName, setUploadedFileName,
    uploadedDuration, setUploadedDuration,
    manualReferenceName, setManualReferenceName,
    uploadedFile, setUploadedFile,
    manualReferenceFile, setManualReferenceFile,
    runRealVideoAnalysis,
    loadDemoFakeVideo, loadDemoRealVideo,

    // Call Verify Mode
    callTarget, setCallTarget,
    callSimilarityThreshold, setCallSimilarityThreshold,
    loadDemoCeoVishing, loadDemoBankOtp, loadDemoVerifiedExec,
    runRealCallAnalysis,
    liveCall, isPhoneConnected
  };
}

