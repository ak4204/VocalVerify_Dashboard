import { ModalShell } from "./ModalShell";

export function ApiDocsModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell title="VocalVerify OpenAPI Spec" onClose={onClose}>
      <div className="modal-body" style={{paddingTop: 10}}>
        <div style={{background: '#121215', padding: '16px', borderRadius: '8px', border: '1px solid var(--line)', marginBottom: '20px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px'}}>
            <span style={{background: '#16406f', color: '#9bd1ff', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold'}}>POST</span>
            <span style={{fontFamily: 'monospace', fontSize: '14px', color: '#fff'}}>/v1/analyze/quick</span>
          </div>
          <p style={{fontSize: '12px', marginBottom: '16px'}}>Synchronously analyzes an audio file for synthetic vocoder artifacts.</p>
          
          <h4 style={{fontSize: '11px', color: '#888', letterSpacing: '1px', margin: '0 0 8px'}}>REQUEST PAYLOAD (multipart/form-data)</h4>
          <pre style={{margin: 0, background: '#000', padding: '12px', borderRadius: '6px', overflowX: 'auto', fontSize: '11px'}}>
            <code>{`file: <binary audio file>
mode: "quick" | "deep"`}</code>
          </pre>

          <h4 style={{fontSize: '11px', color: '#888', letterSpacing: '1px', margin: '16px 0 8px'}}>RESPONSE SCHEMA (JSON)</h4>
          <pre style={{margin: 0, background: '#000', padding: '12px', borderRadius: '6px', overflowX: 'auto', fontSize: '11px'}}>
            <code>{`{
  "scan_id": "string",
  "status": "success",
  "anti_spoofing": {
    "plad_score": "float",
    "ml_feature_score": "float",
    "wav2vec_deep_score": "float",
    "final_risk_score": "float (0.0 to 1.0)"
  },
  "verdict": "SAFE | LOW_RISK | MEDIUM_RISK | HIGH_RISK"
}`}</code>
          </pre>
        </div>
      </div>
    </ModalShell>
  );
}
