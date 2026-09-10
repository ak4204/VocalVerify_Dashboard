import { Cpu, Database, Activity, Server } from "lucide-react";

export function TelemetryView() {
  return (
    <div className="analysis-section" style={{maxWidth: '100%'}}>
      <section className="workspace-heading">
        <div>
          <p className="overline">ENGINE HEALTH</p>
          <h2>Telemetry</h2>
          <span>Real-time monitoring of inference nodes, GPU loads, and API usage quotas.</span>
        </div>
      </section>

      <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px'}}>
        <div className="dark-card" style={{padding: '20px', display: 'flex', alignItems: 'center', gap: '16px'}}>
          <div style={{width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(41, 149, 255, 0.1)', color: '#2995ff', display: 'grid', placeItems: 'center'}}>
            <Cpu size={22} />
          </div>
          <div>
            <p style={{margin: '0 0 4px', fontSize: '10px', color: '#888', fontWeight: 'bold'}}>GPU INFERENCE LOAD</p>
            <h3 style={{margin: 0, fontSize: '20px'}}>74.2%</h3>
          </div>
        </div>
        
        <div className="dark-card" style={{padding: '20px', display: 'flex', alignItems: 'center', gap: '16px'}}>
          <div style={{width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(255, 154, 77, 0.1)', color: '#ff9a4d', display: 'grid', placeItems: 'center'}}>
            <Database size={22} />
          </div>
          <div>
            <p style={{margin: '0 0 4px', fontSize: '10px', color: '#888', fontWeight: 'bold'}}>VRAM USAGE</p>
            <h3 style={{margin: 0, fontSize: '20px'}}>18.4 GB</h3>
          </div>
        </div>

        <div className="dark-card" style={{padding: '20px', display: 'flex', alignItems: 'center', gap: '16px'}}>
          <div style={{width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(78, 198, 145, 0.1)', color: '#4ec691', display: 'grid', placeItems: 'center'}}>
            <Activity size={22} />
          </div>
          <div>
            <p style={{margin: '0 0 4px', fontSize: '10px', color: '#888', fontWeight: 'bold'}}>ONNX EXEC LATENCY</p>
            <h3 style={{margin: 0, fontSize: '20px'}}>14ms</h3>
          </div>
        </div>

        <div className="dark-card" style={{padding: '20px', display: 'flex', alignItems: 'center', gap: '16px'}}>
          <div style={{width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(220, 107, 218, 0.1)', color: '#dc6bda', display: 'grid', placeItems: 'center'}}>
            <Server size={22} />
          </div>
          <div style={{flex: 1}}>
            <p style={{margin: '0 0 4px', fontSize: '10px', color: '#888', fontWeight: 'bold'}}>API QUOTA</p>
            <h3 style={{margin: '0 0 6px', fontSize: '14px'}}>1,240 / 5,000</h3>
            <div style={{width: '100%', height: '4px', background: '#333', borderRadius: '4px', overflow: 'hidden'}}>
              <div style={{width: '25%', height: '100%', background: '#dc6bda'}} />
            </div>
          </div>
        </div>
      </div>

      <div className="dark-card" style={{padding: '20px'}}>
        <p style={{margin: '0 0 16px', fontSize: '12px', color: '#fff', fontWeight: 'bold'}}>Active Model Status</p>
        <div style={{display: 'grid', gap: '1px', background: 'var(--line)', border: '1px solid var(--line)', borderRadius: '8px', overflow: 'hidden'}}>
          {[
            { name: 'PLAD Signal Processor', version: 'v1.4.0', status: 'Active' },
            { name: 'XGBoost Feature Engine', version: 'v2.1.2', status: 'Active' },
            { name: 'Meta wav2vec 2.0 (ONNX)', version: 'v3.0.0', status: 'Active' },
            { name: 'ECAPA-TDNN Speaker Verification', version: 'v1.8.5', status: 'Active' },
          ].map(model => (
            <div key={model.name} style={{background: '#121215', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <div>
                <h4 style={{margin: '0 0 4px', fontSize: '13px', color: '#fff'}}>{model.name}</h4>
                <p style={{margin: 0, fontSize: '11px', color: '#888', fontFamily: 'monospace'}}>{model.version}</p>
              </div>
              <span style={{background: 'rgba(78, 198, 145, 0.1)', color: '#4ec691', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold'}}>
                {model.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
