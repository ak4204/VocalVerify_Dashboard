import { ModalShell } from "./ModalShell";
import { Download } from "lucide-react";

export function ResearchPapersModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell title="Academic Foundations & Research" onClose={onClose}>
      <div className="modal-body" style={{paddingTop: 10}}>
        <div style={{marginBottom: '28px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
            <h3 style={{maxWidth: '85%'}}>wav2vec 2.0 for Audio Deepfake and Synthetic Speech Detection</h3>
            <button style={{display: 'flex', alignItems: 'center', gap: '6px', background: '#202025', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', border: '1px solid var(--line)'}}>
              <Download size={12}/> PDF
            </button>
          </div>
          <p style={{fontSize: '11px', color: '#888', margin: '4px 0 10px'}}>Authors: Meta AI Research / ASVspoof Consortium</p>
          <p>Demonstrates how self-supervised speech representations extracted from raw audio waveforms capture micro-temporal phase anomalies and vocoder quantization errors impossible to see in 2D spectrograms.</p>
        </div>

        <div style={{marginBottom: '28px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
            <h3 style={{maxWidth: '85%'}}>PLAD: Physical Liveness & Acoustic Dynamics in Synthetic Voice Analysis</h3>
            <button style={{display: 'flex', alignItems: 'center', gap: '6px', background: '#202025', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', border: '1px solid var(--line)'}}>
              <Download size={12}/> PDF
            </button>
          </div>
          <p>Evaluates organic speech liveness using pitch jitter, amplitude shimmer, spectral flux, and human breath energy distribution.</p>
        </div>

        <div>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
            <h3 style={{maxWidth: '85%'}}>ECAPA-TDNN: Emphasized Channel Attention, Propagation and Aggregation</h3>
            <button style={{display: 'flex', alignItems: 'center', gap: '6px', background: '#202025', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', border: '1px solid var(--line)'}}>
              <Download size={12}/> PDF
            </button>
          </div>
          <p>Explains the 192-dimensional speaker embedding extraction method used for cross-verifying suspect audio against reference voice samples.</p>
        </div>
      </div>
    </ModalShell>
  );
}
