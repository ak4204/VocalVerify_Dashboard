"use client";

import { Activity, ChevronDown, Folder, Home, Menu, Phone, Search, ShieldCheck, TerminalSquare, Video } from "lucide-react";

type ViewType = "home" | "call_verify" | "fake_video" | "saved_scans" | "threat_analytics" | "telemetry";

type SidebarProps = { 
  open: boolean; 
  onToggle: () => void;
  activeView: ViewType;
  setActiveView: (view: ViewType) => void;
};

const nav: { id: ViewType, icon: any, label: string }[] = [
  { id: "home", icon: Home, label: "Home" },
  { id: "saved_scans", icon: Folder, label: "Saved scans" },
  { id: "fake_video", icon: Video, label: "Fake Video Analysis" },
  { id: "threat_analytics", icon: Activity, label: "Threat analytics" },
  { id: "call_verify", icon: Phone, label: "Call Verify" },
  { id: "telemetry", icon: TerminalSquare, label: "Telemetry" }
];

export function Sidebar({ open, onToggle, activeView, setActiveView }: SidebarProps) {
  return <>
    <button className="mobile-nav-toggle" onClick={onToggle} aria-label="Toggle navigation"><Menu size={20} /></button>
    <aside className={`sidebar ${open ? "is-open" : ""}`}>
      <div className="workspace-mark"><span><ShieldCheck size={18} /></span><b>vocalverify</b></div>
      <button className="workspace-switcher"><i>V</i><span><b>Team Incursio</b><small>Admin · SIH 2026</small></span><ChevronDown size={15} /></button>
      <button className="sidebar-search"><Search size={16} /><span>Search</span><kbd>Ctrl K</kbd></button>
      <nav className="side-nav">
        {nav.map(({ id, icon: Icon, label }) => (
          <button 
            key={id} 
            className={activeView === id ? "active" : ""}
            onClick={() => setActiveView(id)}
          >
            <Icon size={18} />
            <span>{label}</span>
            {id === "fake_video" && <em>New</em>}
          </button>
        ))}
      </nav>
      <div className="side-divider" />
      <div className="recent-files">
        <p>RECENTLY VIEWED</p>
        <div><span className="status red" /><b>unknown-speaker.mp3</b></div>
        <div><span className="status" /><b>morning-call.wav</b></div>
        <div><span className="status" style={{background: '#888', boxShadow: 'none'}} /><b>voice-note-12.mp3</b></div>
      </div>
      <div className="usage"><p>ENGINE STATUS</p><b>PS-26104 <span>· Active</span></b><div><i /></div><small><span /> System online</small></div>
    </aside>
  </>;
}
