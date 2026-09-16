import { useRef, useState, ChangeEvent, DragEvent } from "react";
import { 
  FileAudio, Play, Activity, User, ShieldAlert, CheckCircle2, 
  Upload, Radio, Mic2, ShieldCheck, AlertTriangle, Smartphone,
  Wifi, WifiOff, ChevronDown, ChevronUp, Copy, Check, Globe
} from "lucide-react";
import { ScanResult } from "../../hooks/useVocalVerify";
import { LiveAudioMonitor } from "./LiveAudioMonitor";

export function CallVerifyResult(props: any) {
  const { 
    callTarget, 
    setCallTarget, 
    callSimilarityThreshold, 
    setCallSimilarityThreshold,
    loadDemoCeoVishing, 
    loadDemoBankOtp, 
    loadDemoVerifiedExec,
    isAnalyzing,
    analysisStep,
    result,
    uploadedFileName,
    setUploadedFileName,
    setUploadedDuration,
    setUploadedFile,
    uploadedFile,
    manualReferenceFile,
    setManualReferenceFile,
    manualReferenceName,
    setManualReferenceName,
    runRealCallAnalysis,
    isPhoneConnected,
    isBackendConnected,
    activePhoneDevice,
    liveCall
  } = props;

  const audioInputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);
  const [targetMode, setTargetMode] = useState<"contacts" | "custom" | "upload">("contacts");
  const [customTarget, setCustomTarget] = useState("");
  const [showGuide, setShowGuide] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const resultData = result as ScanResult | null;
  const currentCaller = liveCall?.caller_number || (resultData?.filename?.startsWith("Live Call: ") ? resultData.filename.replace("Live Call: ", "") : "+91 98XXX XXXXX");


  const handleAudioSelect = (file?: File) => {
    if (!file) return;
    setUploadedFile?.(file);
    setUploadedFileName?.(file.name);
    setUploadedDuration?.("Ready for verification");
  };

  const onAudioChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleAudioSelect(e.target.files?.[0]);
  };

  const onDropAudio = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleAudioSelect(e.dataTransfer.files?.[0]);
  };

  const onRefChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setManualReferenceFile?.(f);
    setManualReferenceName?.(f?.name || null);
  };

  const defaultContacts = [
    { name: "Narendra Modi", role: "Prime Minister (Enrolled in Vault)" },
    { name: "John Doe (CEO)", role: "Chief Executive Officer" },
    { name: "Sarah Jenkins (CFO)", role: "Chief Financial Officer" },
    { name: "SBI Support Vault", role: "Institutional Security Profile" }
  ];

  const canRun = Boolean(
    (uploadedFile || uploadedFileName) && 
    (callTarget || customTarget || manualReferenceFile) && 
    !isAnalyzing
  );

  return (
    <div className="analysis-section" style={{maxWidth: '100%'}}>
      <section className="workspace-heading">
        <div>
          <p className="overline">MODE 02 · REAL-TIME TELEPHONY</p>
          <h2>Call Verify</h2>
          <span>Screen suspicious incoming calls & audio recordings against enrolled speaker voiceprints.</span>
        </div>
        <div className="demo-actions">
          <span>Load a demo</span>
          <button onClick={loadDemoCeoVishing}>CEO Vishing (Fake)</button>
          <button onClick={loadDemoBankOtp}>Bank OTP (Fake)</button>
          <button onClick={loadDemoVerifiedExec} style={{borderColor: 'rgba(78,198,145,0.25)', color: '#a5efc6'}}>Verified Exec (Real)</button>
        </div>
      </section>

      {/* Live Phone Overlay Stream Status Banner */}
      <div style={{
        background: isPhoneConnected ? 'rgba(78, 198, 145, 0.08)' : '#141418',
        border: `1px solid ${isPhoneConnected ? 'rgba(78, 198, 145, 0.3)' : 'var(--line)'}`,
        padding: '14px 18px',
        borderRadius: '10px',
        marginBottom: '16px',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
            <div style={{
              width: '12px', height: '12px', borderRadius: '50%',
              background: isPhoneConnected ? '#4ec691' : '#888',
              boxShadow: isPhoneConnected ? '0 0 12px #4ec691' : 'none',
              animation: isPhoneConnected ? 'pulse 2s infinite' : 'none'
            }} />
            <div>
              <div style={{fontSize: '13px', fontWeight: 'bold', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px'}}>
                <Smartphone size={15} style={{color: isPhoneConnected ? '#4ec691' : '#7dbdff'}} />
                {isPhoneConnected 
                  ? `Mobile Call Guard Active ${activePhoneDevice ? `(${activePhoneDevice})` : ''}` 
                  : 'Mobile Call Guard: Awaiting Phone Stream'}
                <span style={{
                  fontSize: '10px', 
                  padding: '2px 8px', 
                  borderRadius: '12px', 
                  background: isBackendConnected ? 'rgba(78, 198, 145, 0.15)' : 'rgba(255, 98, 109, 0.15)',
                  color: isBackendConnected ? '#4ec691' : '#ff626d',
                  fontWeight: 600
                }}>
                  {isBackendConnected ? 'Engine Online :8080' : 'Engine Connecting...'}
                </span>
              </div>
              <div style={{fontSize: '11px', color: '#888', marginTop: '2px'}}>
                FastAPI WebSocket: <code>/ws/telephony/&#123;device_id&#125;</code> — Receives real-time PCM-16 audio & sends live HUD verdicts.
              </div>
            </div>
          </div>

          <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
            {liveCall && (
              <div style={{
                background: liveCall.verdict?.riskTier === 'HIGH' ? 'rgba(255,98,109,0.2)' : 'rgba(78,198,145,0.2)',
                color: liveCall.verdict?.riskTier === 'HIGH' ? '#ff626d' : '#4ec691',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 'bold',
                border: `1px solid ${liveCall.verdict?.riskTier === 'HIGH' ? 'rgba(255,98,109,0.4)' : 'rgba(78,198,145,0.4)'}`
              }}>
                Live Stream: {liveCall.caller_number || "Incoming"} · {liveCall.verdict?.outcomeCode || "STREAMING"}
              </div>
            )}
            <button
              onClick={() => setShowGuide(!showGuide)}
              style={{
                background: '#222228',
                border: '1px solid var(--line)',
                color: '#7dbdff',
                fontSize: '11px',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Globe size={12} />
              Connect App
              {showGuide ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
        </div>

        {/* Expandable Phone App Connection Guide */}
        {showGuide && (
          <div style={{
            marginTop: '14px',
            paddingTop: '14px',
            borderTop: '1px solid var(--line)',
            fontSize: '12px',
            color: '#bbb',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px'
          }}>
            <div style={{background: '#0e0e12', padding: '12px', borderRadius: '8px', border: '1px solid #282832'}}>
              <div style={{fontWeight: 'bold', color: '#fff', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px'}}>
                <Globe size={13} style={{color: '#2bb3ff'}} /> Method 1: ngrok Tunnel (Recommended for Real Phone / APK)
              </div>
              <p style={{margin: '4px 0 8px 0', fontSize: '11px', color: '#888'}}>
                Run ngrok command in terminal to create a public HTTPS/WSS tunnel to FastAPI (:8080):
              </p>
              <div style={{display: 'flex', alignItems: 'center', gap: '6px', background: '#181820', padding: '6px 10px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '11px'}}>
                <span style={{flex: 1, color: '#4ec691'}}>ngrok http 8080</span>
                <button 
                  onClick={() => copyToClipboard('ngrok http 8080')}
                  style={{background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer'}}>
                  {copiedText === 'ngrok http 8080' ? <Check size={13} style={{color: '#4ec691'}}/> : <Copy size={13}/>}
                </button>
              </div>
              <p style={{margin: '8px 0 0 0', fontSize: '11px', color: '#999'}}>
                Copy the generated Forwarding URL (e.g. <code>https://&lt;subdomain&gt;.ngrok-free.app</code>) into your phone app's endpoint field and tap <strong>Save ngrok endpoint</strong>.
              </p>
            </div>

            <div style={{background: '#0e0e12', padding: '12px', borderRadius: '8px', border: '1px solid #282832'}}>
              <div style={{fontWeight: 'bold', color: '#fff', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px'}}>
                <Wifi size={13} style={{color: '#7dbdff'}} /> Method 2: Localhost / LAN
              </div>
              <p style={{margin: '4px 0 8px 0', fontSize: '11px', color: '#888'}}>
                For Android Studio Emulator or phone on same Wi-Fi network:
              </p>
              <div style={{display: 'flex', flexDirection: 'column', gap: '6px'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: '6px', background: '#181820', padding: '6px 10px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '11px'}}>
                  <span style={{color: '#888'}}>Emulator:</span>
                  <span style={{flex: 1, color: '#7dbdff'}}>http://10.0.2.2:8080</span>
                  <button 
                    onClick={() => copyToClipboard('http://10.0.2.2:8080')}
                    style={{background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer'}}>
                    {copiedText === 'http://10.0.2.2:8080' ? <Check size={13} style={{color: '#4ec691'}}/> : <Copy size={13}/>}
                  </button>
                </div>
                <div style={{display: 'flex', alignItems: 'center', gap: '6px', background: '#181820', padding: '6px 10px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '11px'}}>
                  <span style={{color: '#888'}}>Port forward:</span>
                  <span style={{flex: 1, color: '#7dbdff'}}>adb reverse tcp:8080 tcp:8080</span>
                  <button 
                    onClick={() => copyToClipboard('adb reverse tcp:8080 tcp:8080')}
                    style={{background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer'}}>
                    {copiedText === 'adb reverse tcp:8080 tcp:8080' ? <Check size={13} style={{color: '#4ec691'}}/> : <Copy size={13}/>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="analysis-inputs" style={{gridTemplateColumns: '1.2fr 1fr'}}>
        {/* Left Panel: Inbound Audio */}
        <div className="dark-card media-card">
          <div className="card-title">
            <div className="icon-shell"><PhoneCallIcon /></div>
            <div>
              <p>01 - SOURCE CALL AUDIO</p>
              <h3>{liveCall ? "Live Mobile Stream (Active)" : "Suspicious Inbound Call Audio"}</h3>
            </div>
          </div>

          <input 
            ref={audioInputRef} 
            type="file" 
            accept="audio/*,video/*,.wav,.mp3,.m4a,.aac,.flac" 
            onChange={onAudioChange} 
            hidden 
          />

          <div style={{background: '#121215', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--line)', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <div>
              <div style={{color: '#888', fontSize: '10px', fontWeight: 'bold', marginBottom: '4px'}}>TELECOM METADATA</div>
              <div style={{display: 'flex', gap: '12px', fontSize: '12px'}}>
                <span style={{color: '#fff'}}>Caller ID: <b style={{color: '#7dbdff'}}>{currentCaller}</b></span>
                <span style={{color: '#fff'}}>Format: <b>16kHz Mono / AMR-WB</b></span>
              </div>
            </div>
            <div style={{
              background: liveCall || isPhoneConnected ? 'rgba(78,198,145,0.15)' : 'rgba(255,255,255,0.05)', 
              color: liveCall || isPhoneConnected ? '#4ec691' : '#888', 
              padding: '4px 8px', 
              borderRadius: '4px', 
              fontSize: '10px', 
              fontWeight: 'bold'
            }}>
              {liveCall ? 'Live Stream Active' : isPhoneConnected ? 'Mobile Connected' : uploadedFileName ? 'Audio Ready' : 'Awaiting Call / File'}
            </div>
          </div>


          {uploadedFileName ? (
             <div className="uploaded-media">
               <div className="video-preview" style={{background: 'linear-gradient(135deg, #123b68, #2a1b38 52%, #0d1420)'}}>
                 <i /><i /><i /><i /><i /><i /><i /><i /><i />
                 <div className="play-dot"><Play size={14} style={{marginLeft: 2}}/></div>
               </div>
               <div style={{flex: 1}}>
                 <b>{uploadedFileName}</b>
                 <span>{uploadedFile ? `${(uploadedFile.size / (1024*1024)).toFixed(2)} MB` : `Audio clip: ${result?.duration || 45}s`}</span>
                 <div style={{display: 'flex', gap: '8px', marginTop: '8px'}}>
                    <button 
                      onClick={() => audioInputRef.current?.click()}
                      style={{background: '#222228', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', border: '1px solid var(--line)', color: '#7dbdff', cursor: 'pointer'}}>
                      Replace Audio
                    </button>
                 </div>
               </div>
             </div>
          ) : (
            <div 
              className="dropzone" 
              onClick={() => audioInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDropAudio}
              style={{cursor: 'pointer'}}
            >
              <div className="upload-round"><Upload size={20} /></div>
              <b>Drop a call recording or audio file here</b>
              <small>Supports MP3, WAV, M4A, AAC, FLAC (Up to 100MB)</small>
              <em>Click to browse files</em>
            </div>
          )}
        </div>

        {/* Right Panel: Reference Identity */}
        <div className="dark-card identity-card">
          <div className="card-title">
            <div className="icon-shell" style={{background: '#302126', color: '#ff7d84'}}><User size={18} /></div>
            <div>
              <p>02 - IDENTITY MATCH TARGET</p>
              <h3>Voice Vault Speaker Baseline</h3>
            </div>
          </div>

          <div style={{display: 'flex', gap: '10px', borderBottom: '1px solid var(--line)', paddingBottom: '12px', marginBottom: '16px'}}>
            <button 
              onClick={() => setTargetMode("contacts")}
              style={{
                color: targetMode === "contacts" ? '#fff' : '#888', 
                fontSize: '12px', background: 'transparent', 
                borderBottom: targetMode === "contacts" ? '2px solid var(--blue-hi)' : 'none', 
                padding: '0 0 4px 0', cursor: 'pointer'
              }}>
              Vault Contacts
            </button>
            <button 
              onClick={() => setTargetMode("custom")}
              style={{
                color: targetMode === "custom" ? '#fff' : '#888', 
                fontSize: '12px', background: 'transparent', 
                borderBottom: targetMode === "custom" ? '2px solid var(--blue-hi)' : 'none', 
                padding: '0 0 4px 0', cursor: 'pointer'
              }}>
              Custom Identity
            </button>
            <button 
              onClick={() => setTargetMode("upload")}
              style={{
                color: targetMode === "upload" ? '#fff' : '#888', 
                fontSize: '12px', background: 'transparent', 
                borderBottom: targetMode === "upload" ? '2px solid var(--blue-hi)' : 'none', 
                padding: '0 0 4px 0', cursor: 'pointer'
              }}>
              Upload Reference
            </button>
          </div>

          {targetMode === "contacts" && (
            <div style={{display: 'grid', gap: '8px'}}>
               {defaultContacts.map(target => (
                 <div 
                   key={target.name} 
                   onClick={() => { setCallTarget(target.name); setCustomTarget(""); }}
                   style={{
                     padding: '10px 14px', 
                     background: callTarget === target.name ? 'rgba(41, 149, 255, 0.12)' : '#121215',
                     border: `1px solid ${callTarget === target.name ? 'var(--blue-hi)' : 'var(--line)'}`,
                     borderRadius: '8px',
                     cursor: 'pointer',
                     display: 'flex',
                     justifyContent: 'space-between',
                     alignItems: 'center'
                   }}
                 >
                   <div>
                     <div style={{fontSize: '13px', color: '#fff', fontWeight: 'bold'}}>{target.name}</div>
                     <div style={{fontSize: '10px', color: '#888', marginTop: '2px'}}>{target.role}</div>
                   </div>
                   <div style={{
                     width: '16px', height: '16px', borderRadius: '50%', 
                     border: `2px solid ${callTarget === target.name ? 'var(--blue-hi)' : '#444'}`,
                     background: callTarget === target.name ? 'var(--blue-hi)' : 'transparent',
                     display: 'grid', placeItems: 'center'
                   }}>
                     {callTarget === target.name && <div style={{width: '6px', height: '6px', background: '#fff', borderRadius: '50%'}} />}
                   </div>
                 </div>
               ))}
            </div>
          )}

          {targetMode === "custom" && (
            <div style={{padding: '8px 0'}}>
              <label style={{fontSize: '11px', color: '#888', fontWeight: 'bold', display: 'block', marginBottom: '6px'}}>
                CLAIMED SPEAKER NAME
              </label>
              <input 
                value={customTarget || callTarget}
                onChange={(e) => {
                  setCustomTarget(e.target.value);
                  setCallTarget(e.target.value);
                }}
                placeholder="e.g. Narendra Modi, CEO John Doe, CFO..."
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: '#121215',
                  border: '1px solid var(--line)',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '13px',
                  outline: 'none',
                  marginBottom: '10px'
                }}
              />
              <p style={{fontSize: '11px', color: '#777', margin: 0}}>
                VocalVerify will match against cached local voice vault embeddings or retrieve official clean speech references.
              </p>
            </div>
          )}

          {targetMode === "upload" && (
            <div style={{padding: '8px 0'}}>
              <input ref={refInputRef} type="file" accept="audio/*,video/*,.wav,.mp3,.m4a" onChange={onRefChange} hidden />
              <div 
                onClick={() => refInputRef.current?.click()}
                style={{
                  background: '#121215',
                  border: '1px dashed var(--line)',
                  borderRadius: '8px',
                  padding: '20px',
                  textAlign: 'center',
                  cursor: 'pointer'
                }}
              >
                <Mic2 size={24} style={{color: '#ff7d84', marginBottom: '8px'}} />
                <div style={{fontSize: '12px', fontWeight: 'bold', color: '#fff'}}>
                  {manualReferenceName || "Upload Clean Baseline Audio"}
                </div>
                <div style={{fontSize: '10px', color: '#888', marginTop: '4px'}}>
                  {manualReferenceName ? "Reference attached" : "WAV, MP3, M4A of enrolled speaker"}
                </div>
              </div>
            </div>
          )}

          <div style={{marginTop: '16px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#aaa', marginBottom: '6px'}}>
              <span>Similarity Match Threshold</span>
              <span style={{color: '#7dbdff', fontWeight: 'bold'}}>{callSimilarityThreshold}%</span>
            </div>
            <input 
              type="range" 
              min="50" max="100" 
              value={callSimilarityThreshold} 
              onChange={(e) => setCallSimilarityThreshold(parseInt(e.target.value))}
              style={{width: '100%', accentColor: 'var(--blue-hi)'}}
            />
          </div>
        </div>
      </div>

      <button 
        className="analyse-button" 
        disabled={!canRun}
        onClick={runRealCallAnalysis}
        style={{
          marginTop: '20px', 
          background: 'linear-gradient(90deg, #5b21b6, #3b82f6)',
          opacity: canRun ? 1 : 0.5,
          cursor: canRun ? 'pointer' : 'not-allowed'
        }}
      >
        <Activity size={16} /> 
        {isAnalyzing ? "Running Multi-Model Call Verification..." : "Run Call Verification & Identity Match"}
      </button>

      {/* Progress Pipeline */}
      {(isAnalyzing || analysisStep > 0) && (
        <div className="dark-card pipeline" style={{marginTop: '20px'}}>
          <div className="pipeline-heading">
            <h3>Telephony Analysis Pipeline</h3>
            <span>{isAnalyzing ? `STAGE ${analysisStep} / 5` : "COMPLETE"}</span>
          </div>
          <div className="pipeline-list">
            <div className={analysisStep >= 1 ? "done" : "running"}>
              {analysisStep >= 1 ? <CheckCircle2 size={14}/> : <Activity size={14} className="spin"/>}
              <span>Normalizing Telephony Codec: AMR-WB / PCM -&gt; 16kHz Mono WAV</span>
            </div>
            <div className={analysisStep >= 2 ? "done" : analysisStep === 1 ? "running" : ""}>
              {analysisStep >= 2 ? <CheckCircle2 size={14}/> : analysisStep === 1 ? <Activity size={14} className="spin"/> : <div style={{width:14,height:14}}/>}
              <span>Extracting 55 Acoustic Features & Running XGBoost Classifier</span>
            </div>
            <div className={analysisStep >= 3 ? "done" : analysisStep === 2 ? "running" : ""}>
              {analysisStep >= 3 ? <CheckCircle2 size={14}/> : analysisStep === 2 ? <Activity size={14} className="spin"/> : <div style={{width:14,height:14}}/>}
              <span>Running Wav2Vec2 + ResNet ONNX Deep Learning Audio Inference</span>
            </div>
            <div className={analysisStep >= 4 ? "done" : analysisStep === 3 ? "running" : ""}>
              {analysisStep >= 4 ? <CheckCircle2 size={14}/> : analysisStep === 3 ? <Activity size={14} className="spin"/> : <div style={{width:14,height:14}}/>}
              <span>Extracting Speaker Embeddings & 3-Sample Centroid Cosine Match</span>
            </div>
            <div className={analysisStep >= 5 ? "done" : analysisStep === 4 ? "running" : ""}>
              {analysisStep >= 5 ? <CheckCircle2 size={14}/> : analysisStep === 4 ? <Activity size={14} className="spin"/> : <div style={{width:14,height:14}}/>}
              <span>Synthesizing Multi-Modal Composite Risk Score & Threat Verdict</span>
            </div>
          </div>
        </div>
      )}

      {/* Real Results Display */}
      {resultData && !isAnalyzing && (
        <div className="result-section">
          <p className="results-label overline">TELECOM VERDICT & RISK BREAKDOWN</p>
          <div className="results-grid">
            
            {/* Anti-spoofing Card */}
            <div className="dark-card result-card">
              <div className="result-top"><span>ANTI-SPOOFING LIVENESS</span><i>PLAD + WAV2VEC</i></div>
              <div className="score-gauge" style={{"--score": ((resultData.finalScore <= 1.0 ? resultData.finalScore * 100 : resultData.finalScore)) + "%"} as any}>
                <b>{((resultData.finalScore <= 1.0 ? resultData.finalScore * 100 : resultData.finalScore)).toFixed(1)}<small>%</small></b>
                <span>SYNTHETIC PROBABILITY</span>
              </div>
              <div className="signal-scores">
                <span>PLAD Liveness <b>{Math.round(((resultData.plad?.livenessScore ?? 0) <= 1.0 ? (resultData.plad?.livenessScore ?? 0) * 100 : resultData.plad?.livenessScore ?? 0))}%</b></span>
                <span>ML XGBoost <b>{Math.round(((resultData.mlScore ?? 0) <= 1.0 ? (resultData.mlScore ?? 0) * 100 : resultData.mlScore ?? 0))}%</b></span>
                <span>DL Wav2Vec <b>{Math.round(((resultData.deepScore ?? 0) <= 1.0 ? (resultData.deepScore ?? 0) * 100 : resultData.deepScore ?? 0))}%</b></span>
              </div>
            </div>

            {/* Speaker Verification Card */}
            <div className="dark-card result-card">
              <div className="result-top"><span>SPEAKER VERIFICATION</span><i>Voice Vault Centroid</i></div>
              <b className={`similarity ${(resultData.speakerMatch?.sameSpeaker || (resultData.speakerMatch?.similarityScore ?? 0) >= callSimilarityThreshold) ? 'good' : 'bad'}`}>
                {(resultData.speakerMatch?.similarityScore ?? 50).toFixed(1)}<small>%</small>
              </b>
              <div className="identity-result">
                <h4>{(resultData.speakerMatch?.sameSpeaker || (resultData.speakerMatch?.similarityScore ?? 0) >= callSimilarityThreshold) ? 'Identity Confirmed' : 'Identity Mismatch'}</h4>
                <p>Target: {callTarget || customTarget || resultData.claimedIdentity || "Enrolled Profile"}</p>
                {resultData.speakerMatch?.referenceScores && resultData.speakerMatch.referenceScores.length > 0 && (
                  <div style={{display: 'flex', gap: '4px', flexWrap: 'wrap', margin: '6px 0'}}>
                    {resultData.speakerMatch.referenceScores.map((sc, i) => (
                      <span key={i} style={{background: '#1a1a20', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', color: '#aaa', border: '1px solid #333'}}>
                        Ref {i+1}: {sc.toFixed(0)}%
                      </span>
                    ))}
                  </div>
                )}
                <code style={{fontSize: '10px'}}>{resultData.speakerMatch?.referenceTitle || "3-sample baseline vector"}</code>
              </div>
            </div>

            {/* Combined Threat Verdict */}
            <div className={`dark-card verdict-card ${
              resultData.riskTier === 'HIGH' ? 'red' : 
              resultData.riskTier === 'MEDIUM' ? 'orange' : 
              resultData.riskTier === 'LOW' ? 'yellow' : 'green'
            }`}>
              <span className="verdict-label">COMBINED THREAT VERDICT</span>
              <h3>
                {resultData.riskTier === 'HIGH' ? 'HIGH THREAT: AI Voice Clone + Impersonation' : 
                 resultData.riskTier === 'MEDIUM' ? 'MEDIUM THREAT: Synthetic Speech / Unenrolled Caller' : 
                 resultData.riskTier === 'LOW' ? 'WARNING: Natural Speech, Speaker Mismatch' : 
                 'SAFE: Verified Genuine Voice & Identity Confirmed'}
              </h3>
              <div>
                <p>THREAT VERDICT ANALYSIS</p>
                <span>{resultData.geminiExplanation || "Acoustic biomarker and voice embedding analysis complete."}</span>
              </div>
              {resultData.riskTier !== 'SAFE' ? (
                <b><ShieldAlert size={12} style={{display:'inline', marginRight: 4}}/> ESCALATE / BLOCK RECOMMENDED</b>
              ) : (
                <b style={{color: '#4ec691'}}><ShieldCheck size={12} style={{display:'inline', marginRight: 4}}/> IDENTITY VERIFIED</b>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ── Live Phone Audio Monitor ─────────────────────────────────────── */}
      {/* Hear the raw audio stream coming from the phone in real-time.       */}
      {/* Completely self-contained, does NOT touch any existing state above. */}
      <LiveAudioMonitor />

    </div>
  );
}

function PhoneCallIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  );
}

export default CallVerifyResult;
