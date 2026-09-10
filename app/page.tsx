"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Sidebar } from "../components/Sidebar";
import { FakeVideoAnalysis } from "../components/analysis/FakeVideoAnalysis";
import { CallVerifyResult } from "../components/analysis/CallVerifyResult";
import { useVocalVerify } from "../hooks/useVocalVerify";

// Modals
import { SolutionsModal } from "../components/modals/SolutionsModal";
import { DocumentationModal } from "../components/modals/DocumentationModal";
import { ResearchPapersModal } from "../components/modals/ResearchPapersModal";
import { ApiDocsModal } from "../components/modals/ApiDocsModal";

// Views
import { HomeView } from "../components/views/HomeView";
import { SavedScansView } from "../components/views/SavedScansView";
import ThreatAnalyticsView from "../components/views/ThreatAnalyticsView";
import { TelemetryView } from "../components/views/TelemetryView";

export default function Home() {
  const [navOpen, setNavOpen] = useState(false);
  const vocalVerify = useVocalVerify();

  const renderView = () => {
    switch (vocalVerify.activeView) {
      case "home": return <HomeView {...vocalVerify} />;
      case "call_verify": return <CallVerifyResult {...vocalVerify} />;
      case "fake_video": return <FakeVideoAnalysis {...vocalVerify} />;
      case "saved_scans": return <SavedScansView />;
      case "threat_analytics": return <ThreatAnalyticsView />;
      case "telemetry": return <TelemetryView />;
      default: return <HomeView {...vocalVerify} />;
    }
  };

  return <main className="app-frame">
    {vocalVerify.activeModal === 'solutions' && <SolutionsModal onClose={() => vocalVerify.setActiveModal(null)} />}
    {vocalVerify.activeModal === 'documentation' && <DocumentationModal onClose={() => vocalVerify.setActiveModal(null)} />}
    {vocalVerify.activeModal === 'research' && <ResearchPapersModal onClose={() => vocalVerify.setActiveModal(null)} />}
    {vocalVerify.activeModal === 'api_docs' && <ApiDocsModal onClose={() => vocalVerify.setActiveModal(null)} />}

    <Sidebar 
      open={navOpen} 
      onToggle={() => setNavOpen(!navOpen)} 
      activeView={vocalVerify.activeView}
      setActiveView={vocalVerify.setActiveView}
    />
    <section className="main-scroll">
      <header className="app-header">
        <div className="mobile-brand"><ShieldCheck size={17} /> vocalverify</div>
        <div className="header-links">
          <a onClick={() => vocalVerify.setActiveModal('solutions')} style={{cursor: 'pointer'}}>Solutions</a>
          <a onClick={() => vocalVerify.setActiveModal('documentation')} style={{cursor: 'pointer'}}>Documentation</a>
          <a onClick={() => vocalVerify.setActiveModal('research')} style={{cursor: 'pointer'}}>Research papers</a>
          <a onClick={() => vocalVerify.setActiveModal('api_docs')} style={{cursor: 'pointer'}}>API docs</a>
        </div>
        <div className="header-status"><span /> System operational <button>AK</button></div>
      </header>
      <div className="workspace-content">
        {renderView()}
      </div>
    </section>
  </main>;
}
