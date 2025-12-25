import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import {
    Bot, Terminal, Activity, Shield, Zap, Search, Map, Send,
    Play, Square, RefreshCw, X, FileCode, CheckCircle, AlertTriangle,
    Cpu, Workflow, LayoutDashboard, MessageSquare, Database, Plus, Settings,
    Swords, Loader2, BrainCircuit, Gavel, Eye, EyeOff, FileText, Trash2, Edit3, Save, ChevronRight,
    TrendingUp, BarChart, Globe, Laptop, Smartphone, Link, Sparkles, Languages, FolderUp, Monitor,
    Layers, HardDrive, HeartPulse, Box, ShieldCheck, Gauge, Key, CloudLightning, RefreshCcw
} from 'lucide-react';
import {
    AgentConfig, LogMessage, QueueResponse, TaskDefinition,
    ChatMessage, AiModelId, AutoPilotConfig, VisualAuditResult
} from './types';

interface ModelRegistryEntry {
    id: string;
    name: string;
    provider: 'openai' | 'google' | 'openai-compatible' | 'local';
    apiModelId: string;
    baseUrl?: string;
    apiKeyEnv?: string;
    manualApiKey?: string;
}

interface ModelInfo {
    id: string;
    name: string;
    provider: string;
}

interface AgentWidgetData {
    id: string;
    source: string;
    html: string;
    css: string;
    timestamp: number;
}

interface GrammarlyResult {
    general_score: number;
    ai_generated_percentage: number;
    originality: number;
    correctness: number;
    clarity: number;
    engagement: number;
    delivery: number;
}

interface GrammarlyAnalytics {
    sessions: number[];
    improvements: number[];
}

interface CloudflareConfig {
    accountId: string;
    hasToken: boolean;
}

// ==========================================
// 🛡️ SHADOW DOM: AGENT-SAFE UI ISOLATION
// ==========================================
class AgentSafePanel extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }
}

// React Wrapper for the Isolated Web Component
const AgentWidget: React.FC<{ data: AgentWidgetData }> = ({ data }) => {
    const panelRef = useRef<HTMLElement>(null);

    useEffect(() => {
        if (panelRef.current && panelRef.current.shadowRoot) {
            const shadow = panelRef.current.shadowRoot;
            shadow.innerHTML = `
                <style>
                    :host { display: block; font-family: sans-serif; overflow: hidden; border-radius: 8px; }
                    .agent-content { transition: all 0.3s ease; }
                    ${data.css}
                </style>
                <div class="agent-content">
                    ${data.html}
                </div>
            `;
        }
    }, [data]);

    return (
        <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden mb-4 shadow-lg group hover:border-google-blue/30 transition-all">
            <div className="bg-dark-700/50 px-4 py-2 flex justify-between items-center border-b border-dark-700">
                <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    <Bot size={12} className="text-google-blue" /> {data.source}
                </div>
                <div className="text-[9px] text-gray-500 font-bold">
                    {new Date(data.timestamp).toLocaleTimeString()}
                </div>
            </div>
            <div className="p-4">
                {/* @ts-ignore */}
                <agent-safe-panel ref={panelRef}></agent-safe-panel>
            </div>
        </div>
    );
};

const App = () => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'chat' | 'war-room' | 'seo' | 'qa' | 'models' | 'governance'>('dashboard');
    const [agentRegistry, setAgentRegistry] = useState<Record<string, AgentConfig>>({});
    const [agentStatus, setAgentStatus] = useState<Record<string, string>>({});
    const [logs, setLogs] = useState<LogMessage[]>([]);
    
    // AI Registry
    const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
    const [fullRegistry, setFullRegistry] = useState<ModelRegistryEntry[]>([]);

    // SEO & Grammarly
    const [seoContentInput, setSeoContentInput] = useState('');
    const [grammarlyResult, setGrammarlyResult] = useState<GrammarlyResult | null>(null);
    const [isGrammarlyRunning, setIsGrammarlyRunning] = useState(false);

    // Governance & Cloudflare
    const [gClientId, setGClientId] = useState('');
    const [gClientSecret, setGClientSecret] = useState('');
    const [gAnalytics, setGAnalytics] = useState<GrammarlyAnalytics | null>(null);
    
    const [cfAccountId, setCfAccountId] = useState('');
    const [cfApiToken, setCfApiToken] = useState('');
    const [isCfTesting, setIsCfTesting] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    // UX Metrics
    const [uxMetrics, setUxMetrics] = useState({ longTasks: 0, cls: 0, lcp: 0, ttfb: 0 });
    const [agentWidgets, setAgentWidgets] = useState<AgentWidgetData[]>([]);
    const [storageUsage, setStorageUsage] = useState<string>('0');

    const logsEndRef = useRef<HTMLDivElement>(null);
    const dbRef = useRef<IDBDatabase | null>(null);

    const initDB = (): Promise<IDBDatabase> => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('MissionControlDB', 1);
            request.onupgradeneeded = (event: any) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('runs')) db.createObjectStore('runs', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('logs')) db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
            };
            request.onsuccess = (event: any) => { dbRef.current = event.target.result; resolve(event.target.result); };
            request.onerror = (event: any) => reject(event.target.error);
        });
    };

    const fetchData = async () => {
        try {
            const [m, r, g, cf] = await Promise.all([
                fetch('/api/models').then(res => res.json()),
                fetch('/api/models/registry').then(res => res.json()),
                fetch('/api/grammarly/config').then(res => res.json()),
                fetch('/api/edge/config').then(res => res.json())
            ]);
            setAvailableModels(m);
            setFullRegistry(r);
            setGClientId(g.clientId || '');
            setCfAccountId(cf.accountId || '');
        } catch (e) { console.error("Fetch Data Error:", e); }
    };

    const fetchAnalytics = async () => {
        try {
            const res = await fetch('/api/grammarly/analytics');
            const data = await res.json();
            setGAnalytics(data);
        } catch (e) { console.error("Analytics Error:", e); }
    };

    useEffect(() => {
        if (!customElements.get('agent-safe-panel')) customElements.define('agent-safe-panel', AgentSafePanel);
        initDB().then(() => fetchData());

        const s = io();
        setSocket(s);
        s.on('log', (msg) => setLogs(prev => [...prev.slice(-1000), msg]));

        return () => { s.disconnect(); };
    }, []);

    const saveGrammarlyConfig = async () => {
        try {
            await fetch('/api/grammarly/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId: gClientId, clientSecret: gClientSecret })
            });
            setLogs(prev => [...prev, { agentId: 'system', type: 'system', message: "🔐 Governance: Grammarly credentials updated.", timestamp: new Date().toISOString() }]);
        } catch (e) { console.error(e); }
    };

    const saveCloudflareConfig = async () => {
        try {
            await fetch('/api/edge/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accountId: cfAccountId, apiToken: cfApiToken })
            });
            setLogs(prev => [...prev, { agentId: 'system', type: 'system', message: "🔐 Governance: Cloudflare Edge credentials updated.", timestamp: new Date().toISOString() }]);
            setCfApiToken(''); // Clear local memory of sensitive token
        } catch (e) { console.error(e); }
    };

    const testCloudflareEdge = async () => {
        setIsCfTesting(true);
        try {
            const res = await fetch('/api/edge/test', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                setLogs(prev => [...prev, { agentId: 'system', type: 'system', message: "☁️ Cloudflare Edge: Test Successful. AI Response received from GPUs.", timestamp: new Date().toISOString() }]);
            } else {
                throw new Error(data.error);
            }
        } catch (e) {
            setLogs(prev => [...prev, { agentId: 'system', type: 'stderr', message: `Cloudflare Test Failed: ${e.message}`, timestamp: new Date().toISOString() }]);
        } finally {
            setIsCfTesting(false);
        }
    };

    const syncMissionToEdge = async () => {
        setIsSyncing(true);
        try {
            const snapshot = {
                logs: logs.slice(-50),
                ux: uxMetrics,
                activeTab
            };
            const res = await fetch('/api/edge/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ snapshot })
            });
            const data = await res.json();
            if (data.success) {
                setLogs(prev => [...prev, { agentId: 'system', type: 'system', message: `☁️ Edge Sync: Durable Object memory updated at ${new Date(data.timestamp).toLocaleTimeString()}.`, timestamp: new Date().toISOString() }]);
            }
        } catch (e) {
            console.error("Sync Error:", e);
        } finally {
            setIsSyncing(false);
        }
    };

    const runGrammarlyAudit = async () => {
        if (!seoContentInput.trim()) return;
        setIsGrammarlyRunning(true);
        try {
            const res = await fetch('/api/grammarly/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: seoContentInput })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setGrammarlyResult(data);
            shipAgentWidget('Grammarly Sentinel', `
                <div class="audit-widget">
                    <div class="score-main">${data.general_score}</div>
                    <div class="score-label">Writing Grade</div>
                </div>
            `, `.audit-widget { background: #34a853; color: white; text-align: center; padding: 15px; border-radius: 12px; }`);
        } catch (e) {
            setLogs(prev => [...prev, { agentId: 'system', type: 'stderr', message: `Audit Failed: ${e.message}`, timestamp: new Date().toISOString() }]);
        } finally {
            setIsGrammarlyRunning(false);
        }
    };

    const shipAgentWidget = (source: string, html: string, css: string) => {
        const newWidget: AgentWidgetData = { id: Date.now().toString(), source, html, css, timestamp: Date.now() };
        setAgentWidgets(prev => [newWidget, ...prev].slice(0, 3));
    };

    return (
        <div className="min-h-screen bg-dark-900 text-gray-200 font-sans flex overflow-hidden">
            <div className="w-64 bg-dark-800 border-r border-dark-700 flex flex-col shadow-2xl z-20">
                <div className="p-8 border-b border-dark-700">
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3"><Shield className="text-google-blue" size={28} /> Swarm Ops</h1>
                </div>
                <nav className="flex-1 p-5 space-y-2 overflow-y-auto">
                    {[
                        { id: 'dashboard', icon: LayoutDashboard, label: 'Control Deck' },
                        { id: 'seo', icon: Search, label: 'SEO Quality' },
                        { id: 'governance', icon: ShieldCheck, label: 'Governance' },
                        { id: 'models', icon: Database, label: 'AI Registry' },
                        { id: 'war-room', icon: Swords, label: 'War Room' },
                    ].map(tab => (
                        <button key={tab.id} onClick={() => { setActiveTab(tab.id as any); if (tab.id === 'governance') fetchAnalytics(); }} className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl transition-all duration-200 ${activeTab === tab.id ? 'bg-google-blue text-white shadow-lg' : 'hover:bg-dark-700 text-gray-400'}`}>
                            <tab.icon size={20} /> <span className="font-semibold text-sm">{tab.label}</span>
                        </button>
                    ))}
                    <div className="mt-8 pt-4 border-t border-dark-700">
                        <div className="px-5 mb-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Isolated Widgets</div>
                        {agentWidgets.map(widget => <AgentWidget key={widget.id} data={widget} />)}
                    </div>
                </nav>
                <div className="p-4 border-t border-dark-700">
                    <button onClick={syncMissionToEdge} disabled={isSyncing} className="w-full flex items-center justify-center gap-2 py-3 bg-dark-700 hover:bg-dark-600 rounded-xl text-[10px] font-black uppercase tracking-widest text-google-blue transition-all">
                        {isSyncing ? <RefreshCcw className="animate-spin" size={12} /> : <CloudLightning size={12} />} Sync Mission Edge
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto relative bg-dark-900 p-10">
                {activeTab === 'dashboard' && (
                    <div className="space-y-10">
                        <h2 className="text-3xl font-bold text-white tracking-tight">Mission Control Overview</h2>
                        <div className="grid grid-cols-4 gap-6">
                            <div className="bg-dark-800 p-6 rounded-2xl border border-dark-700 shadow-xl">
                                <div className="text-[10px] text-gray-500 font-black uppercase mb-2 tracking-widest">Main Thread Heat</div>
                                <div className="text-3xl font-black text-white">{uxMetrics.longTasks} <span className="text-xs text-gray-500">Events</span></div>
                            </div>
                            <div className="bg-dark-800 p-6 rounded-2xl border border-google-blue/30 shadow-xl">
                                <div className="text-[10px] text-google-blue font-black uppercase mb-2 tracking-widest">Edge Status</div>
                                <div className="text-xl font-black text-white flex items-center gap-2">
                                    <Globe size={18} className="text-google-blue" /> Persistent DO Active
                                </div>
                            </div>
                        </div>
                        <div className="bg-black/50 border border-dark-700 rounded-2xl p-6 font-mono text-xs overflow-y-auto h-96">
                            {logs.map((log, i) => (
                                <div key={i} className="mb-1">
                                    <span className="text-gray-600">[{new Date(log.timestamp).toLocaleTimeString()}]</span> <span className="text-google-blue">{log.agentId}:</span> {log.message}
                                </div>
                            ))}
                            <div ref={logsEndRef} />
                        </div>
                    </div>
                )}

                {activeTab === 'seo' && (
                    <div className="space-y-10">
                        <div className="flex justify-between items-center">
                            <h2 className="text-3xl font-bold text-white">SEO Quality Gate</h2>
                            <button onClick={runGrammarlyAudit} disabled={isGrammarlyRunning} className="bg-google-green hover:bg-green-600 text-white px-8 py-4 rounded-2xl font-black text-sm flex items-center gap-3 transition-transform hover:scale-105 active:scale-95 shadow-xl">
                                {isGrammarlyRunning ? <Loader2 className="animate-spin" /> : <Gauge size={20} />} Run Grammarly Audit
                            </button>
                        </div>
                        <div className="bg-dark-800 rounded-3xl p-8 border border-dark-700 shadow-2xl">
                            <textarea value={seoContentInput} onChange={e => setSeoContentInput(e.target.value)} className="w-full bg-dark-900 rounded-2xl p-6 text-gray-200 border border-dark-700 outline-none min-h-[300px]" placeholder="Paste copy for performance analysis..." />
                        </div>
                        {grammarlyResult && (
                            <div className="bg-dark-800 rounded-3xl p-8 border border-google-blue/30 shadow-2xl">
                                <h3 className="text-xl font-black text-white mb-8">Audit Dashboard</h3>
                                <div className="grid grid-cols-4 gap-4">
                                    {['Correctness', 'Clarity', 'Engagement', 'Delivery'].map(metric => (
                                        <div key={metric} className="p-6 bg-dark-900/50 rounded-2xl border border-dark-700 text-center">
                                            <div className="text-[10px] uppercase font-black text-gray-500 tracking-widest mb-2">{metric}</div>
                                            <div className="text-2xl font-black text-white">{(grammarlyResult as any)[metric.toLowerCase()] || 0}%</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'governance' && (
                    <div className="space-y-10 pb-20">
                        <h2 className="text-3xl font-bold text-white tracking-tight">Governance & Cloud Configuration</h2>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                            <div className="bg-dark-800 rounded-3xl p-10 border border-dark-700 shadow-2xl">
                                <h3 className="text-xl font-black text-white mb-8 flex items-center gap-3 text-google-blue"><Globe size={24} /> Cloudflare Edge Infrastructure</h3>
                                <div className="space-y-6">
                                    <div>
                                        <label className="text-[10px] font-black text-gray-500 block mb-3 uppercase tracking-widest">Account ID</label>
                                        <input type="text" value={cfAccountId} onChange={e => setCfAccountId(e.target.value)} className="w-full bg-dark-900 border border-dark-700 rounded-xl p-4 text-gray-200 outline-none focus:border-google-blue/50 transition-all font-mono text-sm" placeholder="Found in CF Dashboard Sidebar" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-gray-500 block mb-3 uppercase tracking-widest">API Token (Workers AI Permission)</label>
                                        <input type="password" value={cfApiToken} onChange={e => setCfApiToken(e.target.value)} className="w-full bg-dark-900 border border-dark-700 rounded-xl p-4 text-gray-200 outline-none focus:border-google-blue/50 transition-all font-mono text-sm" placeholder="••••••••••••••••" />
                                    </div>
                                    <div className="flex gap-4">
                                        <button onClick={saveCloudflareConfig} className="flex-1 bg-google-blue hover:bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-sm transition-transform active:scale-95 shadow-lg flex items-center justify-center gap-2">
                                            <Save size={18} /> Update Edge Config
                                        </button>
                                        <button onClick={testCloudflareEdge} disabled={isCfTesting} className="flex-1 bg-dark-700 hover:bg-dark-600 text-white px-8 py-4 rounded-2xl font-black text-sm transition-transform active:scale-95 shadow-lg flex items-center justify-center gap-2">
                                            {isCfTesting ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />} Test Connection
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-dark-800 rounded-3xl p-10 border border-dark-700 shadow-2xl">
                                <h3 className="text-xl font-black text-white mb-8 flex items-center gap-3 text-google-yellow"><Key size={24} /> Grammarly Infrastructure</h3>
                                <div className="space-y-6">
                                    <div>
                                        <label className="text-[10px] font-black text-gray-500 block mb-3 uppercase tracking-widest">Client ID</label>
                                        <input type="text" value={gClientId} onChange={e => setGClientId(e.target.value)} className="w-full bg-dark-900 border border-dark-700 rounded-xl p-4 text-gray-200 outline-none" placeholder="ID from developer.grammarly.com" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-gray-500 block mb-3 uppercase tracking-widest">Client Secret</label>
                                        <input type="password" value={gClientSecret} onChange={e => setGClientSecret(e.target.value)} className="w-full bg-dark-900 border border-dark-700 rounded-xl p-4 text-gray-200 outline-none" placeholder="••••••••••••••••" />
                                    </div>
                                    <button onClick={saveGrammarlyConfig} className="bg-google-yellow text-black px-8 py-4 rounded-2xl font-black text-sm w-full transition-transform active:scale-95 shadow-lg flex items-center justify-center gap-2">
                                        <ShieldCheck size={18} /> Update Infrastructure Keys
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default App;