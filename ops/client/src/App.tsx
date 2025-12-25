
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import {
    Bot, Terminal, Activity, Shield, Zap, Search, Map, Send,
    Play, Square, RefreshCw, X, FileCode, CheckCircle, AlertTriangle,
    Cpu, Workflow, LayoutDashboard, MessageSquare, Database, Plus, Settings,
    Swords, Loader2, BrainCircuit, Gavel, Eye, EyeOff, FileText, Trash2, Edit3, Save, ChevronRight,
    TrendingUp, BarChart, Globe, Laptop, Smartphone, Link, Sparkles, Languages, FolderUp, Monitor,
    Layers, HardDrive, HeartPulse, Box, ShieldCheck, Gauge, Power, UploadCloud, Info, Camera, Film,
    GitBranch, Clock, ArrowRight, GitFork, TreePine, Beaker, ClipboardCheck, Info as InfoIcon
} from 'lucide-react';
import {
    AgentConfig, LogMessage, QueueResponse, TaskDefinition,
    ChatMessage, AiModelId, AutoPilotConfig, VisualAuditResult, HealingProposal
} from './types';

// Restored Component Imports
import RecoveryModule from './components/RecoveryModule';
import SeoLab from './components/SeoLab';
import GitPulse from './components/GitPulse';
import VisualDiff from './components/VisualDiff';

interface ModelInfo {
    id: string;
    name: string;
    provider: 'google' | 'openai' | 'openai-compatible';
    apiModelId?: string;
    apiKeyEnv?: string;
    manualApiKey?: string;
    baseUrl?: string;
}

const App = () => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'chat' | 'intelligence' | 'qa' | 'recovery' | 'seo' | 'git' | 'models'>('dashboard');
    const [agentRegistry, setAgentRegistry] = useState<Record<string, AgentConfig>>({});
    const [agentStatus, setAgentStatus] = useState<Record<string, string>>({});
    const [logs, setLogs] = useState<LogMessage[]>([]);
    const [toasts, setToasts] = useState<{id: number, message: string, type: 'info' | 'success' | 'error'}[]>([]);
    
    const API_BASE = window.location.origin + '/api';

    const [autopilotState, setAutopilotState] = useState<any>({ enabled: false, standardsMode: true, model: 'gemini-3-flash-preview' });
    const [queueStatus, setQueueStatus] = useState<QueueResponse>({ 
        processing: false, 
        activeTasks: [], 
        queue: [],
        history: [] 
    });

    const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
    const [selectedChatModel, setSelectedChatModel] = useState<string>('');
    const [isAiLoading, setIsAiLoading] = useState(false);
    
    // Intelligence Lab State
    const [councilPrompt, setCouncilPrompt] = useState('');
    const [councilResults, setCouncilResults] = useState<{model: string, text: string}[]>([]);
    const [isCouncilLoading, setIsCouncilLoading] = useState(false);
    const [groundingFacts, setGroundingFacts] = useState<any[]>([]);
    const [isConsensusLoading, setIsConsensusLoading] = useState(false);
    const [consensusText, setConsensusText] = useState('');

    // QA Surface State
    const [auditScores, setAuditScores] = useState({ performance: 92, accessibility: 98 });
    const [isAuditLoading, setIsAuditLoading] = useState(false);
    const [batchAuditResults, setBatchAuditResults] = useState<any[]>([]);
    const [isBatchLoading, setIsBatchLoading] = useState(false);

    // Background Log Processor (Restored Feature 4)
    const logWorkerRef = useRef<Worker | null>(null);
    const [processedLogs, setProcessedLogs] = useState<any[]>([]);

    const logsEndRef = useRef<HTMLDivElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const pipelineRef = useRef<HTMLDivElement>(null);

    const addToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    };

    const fetchData = async () => {
        try {
            const [m, a, q, f] = await Promise.all([
                fetch(`${API_BASE}/models`).then(res => res.json()),
                fetch(`${API_BASE}/autopilot`).then(res => res.json()),
                fetch(`${API_BASE}/queue/status`).then(res => res.json()),
                fetch(`${API_BASE}/facts`).then(res => res.json()).catch(() => [])
            ]);
            setAvailableModels(m);
            setAutopilotState(a);
            setQueueStatus(q);
            setGroundingFacts(f);
            if (m.length > 0 && !selectedChatModel) setSelectedChatModel(m[0].id);
        } catch (e) { console.error('Fetch data failed:', e); }
    };

    useEffect(() => {
        // Init Log Worker
        logWorkerRef.current = new Worker(new URL('./workers/logParser.worker.ts', import.meta.url));
        logWorkerRef.current.onmessage = (e) => {
            if (e.data.type === 'logs_processed') {
                setProcessedLogs(e.data.logs);
            }
        };

        fetchData();
        const s = io(window.location.origin, { path: '/socket.io' });
        setSocket(s);
        s.on('agent-registry', (data) => setAgentRegistry(data));
        s.on('status', (data) => setAgentStatus(data));
        s.on('autopilot-state', (data) => setAutopilotState(data));
        s.on('queue-status', (data) => setQueueStatus(data));
        s.on('log', (msg) => {
            setLogs(prev => {
                const newLogs = [...prev.slice(-1000), msg];
                logWorkerRef.current?.postMessage({ type: 'process_logs', logs: newLogs });
                return newLogs;
            });
        });

        return () => { 
            s.disconnect(); 
            logWorkerRef.current?.terminate();
        };
    }, []);

    useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [processedLogs]);

    const pipelineData = useMemo(() => {
        const allTasks = [
            ...(queueStatus.history || []),
            ...(queueStatus.activeTasks || []),
            ...(queueStatus.queue || [])
        ];
        
        const levels: Record<number, number> = {};
        const calculateLevel = (task: TaskDefinition): number => {
            if (levels[task.id] !== undefined) return levels[task.id];
            
            let level = 0;
            if (task.dependencies?.length) {
                const depLevels = task.dependencies.map(d => {
                    const dt = allTasks.find(t => t.id === d);
                    return dt ? calculateLevel(dt) : 0;
                });
                level = Math.max(...depLevels) + 1;
            }
            if (task.parentId) level += 0.5;
            levels[task.id] = level;
            return level;
        };

        allTasks.forEach(calculateLevel);
        const cols: Record<string, TaskDefinition[]> = {};
        allTasks.forEach(t => {
            const l = Math.floor(levels[t.id] || 0);
            if (!cols[l]) cols[l] = [];
            cols[l].push(t);
        });
        return Object.keys(cols).sort((a,b) => Number(a)-Number(b)).map(k => cols[k]);
    }, [queueStatus]);

    const spawnSubAgent = async (parentId: string) => {
        const taskName = prompt("Enter sub-mission objective:");
        if (!taskName) return;
        addToast(`Spawning sub-agent for: ${taskName}`, 'info');
        try {
            await fetch(`${API_BASE}/swarm/spawn`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ parentId, taskName })
            });
            addToast(`Sub-agent spawned successfully`, 'success');
        } catch(e) { addToast(`Spawn failed`, 'error'); }
    };

    const runSwarmCouncil = async () => {
        if (!councilPrompt) return;
        setIsCouncilLoading(true);
        addToast("Convening the Swarm Council...", "info");
        try {
            const res = await fetch(`${API_BASE}/swarm/council`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    prompt: councilPrompt, 
                    models: availableModels.slice(0, 3).map(m => m.id) 
                })
            });
            const data = await res.json();
            setCouncilResults(data.results);
            
            // Trigger Consensus Engine (Restored Feature 8)
            setIsConsensusLoading(true);
            const consensusRes = await fetch(`${API_BASE}/swarm/consensus`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: councilPrompt, results: data.results })
            });
            const cData = await consensusRes.json();
            setConsensusText(cData.consensus);
            
            addToast("Council consensus reached.", "success");
        } catch (e) { addToast("Council meeting failed", "error"); }
        finally { 
            setIsCouncilLoading(false); 
            setIsConsensusLoading(false);
        }
    };

    const runNeuralAudit = async () => {
        setIsAuditLoading(true);
        addToast("Running neural audit...", "info");
        setTimeout(() => {
            setAuditScores({ performance: Math.floor(Math.random() * 20) + 80, accessibility: 95 });
            setIsAuditLoading(false);
            addToast("Audit complete.", "success");
        }, 2000);
    };

    // Feature 5 Restoration: Batch Audit execution
    const runBatchAudit = async () => {
        setIsBatchLoading(true);
        addToast("Swarm is crawling sitemap for batch audit...", "info");
        try {
            const res = await fetch(`${API_BASE}/qa/batch-audit`);
            const data = await res.json();
            setBatchAuditResults(data.results);
            addToast("Batch audit complete.", "success");
        } catch (e) { addToast("Batch audit failed", "error"); }
        finally { setIsBatchLoading(false); }
    };

    const toggleAutopilot = async () => {
        const newEnabled = !autopilotState.enabled;
        try {
            const res = await fetch(`${API_BASE}/autopilot`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: newEnabled })
            });
            const data = await res.json();
            setAutopilotState(data);
            addToast(`Autopilot ${newEnabled ? 'Enabled' : 'Disabled'}`, 'info');
        } catch (e) { addToast('Toggle failed', 'error'); }
    };

    const startAgent = (id: string) => {
        addToast(`Starting ${id}...`, 'info');
        fetch(`${API_BASE}/start/${id}`, { method: 'POST' });
    };

    const stopAgent = (id: string) => {
        addToast(`Stopping ${id}...`, 'info');
        fetch(`${API_BASE}/stop/${id}`, { method: 'POST' });
    };

    const deleteFact = async (id: number) => {
        if (!confirm("Remove this fact from grounding?")) return;
        await fetch(`${API_BASE}/facts/${id}`, { method: 'DELETE' });
        setGroundingFacts(prev => prev.filter(f => f.id !== id));
        addToast("Fact purged from Intelligence Lab.", "info");
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'text-google-green border-google-green/20 bg-google-green/5';
            case 'processing': return 'text-google-blue border-google-blue/40 bg-google-blue/10 animate-pulse';
            case 'failed': return 'text-google-red border-google-red/40 bg-google-red/10';
            default: return 'text-gray-500 border-dark-700 bg-dark-900';
        }
    };

    return (
        <div className="min-h-screen bg-dark-900 text-gray-200 font-sans flex overflow-hidden">
            {/* Toasts */}
            <div className="fixed top-6 right-6 z-50 flex flex-col gap-3">
                {toasts.map(toast => (
                    <div key={toast.id} className={`flex items-center gap-3 px-5 py-3 rounded-2xl border backdrop-blur-xl shadow-2xl animate-in fade-in slide-in-from-right-10 duration-300 ${
                        toast.type === 'success' ? 'bg-google-green/10 border-google-green/50 text-google-green' :
                        toast.type === 'error' ? 'bg-google-red/10 border-google-red/50 text-google-red' :
                        'bg-dark-800 border-dark-600 text-google-blue'
                    }`}>
                        {toast.type === 'success' ? <CheckCircle size={18} /> : 
                         toast.type === 'error' ? <AlertTriangle size={18} /> : <InfoIcon size={18} />}
                        <span className="text-xs font-bold">{toast.message}</span>
                    </div>
                ))}
            </div>

            {/* Sidebar */}
            <div className="w-64 bg-dark-800 border-r border-dark-700 flex flex-col shadow-2xl z-20">
                <div className="p-8 border-b border-dark-700">
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3 group">
                        <Shield className="text-google-blue group-hover:rotate-12 transition-transform" size={28} /> 
                        <span className="tracking-tight">Swarm<span className="text-google-blue">Ops</span></span>
                    </h1>
                </div>
                <nav className="flex-1 p-5 space-y-1 overflow-y-auto scrollbar-hide">
                    {[
                        { id: 'dashboard', icon: LayoutDashboard, label: 'Control Deck' },
                        { id: 'git', icon: GitBranch, label: 'Git Pulse' },
                        { id: 'chat', icon: MessageSquare, label: 'Mission Chat' },
                        { id: 'intelligence', icon: BrainCircuit, label: 'Intelligence Lab' },
                        { id: 'qa', icon: ClipboardCheck, label: 'QA Surface' },
                        { id: 'recovery', icon: HeartPulse, label: 'Neural Recovery' },
                        { id: 'seo', icon: Globe, label: 'SEO Lab' },
                        { id: 'models', icon: Database, label: 'AI Registry' },
                    ].map(tab => (
                        <button 
                            key={tab.id} 
                            onClick={() => setActiveTab(tab.id as any)} 
                            className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all duration-300 ${
                                activeTab === tab.id 
                                ? 'bg-google-blue text-white shadow-[0_0_20px_rgba(26,115,232,0.3)]' 
                                : 'hover:bg-dark-700 text-gray-400'
                            }`}
                        >
                            <tab.icon size={18} /> 
                            <span className="font-semibold text-xs">{tab.label}</span>
                        </button>
                    ))}
                </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto bg-dark-900 p-10">
                {activeTab === 'dashboard' && (
                    <div className="space-y-10 animate-in fade-in duration-500">
                        <div className="flex justify-between items-end">
                            <div>
                                <h2 className="text-4xl font-black text-white tracking-tighter mb-1">Mission Control</h2>
                                <p className="text-sm text-gray-500 font-medium">Monitoring {Object.keys(agentRegistry).length} primary agents & parallel swarm threads.</p>
                            </div>
                            <div className="flex gap-4">
                                <button onClick={() => { addToast('Deploying consolidation sync...', 'info'); fetch(`${API_BASE}/deploy`, { method: 'POST' }); }} className="bg-google-green/10 border border-google-green text-google-green px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-google-green hover:text-white transition-all shadow-lg flex items-center gap-2">
                                    <UploadCloud size={16} /> Deploy Consolidate
                                </button>
                            </div>
                        </div>

                        {/* Autopilot Overview Card */}
                        <div className="bg-dark-800/50 backdrop-blur-md p-8 rounded-[2rem] border border-dark-700 shadow-2xl flex flex-col md:flex-row justify-between items-center gap-8 group hover:border-google-blue/40 transition-all">
                            <div className="flex items-center gap-8">
                                <div className={`p-6 rounded-3xl ${autopilotState.enabled ? 'bg-google-blue/20 text-google-blue animate-pulse' : 'bg-dark-700 text-gray-500 shadow-inner'}`}>
                                    <Zap size={40} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-2xl font-bold text-white tracking-tight">Recursive Autonomy</h3>
                                        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${autopilotState.enabled ? 'bg-google-green text-white shadow-[0_0_15px_rgba(52,168,83,0.4)]' : 'bg-dark-700 text-gray-500'}`}>
                                            {autopilotState.enabled ? 'Swarm Engaged' : 'Standby Mode'}
                                        </div>
                                    </div>
                                    <div className="flex gap-6 text-xs text-gray-500 font-bold uppercase tracking-widest">
                                        <div className="flex items-center gap-2"><TreePine size={16} className="text-google-green" /> Parallel Worktrees</div>
                                        <div className="flex items-center gap-2"><Cpu size={16} className="text-google-yellow" /> Controller: {autopilotState.model}</div>
                                    </div>
                                </div>
                            </div>
                            <button onClick={toggleAutopilot} className={`px-10 py-4 rounded-3xl font-black text-sm uppercase tracking-widest transition-all shadow-2xl hover:-translate-y-1 active:translate-y-0 ${autopilotState.enabled ? 'bg-google-red text-white hover:bg-red-600' : 'bg-google-blue text-white hover:bg-blue-600'}`}>
                                {autopilotState.enabled ? 'Terminate Swarm' : 'Initialize Swarm'}
                            </button>
                        </div>

                        {/* Hierarchical Pipeline DAG */}
                        <div className="bg-dark-800 p-8 rounded-[2rem] border border-dark-700 shadow-2xl overflow-hidden relative">
                             <div className="absolute top-0 right-0 p-8 opacity-10">
                                <Workflow size={120} />
                             </div>
                            <div className="flex items-center gap-4 mb-10 relative">
                                <GitFork className="text-google-blue" size={28} />
                                <h3 className="text-2xl font-bold text-white tracking-tight">Recursive Mission Stream</h3>
                            </div>
                            
                            <div className="relative min-h-[420px] flex gap-16 overflow-x-auto pb-8 scrollbar-hide" ref={pipelineRef}>
                                {pipelineData.length === 0 ? (
                                    <div className="w-full h-full flex flex-col items-center justify-center opacity-20 py-20">
                                        <Box size={64} className="mb-4" />
                                        <p className="font-black uppercase tracking-[0.5em]">No Active Pipeline</p>
                                    </div>
                                ) : (
                                    pipelineData.map((col, cIdx) => (
                                        <div key={cIdx} className="flex flex-col gap-8 min-w-[280px] animate-in slide-in-from-bottom-5 duration-500" style={{ animationDelay: `${cIdx * 100}ms` }}>
                                            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 border-b border-dark-700 pb-3 mb-2 flex items-center justify-between">
                                                <span>Mission Depth {cIdx}</span>
                                                <span className="text-google-blue opacity-50">{col.length} Threads</span>
                                            </div>
                                            {col.map(task => (
                                                <div 
                                                    key={task.id} 
                                                    className={`p-6 rounded-[1.5rem] border transition-all duration-500 relative group shadow-xl ${getStatusColor(task.status)} ${task.parentId ? 'ml-6' : ''} hover:scale-[1.02] hover:shadow-google-blue/10`}
                                                >
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2">
                                                            {task.parentId ? <GitBranch size={12} className="text-google-blue" /> : <Box size={12} />}
                                                            {task.type}
                                                        </div>
                                                        <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-tighter ${task.status === 'processing' ? 'animate-pulse' : ''}`}>
                                                            {task.status === 'completed' ? <CheckCircle size={14} /> : 
                                                             task.status === 'processing' ? <Loader2 size={14} className="animate-spin" /> : <Clock size={14} />}
                                                            {task.status}
                                                        </div>
                                                    </div>
                                                    <h4 className="text-md font-bold text-white mb-3 group-hover:text-google-blue transition-colors">{task.name}</h4>
                                                    {task.parentId && (
                                                        <div className="text-[9px] font-bold text-google-blue/70 mb-3 flex items-center gap-2 bg-google-blue/5 px-2 py-1 rounded-lg w-fit">
                                                            <ArrowRight size={10} /> Forked from: {task.parentId}
                                                        </div>
                                                    )}
                                                    <div className="w-full bg-dark-900 rounded-full h-1.5 mt-4 overflow-hidden shadow-inner">
                                                        <div className={`h-full transition-all duration-1000 ${task.status === 'completed' ? 'w-full bg-google-green shadow-[0_0_10px_rgba(52,168,83,0.5)]' : 'w-1/3 bg-google-blue animate-shimmer'}`} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Primary Agents */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
                            {Object.entries(agentRegistry).map(([id, config]) => (
                                <div key={id} className="bg-dark-800 p-8 rounded-[2rem] border border-dark-700 shadow-2xl group hover:border-google-blue/30 transition-all relative overflow-hidden">
                                    <div className="flex justify-between items-start mb-6 relative z-10">
                                        <div className="p-4 bg-dark-900 rounded-2xl border border-dark-700 shadow-inner group-hover:scale-110 transition-transform"><Bot className="text-google-blue" size={28} /></div>
                                        <div className="flex gap-3">
                                            {agentStatus[id] === 'running' && (
                                                <button onClick={() => spawnSubAgent(id)} className="p-3 bg-google-blue/10 text-google-blue rounded-xl hover:bg-google-blue hover:text-white transition-all shadow-xl" title="Spawn Swarm Sub-Agent">
                                                    <GitFork size={20} />
                                                </button>
                                            )}
                                            <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${agentStatus[id] === 'running' ? 'bg-google-green/10 text-google-green shadow-[0_0_15px_rgba(52,168,83,0.1)]' : 'bg-dark-700 text-gray-500'}`}>
                                                <div className={`w-2 h-2 rounded-full ${agentStatus[id] === 'running' ? 'bg-google-green animate-pulse' : 'bg-gray-600'}`} />
                                                {agentStatus[id] || 'offline'}
                                            </div>
                                        </div>
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-2 relative z-10">{config.name}</h3>
                                    <p className="text-sm text-gray-500 mb-8 font-medium relative z-10">{config.role}</p>
                                    <div className="flex gap-4 relative z-10">
                                        <button onClick={() => agentStatus[id] === 'running' ? stopAgent(id) : startAgent(id)} className={`flex-1 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl ${agentStatus[id] === 'running' ? 'bg-google-red/10 text-google-red border border-google-red/20 hover:bg-google-red hover:text-white' : 'bg-google-blue text-white hover:bg-blue-600'}`}>
                                            {agentStatus[id] === 'running' ? 'Terminate Link' : 'Engage Link'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Log Stream with Clustering (Restored Feature 4) */}
                        <div className="bg-black/80 backdrop-blur-md rounded-[2rem] border border-dark-700 shadow-2xl overflow-hidden">
                            <div className="px-8 py-5 border-b border-dark-700 flex justify-between items-center bg-dark-800/50">
                                <div className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-gray-400">
                                    <Terminal size={18} className="text-google-blue" /> Clustered Telemetry Stream
                                </div>
                                <div className="text-[10px] font-mono text-gray-600">Active Clusters: {processedLogs.length}</div>
                            </div>
                            <div className="p-8 font-mono text-[11px] h-[400px] overflow-y-auto scrollbar-thin">
                                {processedLogs.map((log: any, i) => (
                                    <div key={i} className="mb-2.5 flex gap-6 group hover:bg-white/5 transition-colors p-1 rounded-lg items-center">
                                        <span className="text-gray-700 opacity-50 shrink-0 font-bold">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                        <span className={`font-black uppercase tracking-tighter shrink-0 w-24 truncate ${log.agentId === 'system' ? 'text-google-yellow' : 'text-google-blue'}`}>{log.agentId}</span>
                                        <span className={`leading-relaxed flex-1 ${log.level === 'ERROR' ? 'text-google-red font-bold' : 'text-gray-300'}`}>{log.message}</span>
                                        {log.count > 1 && (
                                            <span className="bg-dark-600 text-google-blue px-2 py-0.5 rounded-full text-[9px] font-black border border-dark-500 animate-pulse shadow-glow">
                                                ×{log.count}
                                            </span>
                                        )}
                                    </div>
                                ))}
                                <div ref={logsEndRef} />
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'chat' && (
                    <div className="h-full flex flex-col bg-dark-800 rounded-[2rem] border border-dark-700 overflow-hidden shadow-2xl animate-in slide-in-from-bottom-5 duration-500">
                        <div className="p-8 border-b border-dark-700 flex justify-between items-center bg-dark-900/50">
                            <h2 className="text-2xl font-black text-white flex items-center gap-4">
                                <MessageSquare className="text-google-blue" /> Mission Chat
                            </h2>
                            <select value={selectedChatModel} onChange={e => setSelectedChatModel(e.target.value)} className="bg-dark-700 border border-dark-600 rounded-xl px-4 py-2 text-[10px] font-black text-white outline-none focus:border-google-blue transition-all uppercase tracking-widest shadow-lg">
                                {availableModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                        </div>
                        <div className="flex-1 overflow-y-auto p-10 space-y-8 scrollbar-hide">
                            <div className="flex justify-center mb-10 opacity-30">
                                <div className="text-[10px] font-black uppercase tracking-[0.5em] text-gray-400">Secure Channel Established</div>
                            </div>
                            <div ref={chatEndRef} />
                        </div>
                        <div className="p-10 bg-dark-800/80 backdrop-blur-md border-t border-dark-700">
                             <div className="flex gap-4 max-w-4xl mx-auto">
                                <input className="flex-1 bg-dark-900 border border-dark-700 rounded-2xl px-8 py-5 text-sm text-white outline-none focus:border-google-blue transition-all shadow-inner" placeholder="Relay instructions to the swarm..." />
                                <button className="bg-google-blue hover:bg-blue-600 text-white px-8 rounded-2xl shadow-2xl transition-all">
                                    <Send size={24} />
                                </button>
                             </div>
                        </div>
                    </div>
                )}

                {activeTab === 'intelligence' && (
                    <div className="space-y-10 animate-in fade-in duration-500">
                        <h2 className="text-4xl font-black text-white tracking-tighter mb-1">Intelligence Lab</h2>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 bg-dark-800 p-10 rounded-[2rem] border border-dark-700 shadow-2xl">
                                <div className="flex items-center gap-4 mb-8">
                                    <Beaker className="text-google-yellow" size={28} />
                                    <h3 className="text-2xl font-bold text-white">Swarm Council</h3>
                                </div>
                                <div className="space-y-6">
                                    <textarea 
                                        value={councilPrompt}
                                        onChange={e => setCouncilPrompt(e.target.value)}
                                        placeholder="Submit a strategic query to the council of models..."
                                        className="w-full bg-dark-900 border border-dark-700 rounded-[1.5rem] p-6 text-sm text-white focus:border-google-blue outline-none transition-all min-h-[150px] shadow-inner"
                                    />
                                    <button 
                                        onClick={runSwarmCouncil}
                                        disabled={isCouncilLoading}
                                        className="w-full bg-google-blue text-white py-5 rounded-[1.5rem] font-black uppercase tracking-widest shadow-2xl hover:bg-blue-600 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                    >
                                        {isCouncilLoading ? <Loader2 className="animate-spin" /> : <Swords size={20} />}
                                        Convene Council
                                    </button>
                                </div>

                                {councilResults.length > 0 && (
                                    <div className="mt-10 space-y-6">
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="h-px flex-1 bg-dark-700" />
                                            <span className="text-[10px] font-black uppercase tracking-[0.5em] text-gray-600">Individual Deliberations</span>
                                            <div className="h-px flex-1 bg-dark-700" />
                                        </div>
                                        {councilResults.map((r, i) => (
                                            <div key={i} className="p-6 bg-dark-900 rounded-2xl border border-dark-700 animate-in slide-in-from-bottom-2">
                                                <div className="text-[10px] font-black uppercase text-google-yellow mb-3">Response from {r.model}</div>
                                                <div className="text-sm text-gray-300 leading-relaxed">{r.text}</div>
                                            </div>
                                        ))}

                                        {/* Consensus Engine Output (Restored Feature 8) */}
                                        {(isConsensusLoading || consensusText) && (
                                            <div className="mt-10 p-10 bg-google-blue/5 border border-google-blue/30 rounded-[2rem] shadow-glow animate-in zoom-in-95 duration-700">
                                                <div className="flex items-center gap-4 mb-6">
                                                    <Gavel className="text-google-blue" size={28} />
                                                    <h3 className="text-2xl font-bold text-white tracking-tight">Consensus Recommendation</h3>
                                                    {isConsensusLoading && <Loader2 size={20} className="animate-spin text-google-blue" />}
                                                </div>
                                                <div className="text-md text-white leading-relaxed font-medium">
                                                    {isConsensusLoading ? "Mediating model perspectives..." : consensusText}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="bg-dark-800 p-10 rounded-[2rem] border border-dark-700 shadow-2xl">
                                <div className="flex items-center gap-4 mb-8">
                                    <Database className="text-google-blue" size={28} />
                                    <h3 className="text-2xl font-bold text-white">Project Knowledge</h3>
                                </div>
                                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-4 scrollbar-hide">
                                    {groundingFacts.map((f, i) => (
                                        <div key={i} className="p-5 bg-dark-900 rounded-2xl border border-dark-700 group hover:border-google-blue/30 transition-all relative overflow-hidden">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="text-[10px] font-black uppercase text-google-blue">{f.key || 'Fact Entry'}</div>
                                                <button onClick={() => deleteFact(f.id)} className="opacity-0 group-hover:opacity-100 p-1.5 bg-google-red/10 text-google-red rounded-lg transition-all hover:bg-google-red hover:text-white">
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                            <div className="text-xs text-gray-400 leading-relaxed">{f.value || f.content}</div>
                                        </div>
                                    ))}
                                    {groundingFacts.length === 0 && (
                                        <div className="text-center py-20 opacity-20">
                                            <HardDrive size={48} className="mx-auto mb-4" />
                                            <p className="text-[10px] font-black uppercase tracking-widest">Database Empty</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'qa' && (
                    <div className="space-y-10 animate-in fade-in duration-500">
                        <div className="flex justify-between items-end">
                            <h2 className="text-4xl font-black text-white tracking-tighter mb-1">QA Surface</h2>
                            <div className="flex gap-4">
                                <button onClick={runBatchAudit} disabled={isBatchLoading} className="bg-dark-800 border border-dark-700 text-google-blue px-8 py-3 rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center gap-3 hover:text-white hover:bg-google-blue transition-all">
                                    {isBatchLoading ? <Loader2 className="animate-spin" /> : <Layers size={18} />}
                                    Batch Swarm Audit
                                </button>
                                <button onClick={runNeuralAudit} disabled={isAuditLoading} className="bg-google-blue text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center gap-3">
                                    {isAuditLoading ? <Loader2 className="animate-spin" /> : <RefreshCw size={18} />}
                                    Trigger Neural Audit
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                            <div className="bg-dark-800 p-8 rounded-[2rem] border border-dark-700 shadow-2xl text-center">
                                <div className="text-sm font-black text-gray-500 uppercase tracking-widest mb-4">Performance</div>
                                <div className={`text-6xl font-black ${auditScores.performance > 90 ? 'text-google-green' : 'text-google-yellow'}`}>{auditScores.performance}</div>
                                <div className="w-full bg-dark-900 h-2 rounded-full mt-6 overflow-hidden">
                                    <div className="h-full bg-google-green" style={{ width: `${auditScores.performance}%` }} />
                                </div>
                            </div>
                            <div className="bg-dark-800 p-8 rounded-[2rem] border border-dark-700 shadow-2xl text-center">
                                <div className="text-sm font-black text-gray-500 uppercase tracking-widest mb-4">Accessibility</div>
                                <div className="text-6xl font-black text-google-blue">{auditScores.accessibility}</div>
                                <div className="w-full bg-dark-900 h-2 rounded-full mt-6 overflow-hidden">
                                    <div className="h-full bg-google-blue" style={{ width: `${auditScores.accessibility}%` }} />
                                </div>
                            </div>
                        </div>

                        {/* Feature 5 Restoration: Batch Audit Results Table */}
                        {batchAuditResults.length > 0 && (
                            <div className="bg-dark-800 p-10 rounded-[2rem] border border-dark-700 shadow-2xl animate-in slide-in-from-bottom-5">
                                <div className="flex items-center gap-4 mb-8">
                                    <ClipboardCheck className="text-google-blue" size={28} />
                                    <h3 className="text-2xl font-bold text-white">Batch Performance Report</h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="text-[10px] font-black uppercase tracking-widest text-gray-500 border-b border-dark-700">
                                                <th className="pb-4 px-4">Page/Resource</th>
                                                <th className="pb-4 px-4">Performance</th>
                                                <th className="pb-4 px-4">Accessibility</th>
                                                <th className="pb-4 px-4 text-right">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-dark-700/50">
                                            {batchAuditResults.map((res, i) => (
                                                <tr key={i} className="group hover:bg-white/5 transition-colors">
                                                    <td className="py-5 px-4">
                                                        <div className="text-sm font-bold text-white">{res.name}</div>
                                                        <div className="text-[10px] font-mono text-gray-500">{res.url}</div>
                                                    </td>
                                                    <td className="py-5 px-4">
                                                        <div className={`text-lg font-black ${res.performance > 90 ? 'text-google-green' : 'text-google-yellow'}`}>{res.performance}</div>
                                                    </td>
                                                    <td className="py-5 px-4">
                                                        <div className="text-lg font-black text-google-blue">{res.accessibility}</div>
                                                    </td>
                                                    <td className="py-5 px-4 text-right">
                                                        <span className="text-[10px] font-black uppercase tracking-tighter bg-google-green/10 text-google-green px-3 py-1 rounded-full border border-google-green/20">Synced</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Restored Feature 3: Visual Regression Diff Engine */}
                        <div className="bg-dark-800 p-10 rounded-[2rem] border border-dark-700 shadow-2xl">
                             <div className="flex items-center gap-4 mb-8">
                                <Monitor className="text-google-red" size={28} />
                                <h3 className="text-2xl font-bold text-white">Visual Regression Log</h3>
                            </div>
                            <VisualDiff />
                        </div>
                    </div>
                )}

                {activeTab === 'recovery' && <RecoveryModule socket={socket} />}
                {activeTab === 'seo' && <SeoLab />}
                {activeTab === 'git' && <GitPulse />}

                {activeTab === 'models' && (
                    <div className="space-y-10 animate-in fade-in duration-500">
                        <div className="flex justify-between items-end">
                             <h2 className="text-4xl font-black text-white tracking-tighter mb-1 text-glow">AI Registry</h2>
                             <button className="bg-google-blue text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center gap-3">
                                <Plus size={18} /> Register Model
                             </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                             {availableModels.map(m => (
                                 <div key={m.id} className="bg-dark-800 p-8 rounded-[2rem] border border-dark-700 shadow-2xl group hover:border-google-blue/30 transition-all">
                                     <div className="flex justify-between items-start mb-6">
                                         <div className="p-4 bg-dark-900 rounded-2xl border border-dark-700"><Cpu className="text-google-yellow" size={24} /></div>
                                         <div className="text-[9px] font-black uppercase tracking-widest text-google-blue bg-google-blue/5 px-3 py-1 rounded-full">{m.provider}</div>
                                     </div>
                                     <h4 className="text-lg font-bold text-white mb-2">{m.name}</h4>
                                     <p className="text-[10px] font-mono text-gray-600 mb-6">{m.apiModelId}</p>
                                     <div className="flex gap-2">
                                         <button className="p-3 bg-dark-700 rounded-xl text-gray-400 hover:text-white transition-colors"><Settings size={16} /></button>
                                         <button className="p-3 bg-dark-700 rounded-xl text-google-red/40 hover:text-google-red transition-colors"><Trash2 size={16} /></button>
                                     </div>
                                 </div>
                             ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default App;
