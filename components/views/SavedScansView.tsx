export function SavedScansView() {
  const scans = [
    { id: 'SC-1029', file: 'unknown-speaker.mp4', mode: 'Public Figure', duration: '42s', verdict: 'FAKE', risk: 'HIGH', date: 'Just now' },
    { id: 'SC-1028', file: 'morning-call.wav', mode: 'Call Verify', duration: '1m 12s', verdict: 'REAL', risk: 'SAFE', date: '2 hrs ago' },
    { id: 'SC-1027', file: 'voice-note-12.mp3', mode: 'Quick Check', duration: '18s', verdict: 'UNCERTAIN', risk: 'MEDIUM', date: 'Yesterday' }
  ];

  return (
    <div className="analysis-section" style={{maxWidth: '100%'}}>
      <section className="workspace-heading">
        <div>
          <p className="overline">AUDIT LOG</p>
          <h2>Saved Scans</h2>
          <span>History of all media analyzed across your workspace.</span>
        </div>
      </section>

      <div className="dark-card" style={{padding: '24px'}}>
        <table style={{width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '13px', color: '#c8c8cf'}}>
          <thead>
            <tr style={{borderBottom: '1px solid var(--line)', color: '#888'}}>
              <th style={{padding: '12px 8px', fontWeight: 600}}>ID</th>
              <th style={{padding: '12px 8px', fontWeight: 600}}>File Name</th>
              <th style={{padding: '12px 8px', fontWeight: 600}}>Mode</th>
              <th style={{padding: '12px 8px', fontWeight: 600}}>Duration</th>
              <th style={{padding: '12px 8px', fontWeight: 600}}>Verdict</th>
              <th style={{padding: '12px 8px', fontWeight: 600}}>Action</th>
            </tr>
          </thead>
          <tbody>
            {scans.map(s => (
              <tr key={s.id} style={{borderBottom: '1px solid rgba(255,255,255,0.03)'}}>
                <td style={{padding: '16px 8px', fontFamily: 'monospace', color: '#7dbdff'}}>{s.id}</td>
                <td style={{padding: '16px 8px', color: '#fff'}}>{s.file}</td>
                <td style={{padding: '16px 8px'}}>{s.mode}</td>
                <td style={{padding: '16px 8px'}}>{s.duration}</td>
                <td style={{padding: '16px 8px'}}>
                  <span style={{
                    padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold',
                    background: s.verdict === 'FAKE' ? 'rgba(255,98,109,0.1)' : s.verdict === 'REAL' ? 'rgba(78,198,145,0.1)' : 'rgba(255,194,145,0.1)',
                    color: s.verdict === 'FAKE' ? '#ff626d' : s.verdict === 'REAL' ? '#4ec691' : '#ffc291'
                  }}>
                    {s.verdict}
                  </span>
                </td>
                <td style={{padding: '16px 8px'}}>
                  <button style={{background: '#222228', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', border: '1px solid var(--line)'}}>View Report</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
