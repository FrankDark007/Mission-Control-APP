
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { GoogleGenAI, Modality, Type } from "@google/genai";
import {
    Shield, Zap, LayoutDashboard, MessageSquare, Settings,
    Swords, Loader2, BrainCircuit, Gavel, RefreshCw,
    TrendingUp, Globe, Sparkles, Radio, ShieldAlert, Kanban, BarChart3,
    GitBranch, BookOpen, HeartPulse, Bot, Workflow, Mic
} from 'lucide-react';
import {
    AgentConfig, QueueResponse, HealingProposal
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

// Audio Utils
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
  }
  return buffer;
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
    const [activeTab, setActiveTab] = useState<'dashboard' | 'analytics' | 'swarm' | 'live' | 'chat' | 'sandbox' | 'strategy' | 'consensus' | 'briefing' | 'creative' | 'security' | 'intelligence' | 'qa' | 'git' | 'seo' | 'models'>('dashboard');
    const [agentRegistry, setAgentRegistry] = useState<Record<string, AgentConfig>>({});
    const [agentStatus, setAgentStatus] = useState<Record<string, string>>({});
    const [toasts, setToasts] = useState<{id: number, message: string, type: 'info' | 'success' | 'error'}[]>([]);
    const API_BASE = window.location.origin + '/api';

    const [telemetry, setTelemetry] = useState({ timeToVerdict: 0, errorCount: 0, totalProcessed: 0 });
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

    const handleApplyFix = async (command: string) => {
        if (!activeDeviation) return;
        addToast("Executing neural fix...", "info");
        try {
            const res = await fetch('/api/heal/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agentId: activeDeviation.agentId, command })
            });
            if (res.ok) {
                addToast("Neural Alignment Verified", "success");
                setActiveDeviation(null);
            } else {
                addToast("Alignment failed.", "error");
            }
        } catch (e) {
            addToast("Healing transmission error", "error");
        }
    };

    const sproutAgent = async (data: any) => {
        addToast(`Sprouting sub-agent for ${data.taskName}...`, 'info');
        try {
            const res = await fetch('/api/swarm/sprout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (res.ok) addToast("Autonomous Sprout Successful", "success");
            else addToast("Sprout failed.", "error");
        } catch (e) { addToast("Sprout transmission error", "error"); }
    };

    const addTask = async (task: any) => {
        try {
            await fetch('/api/swarm/mission', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(task)
            });
            addToast("Strategic mission queued", "success");
        } catch (e) { addToast("Queue failed.", "error"); }
    };

    useEffect(() => {
        const logWorker = new Worker(new URL('./workers/logParser.worker.ts', import.meta.url));
        logWorker.onmessage = (e) => {
            if (e.data.type === 'logs_processed') {
                setTelemetry(e.data.metrics);
            }
        };

        const s = io(window.location.origin, { path: '/socket.io' });
        setSocket(s);
        s.on('agent-registry', (data) => setAgentRegistry(data));
        s.on('status', (data) => setAgentStatus(data));
        s.on('queue-status', (data) => setQueueStatus(data));
        s.on('agent-deviation', (d) => { setActiveDeviation(d); addToast("Neural Healing Required", "error"); });
        s.on('log', (msg) => logWorker.postMessage({ type: 'process_logs', logs: [msg] }));

        return () => { s.disconnect(); logWorker.terminate(); };
    }, []);

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
                        { id: 'live', icon: Mic },
                        { id: 'chat', icon: MessageSquare },
                        { id: 'sandbox', icon: BrainCircuit },
                        { id: 'strategy', icon: BookOpen },
                        { id: 'consensus', icon: Swords },
                        { id: 'briefing', icon: Radio },
                        { id: 'creative', icon: Sparkles },
                        { id: 'security', icon: ShieldAlert },
                        { id: 'qa', icon: Gavel },
                        { id: 'git', icon: GitBranch },
                        { id: 'seo', icon: Globe },
                        { id: 'intelligence', icon: BrainCircuit },
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
                            <div className="flex justify-between items-start">
                                <div className="flex gap-8">
                                    <HealthGauge score={swarmHealth} />
                                    <div>
                                        <h2 className="text-4xl font-black text-white tracking-tighter">Mission Control</h2>
                                        <div className="flex gap-4 mt-2">
                                            <div className="flex items-center gap-2 text-[10px] font-black uppercase text-gray-500"><Zap size={12} className="text-google-yellow" /> Status: Nominal</div>
                                            <div className="flex items-center gap-2 text-[10px] font-black uppercase text-gray-500"><HeartPulse size={12} className="text-google-red" /> Errors: {telemetry.errorCount}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <SwarmTopology agents={agentRegistry} status={agentStatus} subAgents={queueStatus.activeTasks} />
                        </div>
                    )}
                    {activeTab === 'analytics' && <AnalyticsLab />}
                    {activeTab === 'swarm' && <SwarmBoard queue={queueStatus} onAddTask={addTask} onSproutAgent={sproutAgent} />}
                    {activeTab === 'live' && <LiveLab />}
                    {activeTab === 'chat' && <ChatLab />}
                    {activeTab === 'sandbox' && <SandboxLab />}
                    {activeTab === 'strategy' && <PromptLab />}
                    {activeTab === 'consensus' && <ConsensusLab />}
                    {activeTab === 'briefing' && <BriefingLab />}
                    {activeTab === 'creative' && <CreativeStudio />}
                    {activeTab === 'security' && <SecurityLab />}
                    {activeTab === 'intelligence' && <IntelligenceLab />}
                    {activeTab === 'qa' && <QACriticLab />}
                    {activeTab === 'seo' && <SeoLab />}
                    {activeTab === 'git' && <GitPulse />}
                    {activeTab === 'models' && <ModelsLab />}
                </div>

                {activeDeviation && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-10 animate-in fade-in duration-300">
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
