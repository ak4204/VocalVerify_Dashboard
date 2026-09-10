import { ModalShell } from "./ModalShell";

export function SolutionsModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell title="Enterprise Solutions" onClose={onClose}>
      <div className="modal-body">
        <h3>Banking & Voice Biometrics Security</h3>
        <p>Real-time screening of inbound call center audio against AI voice clone databases to prevent authorized push payment (APP) fraud.</p>
        
        <h3 style={{marginTop: '24px'}}>Executive Impersonation Defense</h3>
        <p>Instant verification of urgent voice notes/WhatsApp audio claiming to be CEOs or CFOs requesting financial transfers.</p>
        
        <h3 style={{marginTop: '24px'}}>Media & Investigative Journalism</h3>
        <p>Fact-checking public figure speeches and political clips against synthetic audio model fingerprints.</p>

        <h3 style={{marginTop: '24px'}}>Public Figure Defense (Mode 03)</h3>
        <p>Automated cross-verification of suspicious video clips against verified YouTube speech databases.</p>
      </div>
    </ModalShell>
  );
}
