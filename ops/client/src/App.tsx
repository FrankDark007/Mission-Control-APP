
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { GoogleGenAI, Modality, Type } from "@google/genai";
import {
    Shield, Zap, LayoutDashboard, MessageSquare, Settings,
    Swords, Loader2, BrainCircuit, Gavel, RefreshCw,
    TrendingUp, Globe, Sparkles, Radio, ShieldAlert, Kanban, BarChart3,
    GitBranch, BookOpen, HeartPulse, Bot, Workflow, Mic, Hammer, ChevronDown, Cpu, ListTree, Box, Layers, Cloud
} from 'lucide-react';
import {
    AgentConfig, QueueResponse, HealingProposal, AutoPilotConfig, AiModelId
} from './types';

import RecoveryModule from './components/RecoveryModule';
import SeoLab from './components/SeoLab';
import GitPulse from './components/GitPulse';
import IntelligenceLab from './components/IntelligenceLab';
import ModelsLab from './components/ModelsLab';
import ChatLab from './components/ChatLab';
import CreativeStudio from './components/CreativeStudio';
import BriefingLab from './components/BriefingLab';
import SwarmTopology from './components/SwarmTopology';
import SecurityLab from './components/SecurityLab';
import ConsensusLab from './components/ConsensusLab';
import SwarmBoard from './components/SwarmBoard';
import QACriticLab from './components/QACriticLab';
import AnalyticsLab from './components/AnalyticsLab';
import SandboxLab from './components/SandboxLab';
import PromptLab from './components/PromptLab';
import LiveLab from './components/LiveLab';
import BuilderLab from './components/BuilderLab';
import ProtocolLab from './components/ProtocolLab';
import LocalAiLab from './components/LocalAiLab';
import EdgeLab from './components/EdgeLab';

import { telemetry } from './services/telemetry';
import { localStore } from './services/storage';
import { wasmTools } from './services/wasmTools';

// Add type definition for custom elements to fix JSX intrinsic elements error
declare global {
  namespace React {
    namespace JSX {
      interface IntrinsicElements {
        'status-badge': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & { status?: string }, HTMLElement>;
      }
    }
  }
}

// Define Custom Element for Status Badge
if (!customElements.get('status-badge')) {
  class StatusBadge extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }
    connectedCallback() {
      const status = this.getAttribute('status') || 'idle';
      const color = status === 'active' ? '#34a853' : status === 'error' ? '#ea4335' : '#1a73e8';
      this.shadowRoot!.innerHTML = `
        <style>
          .badge {
            padding: 4px 12px;
            border-radius: 999px;
            font-size: 10px;
            font-weight: 900;
            text-transform: uppercase;
            background: ${color}20;
            color: ${color};
            border: 1px solid ${color}40;
            display: inline-flex;
            align-items: center;
            gap: 6px;
          }
          .dot { width: 6px; height: 6px; background: ${color}; border-radius: 50%; }
        </style>
        <div class="badge"><div class="dot"></div> ${status}</div>
      `;
    }
  }
  customElements.define('status-badge', StatusBadge);
}

const HealthGauge = ({ score }: { score: number }) => {
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;

    return (
        <div className="relative w-24 h-24 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90">
                <circle cx="48" cy="48" r={radius} fill="transparent" stroke="#1f2937" strokeWidth="8" />
                <circle 
                    cx="48" cy="48" r={radius} 
                    fill="transparent" 
                    stroke={score > 80 ? "#34a853" : score > 50 ? "#fbbc04" : "#ea4335"} 
                    strokeWidth="8" 
                    strokeDasharray={circumference} 
                    strokeDashoffset={offset} 
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-black text-white">{score}%</span>
                <span className="text-[7px] font-black uppercase text-gray-500">Cohesion</span>
            </div>
        </div>
    );
};

const App = () => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'analytics' | 'swarm' | 'builder' | 'live' | 'chat' | 'sandbox' | 'strategy' | 'protocols' | 'consensus' | 'briefing' | 'creative' | 'security' | 'intelligence' | 'qa' | 'git' | 'seo' | 'localai' | 'edge' | 'models'>('dashboard');
    const [agentRegistry, setAgentRegistry] = useState<Record<string, AgentConfig>>({});
    const [agentStatus, setAgentStatus] = useState<Record<string, string>>({});
    const [modelRegistry, setModelRegistry] = useState<any[]>([]);
    const [autopilotConfig, setAutopilotConfig] = useState<AutoPilotConfig>({ enabled: false, standardsMode: true, model: 'gemini-3-pro' as AiModelId });
    const [toasts, setToasts] = useState<{id: number, message: string, type: 'info' | 'success' | 'error'}[]>([]);
    
    const [opsTelemetry, setOpsTelemetry] = useState({ timeToVerdict: 0, errorCount: 0, totalProcessed: 0 });
    const [activeDeviation, setActiveDeviation] = useState<HealingProposal | null>(null);
    const [queueStatus, setQueueStatus] = useState<QueueResponse>({ processing: false, activeTasks: [], queue: [], history: [] });

    const swarmHealth = useMemo(() => {
        if (!queueStatus.history.length) return 100;
        const total = queueStatus.history.length;
        const failed = queueStatus.history.filter(t => t.status === 'failed').length;
        return Math.max(0, Math.round(((total - failed) / total) * 100));
    }, [queueStatus.history]);

    const addToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    };

    const toggleAutopilot = async () => {
        try {
            const res = await fetch('/api/autopilot/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: !autopilotConfig.enabled })
            });
            if (res.ok) {
                const updated = await res.json();
                setAutopilotConfig(updated);
                addToast(`Autopilot ${updated.enabled ? 'Enabled' : 'Disabled'}`, updated.enabled ? 'success' : 'info');
            }
        } catch (e) {
            addToast("Failed to toggle autopilot", "error");
        }
    };

    const addTask = async (task: any) => {
        try {
            const res = await fetch('/api/swarm/mission', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(task)
            });
            if (res.ok) {
                addToast("Mission Queued", "success");
            }
        } catch (e) {
            addToast("Failed to queue mission", "error");
        }
    };

    const sproutAgent = async (data: any) => {
        try {
            const res = await fetch('/api/swarm/sprout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (res.ok) {
                addToast("Sub-agent sprouted", "success");
            }
        } catch (e) {
            addToast("Failed to sprout agent", "error");
        }
    };

    const handleApplyFix = async (command: string) => {
        if (!activeDeviation) return;
        telemetry.startMeasure('neural-fix-apply');
        try {
            const res = await fetch('/api/heal/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agentId: activeDeviation.agentId, command })
            });
            if (res.ok) {
                addToast("Neural Alignment Verified", "success");
                setActiveDeviation(null);
            }
        } finally {
            telemetry.stopMeasure('neural-fix-apply');
        }
    };

    useEffect(() => {
        localStore.init();
        wasmTools.init();
        
        // Feature 11: Real-time Performance-to-Healing Bridge
        telemetry.onDrift((drift) => {
            if (autopilotConfig.enabled) {
                setActiveDeviation({
                    agentId: 'UI_RENDERER',
                    diagnosis: drift.details,
                    fixCommand: "npm run optimize:ux",
                    explanation: `${drift.type} detected via PerformanceObserver. Swarm intervention recommended.`,
                    timestamp: drift.timestamp,
                    failure: true
                });
                addToast(`Performance Drift: ${drift.type}`, 'error');
            }
        });

        fetch('/api/models').then(r => r.json()).then(setModelRegistry);
        fetch('/api/autopilot').then(r => r.json()).then(setAutopilotConfig);

        const logWorker = new Worker(new URL('./workers/logParser.worker.ts', import.meta.url));
        logWorker.onmessage = (e) => {
            if (e.data.type === 'logs_processed') {
                setOpsTelemetry(e.data.metrics);
            }
        };

        const s = io(window.location.origin, { path: '/socket.io' });
        setSocket(s);
        s.on('agent-registry', (data) => setAgentRegistry(data));
        s.on('status', (data) => setAgentStatus(data));
        s.on('queue-status', (data) => setQueueStatus(data));
        s.on('autopilot-state', (data) => setAutopilotConfig(data));
        s.on('agent-deviation', (d) => { setActiveDeviation(d); addToast("Neural Healing Required", "error"); });
        
        s.on('log', (msg) => {
          logWorker.postMessage({ type: 'process_logs', logs: [msg] });
        });

        return () => { 
          s.disconnect(); 
          logWorker.terminate(); 
        };
    }, [autopilotConfig.enabled]);

    return (
        <div className="min-h-screen bg-dark-900 text-gray-200 font-sans flex overflow-hidden">
            <div className="w-64 bg-dark-800 border-r border-dark-700 flex flex-col shadow-2xl z-20">
                <div className="p-8 border-b border-dark-700 text-center">
                    <h1 className="text-2xl font-black text-white flex items-center justify-center gap-3">
                        <Shield className="text-google-blue" size={28} /> Swarm<span className="text-google-blue">Ops</span>
                    </h1>
                </div>
                <nav className="flex-1 p-5 space-y-1 overflow-y-auto scrollbar-hide">
                    {[
                        { id: 'dashboard', icon: LayoutDashboard },
                        { id: 'analytics', icon: BarChart3 },
                        { id: 'swarm', icon: Kanban },
                        { id: 'builder', icon: Hammer },
                        { id: 'live', icon: Mic },
                        { id: 'chat', icon: MessageSquare },
                        { id: 'sandbox', icon: BrainCircuit },
                        { id: 'localai', icon: Cpu },
                        { id: 'edge', icon: Cloud },
                        { id: 'strategy', icon: BookOpen },
                        { id: 'protocols', icon: ListTree },
                        { id: 'consensus', icon: Swords },
                        { id: 'briefing', icon: Radio },
                        { id: 'creative', icon: Sparkles },
                        { id: 'security', icon: ShieldAlert },
                        { id: 'qa', icon: Gavel },
                        { id: 'git', icon: GitBranch },
                        { id: 'seo', icon: Globe },
                        { id: 'models', icon: Settings }
                    ].map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all ${activeTab === tab.id ? 'bg-google-blue text-white shadow-lg' : 'hover:bg-dark-700 text-gray-400'}`}>
                            <tab.icon size={18} />
                            <span className="capitalize text-xs font-semibold">{tab.id}</span>
                        </button>
                    ))}
                </nav>
            </div>

            <div className="flex-1 overflow-y-auto bg-dark-900 p-10 relative">
                <div className="max-w-7xl mx-auto h-full">
                    {activeTab === 'dashboard' && (
                        <div className="space-y-10">
                            <div className="flex justify-between items-start reveal-on-scroll">
                                <div className="flex gap-8">
                                    <HealthGauge score={swarmHealth} />
                                    <div>
                                        <h2 className="text-4xl font-black text-white tracking-tighter">Mission Control</h2>
                                        <div className="flex gap-4 mt-2">
                                            <status-badge status={swarmHealth > 80 ? 'active' : 'idle'}></status-badge>
                                            <div className="flex items-center gap-2 text-[10px] font-black uppercase text-gray-500"><HeartPulse size={12} className="text-google-red" /> Errors: {opsTelemetry.errorCount}</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button 
                                        onClick={toggleAutopilot}
                                        className={`mt-4 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 shadow-xl ${autopilotConfig.enabled ? 'bg-google-green text-dark-900 animate-pulse' : 'bg-dark-800 text-gray-500'}`}
                                    >
                                        <Cpu size={16} />
                                        {autopilotConfig.enabled ? 'Autopilot: Active' : 'Autopilot: Offline'}
                                    </button>
                                </div>
                            </div>
                            <div className="reveal-on-scroll">
                              <SwarmTopology agents={agentRegistry} status={agentStatus} subAgents={queueStatus.activeTasks} />
                            </div>
                        </div>
                    )}
                    {activeTab === 'analytics' && <AnalyticsLab />}
                    {activeTab === 'swarm' && <SwarmBoard queue={queueStatus} onAddTask={addTask} onSproutAgent={sproutAgent} />}
                    {activeTab === 'builder' && <BuilderLab />}
                    {activeTab === 'live' && <LiveLab />}
                    {activeTab === 'chat' && <ChatLab />}
                    {activeTab === 'sandbox' && <SandboxLab />}
                    {activeTab === 'localai' && <LocalAiLab />}
                    {activeTab === 'edge' && <EdgeLab />}
                    {activeTab === 'strategy' && <PromptLab />}
                    {activeTab === 'protocols' && <ProtocolLab />}
                    {activeTab === 'consensus' && <ConsensusLab />}
                    {activeTab === 'briefing' && <BriefingLab />}
                    {activeTab === 'creative' && <CreativeStudio />}
                    {activeTab === 'security' && <SecurityLab />}
                    {activeTab === 'qa' && <QACriticLab />}
                    {activeTab === 'seo' && <SeoLab />}
                    {activeTab === 'git' && <GitPulse />}
                    {activeTab === 'models' && <ModelsLab />}
                </div>

                {activeDeviation && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-10">
                        <RecoveryModule 
                            proposal={activeDeviation} 
                            onClose={() => setActiveDeviation(null)} 
                            onApply={handleApplyFix}
                        />
                    </div>
                )}
            </div>

            <div className="fixed bottom-10 right-10 flex flex-col gap-3 pointer-events-none z-50">
                {toasts.map(t => (
                    <div key={t.id} className={`pointer-events-auto px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-4 animate-in slide-in-from-right-4 duration-300 ${
                        t.type === 'success' ? 'bg-google-green/90 border-google-green text-dark-900' : 
                        t.type === 'error' ? 'bg-google-red/90 border-google-red text-white' : 
                        'bg-dark-800 border-dark-700 text-white'
                    }`}>
                        <div className="font-black text-[10px] uppercase tracking-widest">{t.message}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default App;
