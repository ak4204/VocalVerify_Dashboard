import { useState } from "react";
import { ModalShell } from "./ModalShell";

export function DocumentationModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState(0);
  
  return (
    <ModalShell title="Documentation" onClose={onClose}>
      <div className="modal-tabs">
        <button className={tab === 0 ? "active" : ""} onClick={() => setTab(0)}>Architecture</button>
        <button className={tab === 1 ? "active" : ""} onClick={() => setTab(1)}>API Endpoints</button>
        <button className={tab === 2 ? "active" : ""} onClick={() => setTab(2)}>Score Interpretation</button>
        <button className={tab === 3 ? "active" : ""} onClick={() => setTab(3)}>Integration</button>
      </div>
      
      <div className="modal-body" style={{paddingTop: 0}}>
        {tab === 0 && (
          <div>
            <h3>4-Stage Pipeline Architecture</h3>
            <ul>
              <li><strong>Stage 1 (PLAD):</strong> Physical Liveness & Acoustic Dynamics. Extracts pitch jitter, amplitude shimmer, breath energy, and spectral flux.</li>
              <li><strong>Stage 2 (XGBoost):</strong> Feature ML based on MFCC-6, CQT Overtones, and Zero Crossing Rate.</li>
              <li><strong>Stage 3 (Deep Learning):</strong> Meta FAIR <code>wav2vec 2.0</code> / AASIST for vocoder artifact confidence scoring.</li>
              <li><strong>Stage 4 (ECAPA-TDNN):</strong> Extracts 192-dimensional speaker embeddings for verification.</li>
            </ul>
          </div>
        )}
        
        {tab === 1 && (
          <div>
            <h3>REST API Specification</h3>
            <ul>
              <li><code>POST /v1/analyze/quick</code> - Base endpoint for quick mode.</li>
              <li><code>POST /v1/analyze/public-figure</code> - Cross references YouTube data.</li>
              <li><code>POST /v1/verify/speaker</code> - Extracts and compares ECAPA-TDNN embeddings.</li>
            </ul>
          </div>
        )}
        
        {tab === 2 && (
          <div>
            <h3>Score Interpretation</h3>
            <p>Confidence metrics are returned on a 0.0 to 1.0 scale.</p>
            <ul>
              <li><strong>Safe (0.0 - 0.2):</strong> Genuine human voice.</li>
              <li><strong>Low Risk (0.2 - 0.5):</strong> Potential low-level artifacts, but likely authentic.</li>
              <li><strong>Medium Risk (0.5 - 0.8):</strong> Uncertain. May be a highly compressed network signal or early-gen TTS.</li>
              <li><strong>High Risk (0.8 - 1.0):</strong> Strong vocoder phase artifacts detected. High probability of AI synthesis.</li>
            </ul>
          </div>
        )}
        
        {tab === 3 && (
          <div>
            <h3>Integration Snippets</h3>
            <p><strong>Python (requests)</strong></p>
            <pre style={{background: '#000', padding: '12px', borderRadius: '8px', overflowX: 'auto'}}>
              <code>{`import requests\n\nurl = "https://api.vocalverify.com/v1/analyze/quick"\nfiles = {'audio': open('suspicious.wav', 'rb')}\nheaders = {'Authorization': 'Bearer YOUR_API_KEY'}\n\nresponse = requests.post(url, files=files, headers=headers)\nprint(response.json())`}</code>
            </pre>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
