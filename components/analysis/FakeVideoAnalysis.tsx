"use client";

import { ChangeEvent, DragEvent, useRef, type CSSProperties } from "react";
import { CheckCircle2, Circle, FileVideo, LoaderCircle, Mic2, Play, Upload, UserRound, Youtube } from "lucide-react";
import type { ScanResult } from "../../hooks/useVocalVerify";

export function FakeVideoAnalysis(props: any) {
  const mediaInput = useRef<HTMLInputElement>(null);
  const referenceInput = useRef<HTMLInputElement>(null);
  
  const {
    publicFigureTarget, setPublicFigureTarget,
    isManualReferenceUpload, setIsManualReferenceUpload,
    uploadedFileName, setUploadedFileName,
    uploadedDuration, setUploadedDuration,
    manualReferenceName, setManualReferenceName,
    uploadedFile, setUploadedFile,
    manualReferenceFile, setManualReferenceFile,
    isAnalyzing, analysisStep, result,
    runRealVideoAnalysis,
    loadDemoFakeVideo
  } = props;

  const resultData = result as ScanResult;

  const selectingFile = (file?: File) => {
    if (!file) return;
    setUploadedFile?.(file);
    setUploadedFileName(file.name);
    setUploadedDuration("Ready for analysis");
  };
  const onMediaChange = (event: ChangeEvent<HTMLInputElement>) => selectingFile(event.target.files?.[0]);
  const dropMedia = (event: DragEvent<HTMLButtonElement>) => { event.preventDefault(); selectingFile(event.dataTransfer.files?.[0]); };
  const onReferenceChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setManualReferenceFile?.(file);
    setManualReferenceName(file?.name ?? null);
  };
  const canSubmit = Boolean(uploadedFileName && (publicFigureTarget || isManualReferenceUpload));

  return <section className="analysis-section">
    <div className="analysis-inputs">
      <article className="dark-card media-card">
        <div className="card-title"><span className="icon-shell"><FileVideo size={18} /></span><div><p>01 · SOURCE MEDIA</p><h3>Upload suspicious video or audio</h3></div></div>
        <input ref={mediaInput} type="file" accept=".mp4,.mov,.avi,.mp3,.wav,video/*,audio/*" onChange={onMediaChange} hidden />
        {uploadedFileName ? <div className="uploaded-media"><div className="video-preview"><span className="play-dot"><Play size={15} fill="currentColor" /></span><i /><i /><i /><i /><i /><i /><i /><i /></div><div><b>{uploadedFileName}</b><span>{uploadedDuration}</span></div><button onClick={() => mediaInput.current?.click()}>Replace</button></div> : <button className="dropzone" onClick={() => mediaInput.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={dropMedia}><span className="upload-round"><Upload size={21} /></span><b>Drop a video or audio file here</b><small>MP4, MOV, AVI, MP3 or WAV · max 100 MB</small><em>Choose a file</em></button>}
      </article>
      <article className="dark-card identity-card">
        <div className="card-title"><span className="icon-shell youtube"><UserRound size={18} /></span><div><p>02 · CLAIMED IDENTITY</p><h3>Who does this claim to be?</h3></div></div>
        {!isManualReferenceUpload ? <><label className="field-label">PUBLIC FIGURE NAME<input value={publicFigureTarget} onChange={(e) => setPublicFigureTarget(e.target.value)} placeholder="e.g. Narendra Modi, Elon Musk" /></label><p className="helper-copy">VocalVerify will automatically search YouTube for this person&apos;s official speech using YouTube Data API v3.</p><p className="youtube-powered"><Youtube size={16} /> Powered by YouTube Data API</p></> : <><input ref={referenceInput} type="file" accept="audio/*,video/*,.mp3,.wav,.mp4" onChange={onReferenceChange} hidden /><button className="small-dropzone" onClick={() => referenceInput.current?.click()}><Mic2 size={19} /><b>{manualReferenceName ?? "Upload reference audio"}</b><span>{manualReferenceName ? "Reference added" : "MP3, WAV or MP4"}</span></button></>}
        <button className={`toggle-row ${isManualReferenceUpload ? "enabled" : ""}`} onClick={() => setIsManualReferenceUpload(!isManualReferenceUpload)}><span><i /></span> Or upload reference manually</button>
      </article>
    </div>
    
    <div style={{ display: "flex", gap: "12px", alignItems: "center", margin: "16px 0" }}>
      <button
        className="analyse-button"
        style={{ flex: 1, margin: 0 }}
        disabled={!canSubmit || isAnalyzing}
        onClick={runRealVideoAnalysis}
      >
        <Youtube size={18} />{isAnalyzing ? "Analyzing Media & Verifying Identity…" : "Check Public Figure"}
      </button>
      <button
        type="button"
        style={{
          padding: "0 16px",
          height: "46px",
          fontSize: "12px",
          background: "#18181c",
          border: "1px solid #333",
          color: "#aaa",
          borderRadius: "8px",
          cursor: "pointer",
          whiteSpace: "nowrap"
        }}
        onClick={loadDemoFakeVideo}
      >
        Load Demo Preset
      </button>
    </div>
    
    {(isAnalyzing || analysisStep > 0) && <Pipeline step={analysisStep} person={publicFigureTarget || "public figure"} />}
    {resultData && !isAnalyzing && <Results result={resultData} />}
  </section>;
}

const steps = [
  "Audio extracted from video file (FFmpeg)",
  "YouTube API searched for official speech: '{name} speech'",
  "Reference clip downloaded via yt-dlp",
  "Both audio streams converted to 16kHz mono WAV",
  "Running PLAD + XGBoost + Meta FAIR wav2vec 2.0 pipeline...",
  "Running ECAPA-TDNN 192-D speaker verification..."
];

function Pipeline({ step, person }: { step: number; person: string }) {
  return <section className="pipeline dark-card"><div className="pipeline-heading"><div><p className="overline">PROCESSING PIPELINE</p><h3>{step === 6 ? "Cross-verification complete" : "Cross-verifying the evidence"}</h3></div><span>{step} / 6</span></div><div className="pipeline-list">{steps.map((item, index) => { const complete = step === 6; const current = !complete && index + 1 === step; const done = index + 1 < step || complete; return <div className={done ? "done" : current ? "running" : "pending"} key={item}>{done ? <CheckCircle2 size={19} /> : current ? <LoaderCircle className="spin" size={19} /> : <Circle size={19} />}<span>{item.replace("{name}", person)}</span>{current && <em>In progress</em>}</div>; })}</div></section>;
}

function Results({ result }: { result: ScanResult }) {
  const isHighSimilarity = result.speakerMatch?.sameSpeaker ?? false;
  
  let tone = "green";
  let label = "VERIFIED";
  let title = "Verified Genuine Voice";
  
  if (result.riskTier === 'HIGH') {
    tone = "red"; label = "HIGH RISK"; title = "AI Voice + Impersonation Confirmed";
  } else if (result.riskTier === 'MEDIUM') {
    tone = "orange"; label = "REVIEW"; title = "AI Voice Detected, Speaker Uncertain";
  } else if (result.riskTier === 'LOW') {
    tone = "yellow"; label = "MISMATCH"; title = "Real Voice but Wrong Speaker";
  }

  return <section className="result-section"><p className="overline results-label">ANALYSIS RESULTS</p><div className="results-grid">
    <article className="dark-card result-card anti-spoof"><div className="result-top"><span>ANTI-SPOOFING</span><i>PLAD + ML</i></div><div className="score-gauge" style={{ "--score": `${result.finalScore * 360}deg` } as CSSProperties}><b>{Math.round(result.finalScore * 100)}<small>%</small></b><span>FAKE RISK</span></div><div className="signal-scores"><span>PLAD score <b>{Math.round((1.0 - (result.plad.livenessScore > 1 ? result.plad.livenessScore / 100 : result.plad.livenessScore)) * 100)}%</b></span><span>ML score <b>{Math.round(result.mlScore <= 1.0 ? result.mlScore * 100 : result.mlScore)}%</b></span><span>Deep score <b>{Math.round(result.deepScore <= 1.0 ? result.deepScore * 100 : result.deepScore)}%</b></span></div></article>
    <article className="dark-card result-card identity-result">
      <div className="result-top"><span>IDENTITY VERIFICATION</span><i>3-Sample Centroid</i></div>
      <b className={isHighSimilarity ? "similarity good" : "similarity bad"}>{result.speakerMatch?.similarityScore.toFixed(1)}<small>%</small></b>
      <h4>{isHighSimilarity ? "Speaker match found" : "Speaker does not match"}</h4>
      {result.speakerMatch?.referenceScores && result.speakerMatch.referenceScores.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", margin: "8px 0", fontSize: "11px" }}>
          {result.speakerMatch.referenceScores.map((score, idx) => (
            <span key={idx} style={{ background: "#1e1e24", padding: "3px 7px", borderRadius: "4px", border: "1px solid #333", color: "#aaa" }}>
              Sample {idx + 1}: <strong style={{ color: "#fff" }}>{score.toFixed(1)}%</strong>
            </span>
          ))}
          {result.speakerMatch.centroidScore !== undefined && (
            <span style={{ background: "rgba(99, 102, 241, 0.15)", padding: "3px 7px", borderRadius: "4px", border: "1px solid #6366f1", color: "#a5b4fc" }}>
              Centroid Mean: <strong>{result.speakerMatch.centroidScore.toFixed(1)}%</strong>
            </span>
          )}
        </div>
      )}
      <p>{result.speakerMatch?.referenceTitle || "Compared against Voice Vault reference"}</p>
      <code>{result.speakerMatch?.youtubeReferenceUrl || 'N/A'}</code>
    </article>
    <article className={`verdict-card ${tone}`}><span className="verdict-label">FINAL VERDICT</span><b>{label}</b><h3>{title}</h3><div><p>THREAT VERDICT ANALYSIS</p><span>{result.geminiExplanation}</span></div></article>
  </div></section>;
}
