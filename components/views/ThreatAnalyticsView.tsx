"use client";
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, LineChart, Line, CartesianGrid } from 'recharts';

export default function ThreatAnalyticsView() {
  const donutData = [
    { name: 'Voice Cloning', value: 45 },
    { name: 'Impersonation', value: 30 },
    { name: 'Synthetic Speech', value: 25 },
  ];

  const COLORS = ['#ff626d', '#ff9a4d', '#1677e8'];

  const lineData = [
    { time: '00:00', risk: 10 },
    { time: '04:00', risk: 20 },
    { time: '08:00', risk: 60 },
    { time: '12:00', risk: 40 },
    { time: '16:00', risk: 90 },
    { time: '20:00', risk: 50 },
    { time: '24:00', risk: 30 },
  ];

  const barData = [
    { name: 'PLAD Liveness', accuracy: 92 },
    { name: 'XGBoost ML', accuracy: 88 },
    { name: 'Wav2Vec Deep', accuracy: 96 },
    { name: 'ECAPA-TDNN', accuracy: 98 },
  ];

  return (
    <div className="analysis-section" style={{ maxWidth: '100%' }}>
      <section className="workspace-heading">
        <div>
          <p className="overline">ENTERPRISE SECURITY METRICS</p>
          <h2>Threat Analytics</h2>
          <span>Dashboard tracking intercepted attacks and detection model accuracy over time.</span>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
        <div className="dark-card" style={{ padding: '20px' }}>
          <p style={{ margin: '0 0 8px', fontSize: '10px', color: '#888', fontWeight: 'bold' }}>TOTAL AUDIO ANALYZED</p>
          <h3 style={{ margin: 0, fontSize: '28px' }}>24,892</h3>
        </div>
        <div className="dark-card" style={{ padding: '20px' }}>
          <p style={{ margin: '0 0 8px', fontSize: '10px', color: '#ff626d', fontWeight: 'bold' }}>DEEPFAKES INTERCEPTED</p>
          <h3 style={{ margin: 0, fontSize: '28px', color: '#ffb0b5' }}>1,402</h3>
        </div>
        <div className="dark-card" style={{ padding: '20px' }}>
          <p style={{ margin: '0 0 8px', fontSize: '10px', color: '#4ec691', fontWeight: 'bold' }}>AVERAGE LATENCY</p>
          <h3 style={{ margin: 0, fontSize: '28px' }}>14ms</h3>
        </div>
        <div className="dark-card" style={{ padding: '20px' }}>
          <p style={{ margin: '0 0 8px', fontSize: '10px', color: '#ff9a4d', fontWeight: 'bold' }}>TARGET IMPERSONATION RATE</p>
          <h3 style={{ margin: 0, fontSize: '28px' }}>5.6%</h3>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '16px', marginBottom: '20px' }}>
        <div className="dark-card" style={{ padding: '20px', minHeight: '300px' }}>
          <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#fff', fontWeight: 'bold' }}>Attack Types Distribution</p>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={donutData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                {donutData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip contentStyle={{ background: '#121215', border: '1px solid #333', borderRadius: '8px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="dark-card" style={{ padding: '20px', minHeight: '300px' }}>
          <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#fff', fontWeight: 'bold' }}>Risk Trend Over Time (24h)</p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
              <XAxis dataKey="time" stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
              <RechartsTooltip contentStyle={{ background: '#121215', border: '1px solid #333', borderRadius: '8px' }} />
              <Line type="monotone" dataKey="risk" stroke="#1677e8" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="dark-card" style={{ padding: '20px' }}>
        <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#fff', fontWeight: 'bold' }}>Detection Model Accuracy Breakdown</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis dataKey="name" type="category" stroke="#aaa" fontSize={11} tickLine={false} axisLine={false} width={100} />
            <RechartsTooltip contentStyle={{ background: '#121215', border: '1px solid #333', borderRadius: '8px' }} />
            <Bar dataKey="accuracy" fill="#4ec691" radius={[0, 4, 4, 0]} barSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
