
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import {
    Bot, Terminal, Activity, Shield, Zap, Search, Map, Send,
    Play, Square, RefreshCw, X, FileCode, CheckCircle, AlertTriangle,
    Cpu, Workflow, LayoutDashboard, MessageSquare, Database, Plus, Settings,
    Swords, Loader2, BrainCircuit, Gavel, Eye, EyeOff, FileText, Trash2, Edit3, Save, ChevronRight,
    TrendingUp, BarChart, Globe, Laptop, Smartphone, Link, Sparkles, Languages, FolderUp, Monitor,
    Layers, HardDrive, HeartPulse, Box, ShieldCheck, Gauge, Power, UploadCloud, Info, Camera, Film,
    GitBranch, Clock, ArrowRight
} from 'lucide-react';
import {
    AgentConfig, LogMessage, QueueResponse, TaskDefinition,
    ChatMessage, AiModelId, AutoPilotConfig, VisualAuditResult
} from './types';

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
    const [activeTab, setActiveTab] = useState<'dashboard' | 'chat' | 'intelligence' | 'qa' | 'models'>('dashboard');
    const [agentRegistry, setAgentRegistry] = useState<Record<string, AgentConfig>>({});
    const [agentStatus, setAgentStatus] = useState<Record<string, string>>({});
    const [logs, setLogs] = useState<LogMessage[]>([]);
    
    // Networking - Strict absolute pathing as requested
    const API_BASE = window.location.origin + '/api';

    // Autopilot & Queue State
    const [autopilotState, setAutopilotState] = useState<any>({ enabled: false, standardsMode: true, model: 'gemini-3-flash-preview' });
    const [queueStatus, setQueueStatus] = useState<QueueResponse>({ 
        processing: false, 
        activeTasks: [], 
        queue: [],
        history: [] 
    });

    // AI Registry & Facts
    const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
    const [ingestedFacts, setIngestedFacts] = useState<any[]>([]);
    const [factInput, setFactInput] = useState({ key: '', value: '', category: 'technical' });
    
    // Model Management State
    const [showModelForm, setShowModelForm] = useState(false);
    const [modelForm, setModelForm] = useState<ModelInfo>({
        id: '',
        name: '',
        provider: 'openai',
        apiModelId: '',
        apiKeyEnv: '',
        manualApiKey: '',
        baseUrl: ''
    });

    // Chat & Intelligence
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [selectedChatModel, setSelectedChatModel] = useState<string>('');
    const [isAiLoading, setIsAiLoading] = useState(false);
    
    // Reasoning Toggles
    const [useThinking, setUseThinking] = useState(false);
    const [useSearch, setUseSearch] = useState(false);
    const [useMaps, setUseMaps] = useState(false);
    const [groundingLinks, setGroundingLinks] = useState<any[]>([]);

    const logsEndRef = useRef<HTMLDivElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const pipelineRef = useRef<HTMLDivElement>(null);

    const fetchData = async () => {
        try {
            const [m, a, q, f] = await Promise.all([
                fetch(`${API_BASE}/models`).then(res => res.json()),
                fetch(`${API_BASE}/autopilot`).then(res => res.json()),
                fetch(`${API_BASE}/queue/status`).then(res => res.json()),
                fetch(`${API_BASE}/facts`).then(res => res.json())
            ]);
            setAvailableModels(m);
            setAutopilotState(a);
            setQueueStatus(q);
            setIngestedFacts(f);
            if (m.length > 0 && !selectedChatModel) setSelectedChatModel(m[0].id);
        } catch (e) { console.error('Fetch data failed:', e); }
    };

    useEffect(() => {
        fetchData();
        const s = io(window.location.origin, { path: '/socket.io' });
        setSocket(s);
        s.on('agent-registry', (data) => setAgentRegistry(data));
        s.on('status', (data) => setAgentStatus(data));
        s.on('autopilot-state', (data) => setAutopilotState(data));
        s.on('queue-status', (data) => setQueueStatus(data));
        s.on('log', (msg) => setLogs(prev => [...prev.slice(-1000), msg]));
        return () => { s.disconnect(); };
    }, []);

    useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);
    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory]);

    // --- Pipeline Graph Calculation ---
    const pipelineData = useMemo(() => {
        // history is now correctly available on the updated QueueResponse interface in types.ts
        const allTasks = [
            ...(queueStatus.history || []),
            ...(queueStatus.activeTasks || []),
            ...(queueStatus.queue || [])
        ];
        
        const levels: Record<number, number> = {};

        const calculateLevel = (id: number): number => {
            if (levels[id] !== undefined) return levels[id];
            const task = allTasks.find(t => t.id === id);
            if (!task || !task.dependencies || task.dependencies.length === 0) {
                levels[id] = 0;
                return 0;
            }
            const maxDepLevel = Math.max(...task.dependencies.map(depId => calculateLevel(depId)));
            levels[id] = maxDepLevel + 1;
            return levels[id];
        };

        allTasks.forEach(t => calculateLevel(t.id));

        const columns: TaskDefinition[][] = [];
        allTasks.forEach(t => {
            const lvl = levels[t.id] || 0;
            if (!columns[lvl]) columns[lvl] = [];
            columns[lvl].push(t);
        });

        return { columns, allTasks };
    }, [queueStatus]);

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
        } catch (e) { console.error("Failed to toggle autopilot", e); }
    };

    const sendChatMessage = async () => {
        if (!chatInput.trim()) return;
        setIsAiLoading(true);
        const text = chatInput;
        setChatInput('');
        setChatHistory(prev => [...prev, { id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now() }]);

        try {
            const res = await fetch(`${API_BASE}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, model: selectedChatModel })
            });
            const data = await res.json();
            setChatHistory(prev => [...prev, { id: Date.now().toString(), role: 'ai', content: data.response, timestamp: Date.now() }]);
        } finally { setIsAiLoading(false); }
    };

    const runGroundedQuery = async () => {
        if (!chatInput.trim()) return;
        if (!useThinking && !useSearch && !useMaps) return sendChatMessage();

        setIsAiLoading(true);
        setGroundingLinks([]);
        let location = null;
        if (useMaps) {
            try {
                const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
                location = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
            } catch (err) { console.warn("Geo location not available"); }
        }

        try {
            const res = await fetch(`${API_BASE}/ai/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: chatInput, useSearch, useMaps, useThinking, location })
            });
            const data = await res.json();
            setChatHistory(prev => [...prev, 
                { id: Date.now().toString(), role: 'user', content: chatInput, timestamp: Date.now() },
                { id: (Date.now() + 1).toString(), role: 'ai', content: data.text, timestamp: Date.now() }
            ]);
            setGroundingLinks(data.grounding || []);
            setChatInput('');
        } finally { setIsAiLoading(false); }
    };

    // --- Model and Fact Handlers ---

    // Fixed: Added implementation for saveModel
    const saveModel = async () => {
        try {
            const res = await fetch(`${API_BASE}/models`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(modelForm)
            });
            if (res.ok) {
                setShowModelForm(false);
                fetchData();
                setModelForm({
                    id: '',
                    name: '',
                    provider: 'openai',
                    apiModelId: '',
                    apiKeyEnv: '',
                    manualApiKey: '',
                    baseUrl: ''
                });
            }
        } catch (e) { console.error('Failed to save model:', e); }
    };

    // Fixed: Added implementation for deleteModel
    const deleteModel = async (id: string) => {
        try {
            const res = await fetch(`${API_BASE}/models/${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                fetchData();
            }
        } catch (e) { console.error('Failed to delete model:', e); }
    };

    // Fixed: Added implementation for submitFact
    const submitFact = async () => {
        if (!factInput.key || !factInput.value) return;
        try {
            const res = await fetch(`${API_BASE}/facts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(factInput)
            });
            if (res.ok) {
                setFactInput({ key: '', value: '', category: 'technical' });
                fetchData();
            }
        } catch (e) { console.error('Failed to submit fact:', e); }
    };

    const startAgent = (id: string) => fetch(`${API_BASE}/start/${id}`, { method: 'POST' });
    const stopAgent = (id: string) => fetch(`${API_BASE}/stop/${id}`, { method: 'POST' });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'text-google-green border-google-green/20 bg-google-green/5';
            case 'processing': return 'text-google-blue border-google-blue/40 bg-google-blue/10 animate-pulse';
            case 'failed': return 'text-google-red border-google-red/40 bg-google-red/10';
            default: return 'text-gray-500 border-dark-700 bg-dark-900';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed': return <CheckCircle size={14} />;
            case 'processing': return <Loader2 size={14} className="animate-spin" />;
            case 'failed': return <AlertTriangle size={14} />;
            default: return <Clock size={14} />;
        }
    };

    return (
        <div className="min-h-screen bg-dark-900 text-gray-200 font-sans flex overflow-hidden">
            {/* Sidebar */}
            <div className="w-64 bg-dark-800 border-r border-dark-700 flex flex-col shadow-2xl z-20">
                <div className="p-8 border-b border-dark-700">
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Shield className="text-google-blue" size={28} /> Swarm Ops
                    </h1>
                </div>
                <nav className="flex-1 p-5 space-y-2 overflow-y-auto">
                    {[
                        { id: 'dashboard', icon: LayoutDashboard, label: 'Control Deck' },
                        { id: 'chat', icon: MessageSquare, label: 'Mission Chat' },
                        { id: 'intelligence', icon: BrainCircuit, label: 'Intelligence Lab' },
                        { id: 'qa', icon: CheckCircle, label: 'QA Surface' },
                        { id: 'models', icon: Database, label: 'AI Registry' },
                    ].map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl transition-all duration-200 ${activeTab === tab.id ? 'bg-google-blue text-white shadow-lg' : 'hover:bg-dark-700 text-gray-400'}`}>
                            <tab.icon size={20} /> <span className="font-semibold text-sm">{tab.label}</span>
                        </button>
                    ))}
                </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto bg-dark-900 p-10">
                {activeTab === 'dashboard' && (
                    <div className="space-y-10">
                        <div className="flex justify-between items-end">
                            <h2 className="text-3xl font-bold text-white tracking-tight">Mission Control</h2>
                            <div className="bg-dark-800 px-4 py-2 rounded-xl border border-dark-700 flex items-center gap-3 shadow-lg">
                                <Activity size={16} className="text-google-green" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Node: Active</span>
                            </div>
                        </div>

                        {/* Autopilot Overview Card */}
                        <div className="grid grid-cols-1 gap-6">
                            <div className="bg-dark-800 p-8 rounded-3xl border border-dark-700 shadow-xl flex flex-col md:flex-row justify-between items-center gap-8 group hover:border-google-blue/30 transition-all">
                                <div className="flex items-center gap-6">
                                    <div className={`p-5 rounded-2xl ${autopilotState.enabled ? 'bg-google-blue/10 text-google-blue animate-pulse' : 'bg-dark-700 text-gray-500 shadow-inner'}`}>
                                        <Zap size={32} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <h3 className="text-xl font-bold text-white tracking-tight">Autonomous Ops</h3>
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${autopilotState.enabled ? 'bg-google-green text-white shadow-lg shadow-google-green/20' : 'bg-dark-700 text-gray-500'}`}>
                                                {autopilotState.enabled ? 'Active' : 'Standby'}
                                            </span>
                                        </div>
                                        <div className="flex gap-4 text-xs text-gray-500 font-medium">
                                            <div className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-google-blue" /> Standards: {autopilotState.standardsMode ? 'Strict' : 'Relaxed'}</div>
                                            <div className="flex items-center gap-1.5"><Cpu size={14} className="text-google-yellow" /> Controller: {autopilotState.model}</div>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={toggleAutopilot} className={`px-8 py-3 rounded-2xl font-bold text-sm transition-all shadow-xl hover:-translate-y-0.5 active:translate-y-0 ${autopilotState.enabled ? 'bg-google-red text-white hover:bg-red-600' : 'bg-google-blue text-white hover:bg-blue-600'}`}>
                                    {autopilotState.enabled ? 'Disengage Autopilot' : 'Engage Autopilot'}
                                </button>
                            </div>
                        </div>

                        {/* Pipeline DAG Visualization */}
                        <div className="bg-dark-800 p-8 rounded-3xl border border-dark-700 shadow-xl relative overflow-hidden">
                            <div className="flex items-center gap-3 mb-8">
                                <Workflow className="text-google-blue" size={24} />
                                <h3 className="text-xl font-bold text-white tracking-tight">Mission Pipeline</h3>
                                <div className="ml-auto text-[10px] font-black uppercase text-gray-500 tracking-widest flex gap-4">
                                    <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-google-blue" /> Active</span>
                                    <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-google-green" /> Success</span>
                                    <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-dark-700" /> Queued</span>
                                </div>
                            </div>
                            
                            <div className="relative min-h-[400px] flex gap-16 overflow-x-auto pb-8 mask-fade-right" ref={pipelineRef}>
                                {/* SVG Lines for dependencies would go here if we had absolute coordinate calculation, 
                                    instead we use a clean column-based CSS layout with logic for a world-class look */}
                                {pipelineData.columns.length === 0 ? (
                                    <div className="w-full h-full flex flex-col items-center justify-center opacity-30 gap-4">
                                        <Box size={48} />
                                        <p className="text-xs font-bold uppercase tracking-widest">Pipeline Empty</p>
                                    </div>
                                ) : (
                                    pipelineData.columns.map((col, cIdx) => (
                                        <div key={cIdx} className="flex flex-col gap-6 min-w-[240px]">
                                            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-600 mb-2 border-b border-dark-700 pb-2">
                                                Stage {cIdx + 1}
                                            </div>
                                            {col.map(task => (
                                                <div 
                                                    key={task.id} 
                                                    id={`task-${task.id}`}
                                                    className={`p-5 rounded-2xl border transition-all duration-300 relative group ${getStatusColor(task.status)}`}
                                                >
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div className="text-[10px] font-black uppercase tracking-tighter opacity-60">{task.type}</div>
                                                        <div className="flex items-center gap-1.5 text-[10px] font-bold">
                                                            {getStatusIcon(task.status)}
                                                            {task.status}
                                                        </div>
                                                    </div>
                                                    <h4 className="text-sm font-bold text-white mb-2 group-hover:text-google-blue transition-colors">{task.name}</h4>
                                                    <div className="flex items-center gap-3 text-[10px] font-mono text-gray-500">
                                                        <span>#{task.id}</span>
                                                        {task.dependencies && task.dependencies.length > 0 && (
                                                            <div className="flex items-center gap-1">
                                                                <Link size={10} /> {task.dependencies.length}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {/* Visual dependency indicator */}
                                                    {cIdx > 0 && (
                                                        <div className="absolute -left-16 top-1/2 -translate-y-1/2 w-16 h-px bg-dark-700 pointer-events-none" />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Agent Registry and Logs */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                            {Object.entries(agentRegistry).map(([id, config]) => (
                                <div key={id} className="bg-dark-800 p-6 rounded-2xl border border-dark-700 shadow-xl group hover:border-google-blue/30 transition-all">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-3 bg-dark-900 rounded-xl"><Bot className="text-google-blue" size={24} /></div>
                                        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${agentStatus[id] === 'running' ? 'bg-google-green/10 text-google-green' : 'bg-dark-700 text-gray-500'}`}>
                                            {agentStatus[id] || 'stopped'}
                                        </div>
                                    </div>
                                    <h3 className="text-lg font-bold text-white mb-1">{config.name}</h3>
                                    <p className="text-xs text-gray-500 mb-6">{config.role}</p>
                                    <button onClick={() => agentStatus[id] === 'running' ? stopAgent(id) : startAgent(id)} className={`w-full py-2 rounded-lg text-xs font-bold transition-all ${agentStatus[id] === 'running' ? 'bg-google-red/10 text-google-red' : 'bg-google-blue text-white shadow-lg hover:bg-blue-600'}`}>
                                        {agentStatus[id] === 'running' ? 'Stop Agent' : 'Start Agent'}
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="bg-black rounded-xl p-5 font-mono text-[11px] h-[350px] overflow-y-auto border border-dark-700 shadow-inner">
                            {logs.map((log: any, i) => (
                                <div key={i} className="mb-1.5 leading-relaxed">
                                    <span className="text-gray-500 mr-2 opacity-50">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                                    <span className={`font-bold mr-2 ${log.agentId === 'system' ? 'text-google-yellow' : 'text-google-blue'}`}>{log.agentId}:</span>
                                    <span className={log.type === 'stderr' ? 'text-google-red' : 'text-gray-300'}>{log.message}</span>
                                </div>
                            ))}
                            <div ref={logsEndRef} />
                        </div>
                    </div>
                )}

                {activeTab === 'chat' && (
                    <div className="h-full flex flex-col bg-dark-800 rounded-3xl border border-dark-700 overflow-hidden shadow-2xl">
                        <div className="p-6 border-b border-dark-700 flex justify-between items-center bg-dark-900/50">
                            <div className="flex items-center gap-6">
                                <h2 className="text-xl font-bold text-white flex items-center gap-3"><MessageSquare className="text-google-blue" /> Chat</h2>
                                <select value={selectedChatModel} onChange={e => setSelectedChatModel(e.target.value)} className="bg-dark-700 border border-dark-600 rounded-lg px-3 py-1 text-[10px] font-bold text-white outline-none hover:border-google-blue transition-all">
                                    {availableModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </div>
                            <div className="flex gap-4">
                                <button onClick={() => setUseThinking(!useThinking)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${useThinking ? 'bg-google-yellow text-white shadow-lg' : 'bg-dark-900 text-gray-500'}`}><Cpu size={12} /> Thinking</button>
                                <button onClick={() => setUseSearch(!useSearch)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${useSearch ? 'bg-google-blue text-white shadow-lg' : 'bg-dark-900 text-gray-500'}`}><Search size={12} /> Search</button>
                                <button onClick={() => setUseMaps(!useMaps)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${useMaps ? 'bg-google-red text-white shadow-lg' : 'bg-dark-900 text-gray-500'}`}><Map size={12} /> Maps</button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 space-y-6">
                            {chatHistory.map(msg => (
                                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] p-6 rounded-2xl shadow-xl ${msg.role === 'user' ? 'bg-google-blue text-white' : 'bg-dark-900 border border-dark-700 text-gray-200'}`}>
                                        <div className="text-[10px] font-black uppercase tracking-widest mb-2 opacity-50">{msg.role}</div>
                                        <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                                    </div>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>
                        <div className="p-8 bg-dark-800/50 border-t border-dark-700">
                            <div className="flex gap-4">
                                <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && runGroundedQuery()} className="flex-1 bg-dark-900 border border-dark-700 rounded-2xl px-6 py-4 text-sm text-white outline-none focus:border-google-blue transition-all shadow-inner" placeholder="Message mission commander..." />
                                <button onClick={runGroundedQuery} disabled={isAiLoading} className="bg-google-blue hover:bg-blue-600 text-white p-4 rounded-2xl shadow-xl transition-all disabled:opacity-50">
                                    {isAiLoading ? <Loader2 className="animate-spin" /> : <Send size={20} />}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'models' && (
                    <div className="space-y-10">
                        <div className="flex justify-between items-center">
                            <h2 className="text-3xl font-bold text-white tracking-tight">AI Registry & Grounding</h2>
                            <button onClick={() => setShowModelForm(!showModelForm)} className="flex items-center gap-2 px-4 py-2 bg-google-blue rounded-xl text-xs font-bold hover:bg-blue-600 transition-all shadow-lg">
                                <Plus size={16} /> {showModelForm ? 'Cancel' : 'Add Model'}
                            </button>
                        </div>

                        {showModelForm && (
                            <div className="bg-dark-800 p-8 rounded-3xl border border-google-blue/50 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300">
                                <h3 className="text-xl font-bold text-white mb-6">Configure New AI Model</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-gray-500 mb-1 block">Model ID (Unique Key)</label>
                                            <input value={modelForm.id} onChange={e => setModelForm({...modelForm, id: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-xl px-4 py-2 text-sm text-white" placeholder="e.g. gpt-4o-latest" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-gray-500 mb-1 block">Display Name</label>
                                            <input value={modelForm.name} onChange={e => setModelForm({...modelForm, name: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-xl px-4 py-2 text-sm text-white" placeholder="e.g. GPT-4o Production" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-gray-500 mb-1 block">Provider</label>
                                            <select value={modelForm.provider} onChange={e => setModelForm({...modelForm, provider: e.target.value as any})} className="w-full bg-dark-900 border border-dark-700 rounded-xl px-4 py-2 text-sm text-white">
                                                <option value="openai">OpenAI</option>
                                                <option value="google">Google Gemini</option>
                                                <option value="openai-compatible">OpenAI Compatible (Local/Proxy)</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-gray-500 mb-1 block">API Model Identifier</label>
                                            <input value={modelForm.apiModelId} onChange={e => setModelForm({...modelForm, apiModelId: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-xl px-4 py-2 text-sm text-white" placeholder="e.g. gpt-4o or gemini-1.5-pro" />
                                        </div>
                                        {modelForm.provider === 'openai-compatible' && (
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-gray-500 mb-1 block">Base URL</label>
                                                <input value={modelForm.baseUrl} onChange={e => setModelForm({...modelForm, baseUrl: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-xl px-4 py-2 text-sm text-white" placeholder="e.g. http://localhost:11434/v1" />
                                            </div>
                                        )}
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-gray-500 mb-1 block">API Key (Env Variable or Value)</label>
                                            <input value={modelForm.apiKeyEnv} onChange={e => setModelForm({...modelForm, apiKeyEnv: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-xl px-4 py-2 text-sm text-white" placeholder="e.g. OPENAI_API_KEY" />
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-8 flex gap-4">
                                    <button onClick={() => {
                                        if (modelForm.id && modelForm.name) {
                                            saveModel();
                                        }
                                    }} className="flex-1 bg-google-green text-white py-3 rounded-xl font-bold text-sm shadow-lg hover:bg-green-600 transition-all">Save Configuration</button>
                                    <button onClick={() => setShowModelForm(false)} className="px-8 bg-dark-700 text-white py-3 rounded-xl font-bold text-sm hover:bg-dark-600 transition-all">Cancel</button>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="bg-dark-800 p-10 rounded-3xl border border-dark-700 space-y-6 shadow-2xl">
                                <h3 className="text-xl font-bold text-white flex items-center gap-3"><BrainCircuit size={20} className="text-google-blue" /> Context Ingestion</h3>
                                <div className="space-y-4">
                                    <input placeholder="Fact Identifier (e.g. project_rules)" value={factInput.key} onChange={e => setFactInput({...factInput, key: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-xl px-4 py-3 text-sm text-white shadow-inner" />
                                    <textarea placeholder="Grounding data or mission rule..." value={factInput.value} onChange={e => setFactInput({...factInput, value: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-xl px-4 py-3 text-sm text-white min-h-[120px] shadow-inner" />
                                    <button onClick={submitFact} className="w-full bg-google-blue text-white py-3 rounded-xl font-bold text-sm shadow-lg hover:bg-blue-600 transition-all">Ingest Grounding Fact</button>
                                </div>
                                <div className="mt-8 space-y-3">
                                    <h4 className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Database Content</h4>
                                    {ingestedFacts.map((f, i) => (
                                        <div key={i} className="p-4 bg-dark-900 rounded-xl border border-dark-700 flex justify-between items-center group">
                                            <div>
                                                <div className="text-[10px] font-black uppercase text-google-blue mb-1">{f.key}</div>
                                                <div className="text-xs text-gray-400 line-clamp-1 group-hover:line-clamp-none transition-all">{f.value}</div>
                                            </div>
                                            <span className="text-[9px] text-gray-600 font-mono">{new Date(f.timestamp).toLocaleDateString()}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-dark-800 p-10 rounded-3xl border border-dark-700 shadow-2xl">
                                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3"><Database size={20} className="text-google-yellow" /> Registered Providers</h3>
                                <div className="space-y-3">
                                    {availableModels.map(m => (
                                        <div key={m.id} className="p-5 bg-dark-900 border border-dark-700 rounded-2xl flex justify-between items-center hover:border-google-blue/30 transition-all shadow-lg group">
                                            <div className="flex-1">
                                                <span className="text-sm font-bold text-white group-hover:text-google-blue transition-colors">{m.name}</span>
                                                <div className="mt-1 flex gap-2">
                                                    <span className="text-[9px] px-2 py-0.5 bg-dark-700 rounded-full text-gray-400 uppercase font-black">{m.provider}</span>
                                                    <span className="text-[9px] px-2 py-0.5 bg-dark-700 rounded-full text-gray-400 font-mono">{m.apiModelId}</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => {
                                                    setModelForm(m);
                                                    setShowModelForm(true);
                                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                                }} className="p-2 bg-dark-700 rounded-lg text-gray-400 hover:text-white">
                                                    <Edit3 size={14} />
                                                </button>
                                                <button onClick={() => deleteModel(m.id)} className="p-2 bg-dark-700 rounded-lg text-google-red hover:bg-google-red/10">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
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
