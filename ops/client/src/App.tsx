import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import {
    Bot, Terminal, Activity, Shield, Zap, Search, Map, Send,
    Play, Square, RefreshCw, X, FileCode, CheckCircle, AlertTriangle,
    Cpu, Workflow, LayoutDashboard, MessageSquare, Database, Plus, Settings,
    Swords, Loader2, BrainCircuit, Gavel, Eye, FileText, Trash2, Edit3, Save, ChevronRight
} from 'lucide-react';
import {
    AgentConfig, LogMessage, QueueResponse, TaskDefinition,
    ChatMessage, AiModelId, AutoPilotConfig, VisualAuditResult
} from './types';

interface ModelInfo {
    id: string;
    name: string;
    provider: string;
}

const App = () => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'chat' | 'war-room' | 'qa'>('dashboard');
    const [agentRegistry, setAgentRegistry] = useState<Record<string, AgentConfig>>({});
    const [agentStatus, setAgentStatus] = useState<Record<string, string>>({});
    const [logs, setLogs] = useState<LogMessage[]>([]);
    const [queueStatus, setQueueStatus] = useState<QueueResponse>({ processing: false, activeTasks: [], queue: [] });
    
    // AI Registry State
    const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);

    // Chat State
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [selectedChatModel, setSelectedChatModel] = useState<string>('gemini-3-pro');
    
    // War Room State
    const [councilInput, setCouncilInput] = useState('');
    const [selectedCouncilModels, setSelectedCouncilModels] = useState<Record<string, boolean>>({});
    const [selectedSynthesizer, setSelectedSynthesizer] = useState<string>('');
    const [isCouncilWorking, setIsCouncilWorking] = useState(false);
    const [councilResults, setCouncilResults] = useState<{
        individual_responses: Record<string, string>;
        consensus: string;
        synthesizer: string;
    } | null>(null);

    // QA State
    const [visualResult, setVisualResult] = useState<VisualAuditResult | null>(null);
    const [isAuditRunning, setIsAuditRunning] = useState(false);

    // Registry Config Modal State
    const [isRegistryModalOpen, setIsRegistryModalOpen] = useState(false);
    const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
    const [agentForm, setAgentForm] = useState<Partial<AgentConfig & { id: string }>>({
        id: '',
        name: '',
        role: '',
        command: '',
        path: '',
        safeArgs: [],
        yoloArgs: [],
        restartPolicy: 'on-failure'
    });

    const [autoPilotConfig, setAutoPilotConfig] = useState<AutoPilotConfig>({ enabled: false, standardsMode: false, model: 'gemini-3-pro' });
    
    const logsEndRef = useRef<HTMLDivElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Initial Fetch
    useEffect(() => {
        fetch('/api/models')
            .then(res => res.json())
            .then((data: ModelInfo[]) => {
                setAvailableModels(data);
                const defaults: Record<string, boolean> = {};
                data.forEach(m => defaults[m.id] = true);
                setSelectedCouncilModels(defaults);
                if (data.length > 0) {
                    setSelectedChatModel(data[0].id);
                    setSelectedSynthesizer(data[0].id);
                }
            })
            .catch(err => console.error("Failed to fetch models", err));
    }, []);

    useEffect(() => {
        const s = io('http://localhost:3001');
        setSocket(s);
        s.on('agent-registry', (data: Record<string, AgentConfig>) => setAgentRegistry(data));
        s.on('status', (data: Record<string, string>) => setAgentStatus(data));
        s.on('log', (msg: LogMessage) => setLogs(prev => [...prev.slice(-1000), msg]));
        s.on('autopilot-config', (config: AutoPilotConfig) => setAutoPilotConfig(config));

        const interval = setInterval(() => {
            fetch('/api/queue/status')
                .then(res => res.json())
                .then(data => setQueueStatus(data))
                .catch(console.error);
        }, 1000);

        return () => {
            s.disconnect();
            clearInterval(interval);
        };
    }, []);

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory]);

    const startAgent = async (id: string) => { await fetch(`/api/start/${id}`, { method: 'POST' }); };
    const stopAgent = async (id: string) => { await fetch(`/api/stop/${id}`, { method: 'POST' }); };

    const saveAgentConfig = async () => {
        if (!agentForm.id || !agentForm.name) return;
        const { id, ...config } = agentForm;
        try {
            const res = await fetch('/api/agents/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, config })
            });
            if (res.ok) {
                setEditingAgentId(null);
                setAgentForm({ id: '', name: '', role: '', command: '', path: '', safeArgs: [], yoloArgs: [], restartPolicy: 'on-failure' });
            }
        } catch (e) {
            console.error(e);
        }
    };

    const deleteAgentConfig = async (id: string) => {
        if (!confirm(`Are you sure you want to delete the ${id} agent configuration?`)) return;
        try {
            const res = await fetch(`/api/agents/config/${id}`, { method: 'DELETE' });
            if (res.ok && editingAgentId === id) {
                setEditingAgentId(null);
                setAgentForm({ id: '', name: '', role: '', command: '', path: '', safeArgs: [], yoloArgs: [], restartPolicy: 'on-failure' });
            }
        } catch (e) {
            console.error(e);
        }
    };

    const openEditAgent = (id: string, config: AgentConfig) => {
        setEditingAgentId(id);
        setAgentForm({ id, ...config });
    };

    const sendChatMessage = async () => {
        if (!chatInput.trim()) return;
        const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: chatInput, timestamp: Date.now() };
        setChatHistory(prev => [...prev, userMsg]);
        setChatInput('');
        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMsg.content, model: selectedChatModel })
            });
            const data = await res.json();
            setChatHistory(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'ai',
                content: data.response,
                modelUsed: selectedChatModel as any,
                timestamp: Date.now()
            }]);
        } catch (e) { console.error(e); }
    };

    const conveneCouncil = async () => {
        if (!councilInput.trim() || isCouncilWorking) return;
        setIsCouncilWorking(true);
        setCouncilResults(null);
        const models = Object.entries(selectedCouncilModels).filter(([_, enabled]) => enabled).map(([id]) => id);
        try {
            const res = await fetch('/api/swarm/council', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: councilInput, models, synthesizer: selectedSynthesizer })
            });
            const data = await res.json();
            setCouncilResults(data);
        } catch (e) { console.error(e); alert("Failed to convene council."); } finally { setIsCouncilWorking(false); }
    };

    const runVisualAudit = async () => {
        setIsAuditRunning(true);
        try {
            const res = await fetch('/api/qa/visual', { method: 'POST' });
            const data = await res.json();
            if (data.results) setVisualResult(data.results);
        } catch (e) { console.error(e); alert("Failed to run visual audit"); } finally { setIsAuditRunning(false); }
    };

    const renderTaskTree = () => {
        if (queueStatus.activeTasks.length === 0 && queueStatus.queue.length === 0) {
            return <div className="text-gray-500 italic text-sm text-center py-4">Queue is empty. System idle.</div>;
        }
        return (
            <div className="space-y-3">
                {queueStatus.activeTasks.map(task => (
                    <div key={task.id} className="bg-dark-800 p-3 rounded border border-google-blue/50 flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-google-blue flex items-center gap-2">
                                <RefreshCw className="animate-spin" size={14} /> {task.name}
                            </span>
                            <span className="text-xs bg-google-blue text-white px-2 py-0.5 rounded">Running</span>
                        </div>
                        <div className="font-mono text-xs text-gray-400 truncate">{task.lastLog || "Initializing..."}</div>
                    </div>
                ))}
                {queueStatus.queue.map(task => (
                    <div key={task.id} className="bg-dark-800 p-3 rounded border border-dark-700 opacity-70">
                         <div className="flex justify-between items-center">
                            <span className="font-bold text-gray-300">{task.name}</span>
                            <span className="text-xs bg-dark-700 text-gray-400 px-2 py-0.5 rounded uppercase">{task.status}</span>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const renderLogs = () => (
        <div className="bg-black rounded-lg p-4 font-mono text-xs h-[400px] overflow-y-auto border border-dark-700">
            {logs.length === 0 && <div className="text-gray-600">Waiting for logs...</div>}
            {logs.map((log, i) => (
                <div key={i} className="mb-1 break-words">
                    <span className="text-gray-500 mr-2">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                    <span className={`font-bold mr-2 ${log.agentId === 'system' ? 'text-purple-400' : 'text-blue-400'}`}>{log.agentId}:</span>
                    <span className={log.type === 'stderr' ? 'text-red-400' : 'text-gray-300'}>{log.message}</span>
                </div>
            ))}
            <div ref={logsEndRef} />
        </div>
    );

    return (
        <div className="min-h-screen bg-dark-900 text-gray-200 font-sans flex">
            {/* Sidebar */}
            <div className="w-64 bg-dark-800 border-r border-dark-700 flex flex-col">
                <div className="p-6 border-b border-dark-700">
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        <Activity className="text-google-blue" />
                        Flood Doctor
                    </h1>
                    <p className="text-xs text-gray-500 mt-1">Ops & Command Center</p>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'dashboard' ? 'bg-google-blue/10 text-google-blue' : 'hover:bg-dark-700 text-gray-400'}`}>
                        <LayoutDashboard size={18} /> Dashboard
                    </button>
                    <button onClick={() => setActiveTab('chat')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'chat' ? 'bg-google-blue/10 text-google-blue' : 'hover:bg-dark-700 text-gray-400'}`}>
                        <MessageSquare size={18} /> AI Chat
                    </button>
                    <button onClick={() => setActiveTab('war-room')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'war-room' ? 'bg-google-blue/10 text-google-blue' : 'hover:bg-dark-700 text-gray-400'}`}>
                        <Swords size={18} /> War Room
                    </button>
                    <button onClick={() => setActiveTab('qa')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'qa' ? 'bg-google-blue/10 text-google-blue' : 'hover:bg-dark-700 text-gray-400'}`}>
                        <CheckCircle size={18} /> QA & Audit
                    </button>
                </nav>
                <div className="p-4 border-t border-dark-700">
                    <button onClick={() => setIsRegistryModalOpen(true)} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-dark-700 transition-colors">
                        <Settings size={18} /> Registry Manager
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto p-8">
                {activeTab === 'dashboard' && (
                    <div className="max-w-6xl mx-auto space-y-8">
                        <div className="flex justify-between items-center">
                            <h2 className="text-2xl font-bold text-white">System Status</h2>
                            <button onClick={() => { setEditingAgentId(null); setAgentForm({ id: '', name: '', role: '', command: '', path: '', safeArgs: [], yoloArgs: [], restartPolicy: 'on-failure' }); setIsRegistryModalOpen(true); }} className="flex items-center gap-2 bg-google-blue hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors">
                                <Plus size={18} /> Add Agent
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {Object.entries(agentRegistry).map(([id, agent]: [string, AgentConfig]) => (
                                <div key={id} className="bg-dark-800 border border-dark-700 rounded-xl p-6 relative group">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="bg-dark-700 p-2 rounded-lg"><Terminal size={24} className="text-gray-300" /></div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => openEditAgent(id, agent)} className="p-1.5 text-gray-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100"><Edit3 size={14} /></button>
                                            <div className={`px-2 py-1 rounded text-xs font-bold uppercase ${agentStatus[id] === 'running' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{agentStatus[id] || 'STOPPED'}</div>
                                        </div>
                                    </div>
                                    <h3 className="text-lg font-bold text-white mb-1">{agent.name}</h3>
                                    <p className="text-sm text-gray-400 mb-4">{agent.role}</p>
                                    <div className="flex gap-2">
                                        {agentStatus[id] === 'running' ? (
                                            <button onClick={() => stopAgent(id)} className="flex-1 bg-dark-700 hover:bg-red-900/30 hover:text-red-400 text-gray-300 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"><Square size={14} fill="currentColor" /> Stop</button>
                                        ) : (
                                            <button onClick={() => startAgent(id)} className="flex-1 bg-white text-black hover:bg-gray-200 py-2 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2"><Play size={14} fill="currentColor" /> Start</button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        {(queueStatus.activeTasks.length > 0 || queueStatus.queue.length > 0) && (
                            <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 shadow-xl animate-in fade-in slide-in-from-bottom-4">
                                <div className="flex justify-between items-center mb-4"><div className="flex items-center gap-2 text-white font-bold"><Workflow className="text-google-blue" size={20} /><h3>Command Queue</h3></div></div>
                                <div className="bg-dark-900 rounded-lg p-4 border border-dark-700 max-h-[300px] overflow-y-auto">{renderTaskTree()}</div>
                            </div>
                        )}
                        <div><h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">Recent Logs</h3>{renderLogs()}</div>
                    </div>
                )}

                {activeTab === 'chat' && (
                    <div className="max-w-4xl mx-auto h-full flex flex-col">
                        <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-2">
                            {chatHistory.map((msg) => (
                                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] rounded-2xl px-5 py-3 ${msg.role === 'user' ? 'bg-google-blue text-white rounded-br-none' : 'bg-dark-800 text-gray-100 border border-dark-700 rounded-bl-none'}`}>
                                        <div className="prose prose-invert text-sm max-w-none">{msg.content.split('\n').map((line, i) => <p key={i} className="mb-1 last:mb-0">{line}</p>)}</div>
                                        {msg.modelUsed && <div className="text-[10px] opacity-50 mt-2 flex items-center gap-1"><Bot size={10} /> {msg.modelUsed}</div>}
                                    </div>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>
                        <div className="bg-dark-800 p-4 rounded-xl border border-dark-700 flex gap-4">
                            <select value={selectedChatModel} onChange={(e) => setSelectedChatModel(e.target.value)} className="bg-dark-900 border border-dark-700 text-gray-300 text-sm rounded-lg px-3 focus:outline-none focus:border-google-blue">
                                {availableModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                            <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()} placeholder="Ask the swarm..." className="flex-1 bg-dark-900 border-none text-white rounded-lg px-4 focus:ring-1 focus:ring-google-blue" />
                            <button onClick={sendChatMessage} disabled={!chatInput.trim()} className="bg-google-blue hover:bg-blue-600 disabled:opacity-50 text-white p-2 rounded-lg transition-colors"><Send size={20} /></button>
                        </div>
                    </div>
                )}

                {activeTab === 'war-room' && (
                    <div className="max-w-7xl mx-auto h-full flex flex-col space-y-6">
                        <div className="flex items-center gap-3 mb-2">
                             <div className="bg-purple-600 p-2 rounded-lg"><Swords size={24} className="text-white"/></div>
                             <div><h2 className="text-2xl font-bold text-white">Council War Room</h2><p className="text-gray-400 text-sm">Multi-Model Consensus</p></div>
                        </div>
                        <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
                            <div className="mb-4">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Council Members (The Debate Team)</label>
                                <div className="flex flex-wrap gap-4 mb-6">
                                    {availableModels.map(model => (
                                        <label key={model.id} className={`flex items-center gap-2 cursor-pointer bg-dark-900 border px-4 py-2 rounded-lg transition-colors ${selectedCouncilModels[model.id] ? 'border-google-blue bg-google-blue/10' : 'border-dark-700'}`}>
                                            <input type="checkbox" checked={!!selectedCouncilModels[model.id]} onChange={() => setSelectedCouncilModels(prev => ({...prev, [model.id]: !prev[model.id]}))} className="accent-google-blue w-4 h-4"/>
                                            <span className="text-sm font-medium">{model.name}</span>
                                        </label>
                                    ))}
                                </div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block flex items-center gap-2"><Gavel size={14}/> The Judge (Consensus Synthesizer)</label>
                                <select value={selectedSynthesizer} onChange={(e) => setSelectedSynthesizer(e.target.value)} className="bg-dark-900 border border-dark-700 text-white text-sm rounded-lg px-4 py-2 focus:outline-none focus:border-google-blue w-full max-w-xs mb-4">
                                    {availableModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </div>
                            <div className="relative">
                                <textarea value={councilInput} onChange={(e) => setCouncilInput(e.target.value)} placeholder="Describe the problem for the council to debate..." className="w-full bg-dark-900 border border-dark-700 rounded-xl p-4 text-white focus:border-google-blue outline-none min-h-[120px] font-mono text-sm" />
                                <button onClick={conveneCouncil} disabled={isCouncilWorking || !councilInput.trim()} className="absolute bottom-4 right-4 bg-google-blue hover:bg-blue-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors">
                                    {isCouncilWorking ? <Loader2 className="animate-spin" size={16}/> : <Swords size={16} />} Convene Council
                                </button>
                            </div>
                        </div>
                        {councilResults && (
                            <div className="space-y-6">
                                <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
                                    {Object.entries(councilResults.individual_responses).map(([modelId, response]) => (
                                        <div key={modelId} className="bg-dark-800 border border-dark-700 rounded-xl p-4 flex flex-col h-96">
                                            <div className="font-bold text-sm uppercase text-gray-300 mb-2 border-b border-dark-700 pb-2">{availableModels.find(m => m.id === modelId)?.name || modelId}</div>
                                            <div className="flex-1 overflow-y-auto whitespace-pre-wrap text-xs text-gray-400 font-mono">{response}</div>
                                        </div>
                                    ))}
                                </div>
                                <div className="bg-gradient-to-r from-google-blue/10 to-purple-600/10 border border-google-blue/30 rounded-xl p-8 relative overflow-hidden">
                                    <div className="relative z-10">
                                        <h3 className="text-xl font-bold text-white mb-4">Consensus Verdict</h3>
                                        <div className="prose prose-invert max-w-none text-gray-200 text-sm">{councilResults.consensus}</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                
                {activeTab === 'qa' && (
                    <div className="max-w-6xl mx-auto space-y-6">
                        <div className="flex items-center gap-3 mb-2">
                             <div className="bg-green-600 p-2 rounded-lg"><CheckCircle size={24} className="text-white"/></div>
                             <div><h2 className="text-2xl font-bold text-white">Quality Assurance</h2><p className="text-gray-400 text-sm">Automated Audits & Logs</p></div>
                        </div>
                        <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
                            <div className="flex justify-between items-start mb-6">
                                <div><h3 className="text-lg font-bold text-white flex items-center gap-2"><Eye className="text-google-blue" size={20} /> Visual Sentinel</h3><p className="text-sm text-gray-400 mt-1">Automated regression testing via headless browser.</p></div>
                                <button onClick={runVisualAudit} disabled={isAuditRunning} className="bg-dark-700 hover:bg-dark-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors disabled:opacity-50">
                                    {isAuditRunning ? <Loader2 className="animate-spin" size={16}/> : <Play size={16} fill="currentColor"/>} Run Visual Audit
                                </button>
                            </div>
                            {visualResult && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4">
                                    <div className="bg-dark-900 border border-dark-700 rounded-lg p-4">
                                        <div className="flex justify-between items-center mb-2"><span className="text-xs font-bold text-gray-400 uppercase">Desktop View</span><a href={visualResult.desktop} target="_blank" rel="noreferrer" className="text-xs text-google-blue hover:underline">Full Image</a></div>
                                        <div className="relative aspect-video bg-black rounded overflow-hidden border border-dark-700"><img src={visualResult.desktop} alt="Desktop" className="w-full h-full object-contain" /></div>
                                    </div>
                                    <div className="bg-dark-900 border border-dark-700 rounded-lg p-4">
                                        <div className="flex justify-between items-center mb-2"><span className="text-xs font-bold text-gray-400 uppercase">Mobile View</span><a href={visualResult.mobile} target="_blank" rel="noreferrer" className="text-xs text-google-blue hover:underline">Full Image</a></div>
                                        <div className="relative aspect-[375/667] bg-black rounded overflow-hidden border border-dark-700 max-h-[300px] mx-auto"><img src={visualResult.mobile} alt="Mobile" className="w-full h-full object-contain" /></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Registry Manager Modal */}
            {isRegistryModalOpen && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-dark-800 border border-dark-700 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-dark-700 flex justify-between items-center bg-dark-800">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2"><Settings className="text-google-blue" size={20} /> Registry Manager</h3>
                                <p className="text-sm text-gray-500 mt-1">Configure operational agents for the mission control.</p>
                            </div>
                            <button onClick={() => setIsRegistryModalOpen(false)} className="text-gray-500 hover:text-white transition-colors"><X size={24} /></button>
                        </div>

                        <div className="flex-1 overflow-auto p-6 flex gap-8">
                            {/* Agent List */}
                            <div className="w-1/3 border-r border-dark-700 pr-6 space-y-2">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Active Agents</span>
                                    <button 
                                        onClick={() => { setEditingAgentId(null); setAgentForm({ id: '', name: '', role: '', command: '', path: '', safeArgs: [], yoloArgs: [], restartPolicy: 'on-failure' }); }} 
                                        className="text-google-blue hover:text-blue-400 p-1 rounded-full transition-colors"
                                    >
                                        <Plus size={18} />
                                    </button>
                                </div>
                                {Object.entries(agentRegistry).map(([id, config]: [string, AgentConfig]) => (
                                    <button 
                                        key={id} 
                                        onClick={() => openEditAgent(id, config)}
                                        className={`w-full text-left p-3 rounded-lg transition-all flex items-center justify-between group ${editingAgentId === id ? 'bg-google-blue text-white' : 'bg-dark-700/50 hover:bg-dark-700 text-gray-300'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full ${agentStatus[id] === 'running' ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`}></div>
                                            <span className="font-medium truncate">{config.name}</span>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Trash2 
                                                size={14} 
                                                className="hover:text-google-red cursor-pointer" 
                                                onClick={(e) => { e.stopPropagation(); deleteAgentConfig(id); }} 
                                            />
                                            <ChevronRight size={14} />
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {/* Edit Form */}
                            <div className="flex-1 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Identifier (ID)</label>
                                        <input type="text" value={agentForm.id} disabled={!!editingAgentId} onChange={e => setAgentForm(p => ({...p, id: e.target.value}))} className="w-full bg-dark-900 border border-dark-700 rounded-lg p-2 text-white outline-none focus:border-google-blue text-sm disabled:opacity-50" placeholder="design-agent" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Agent Name</label>
                                        <input type="text" value={agentForm.name} onChange={e => setAgentForm(p => ({...p, name: e.target.value}))} className="w-full bg-dark-900 border border-dark-700 rounded-lg p-2 text-white outline-none focus:border-google-blue text-sm" placeholder="UI Design Bot" />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Role</label>
                                    <input type="text" value={agentForm.role} onChange={e => setAgentForm(p => ({...p, role: e.target.value}))} className="w-full bg-dark-900 border border-dark-700 rounded-lg p-2 text-white outline-none focus:border-google-blue text-sm" placeholder="Manages styling and components" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Command</label>
                                        <input type="text" value={agentForm.command} onChange={e => setAgentForm(p => ({...p, command: e.target.value}))} className="w-full bg-dark-900 border border-dark-700 rounded-lg p-2 text-white outline-none focus:border-google-blue text-sm font-mono" placeholder="claude" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Working Dir (Path)</label>
                                        <input type="text" value={agentForm.path} onChange={e => setAgentForm(p => ({...p, path: e.target.value}))} className="w-full bg-dark-900 border border-dark-700 rounded-lg p-2 text-white outline-none focus:border-google-blue text-sm font-mono" placeholder="/home/user/project" />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Safe Args (Comma separated)</label>
                                    <input type="text" value={agentForm.safeArgs?.join(', ')} onChange={e => setAgentForm(p => ({...p, safeArgs: e.target.value.split(',').map(s => s.trim()).filter(Boolean)}))} className="w-full bg-dark-900 border border-dark-700 rounded-lg p-2 text-white outline-none focus:border-google-blue text-sm font-mono" placeholder="--chrome" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">YOLO Args (Comma separated)</label>
                                    <input type="text" value={agentForm.yoloArgs?.join(', ')} onChange={e => setAgentForm(p => ({...p, yoloArgs: e.target.value.split(',').map(s => s.trim()).filter(Boolean)}))} className="w-full bg-dark-900 border border-dark-700 rounded-lg p-2 text-white outline-none focus:border-google-blue text-sm font-mono" placeholder="--chrome, --skip-permissions" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Restart Policy</label>
                                    <select value={agentForm.restartPolicy} onChange={e => setAgentForm(p => ({...p, restartPolicy: e.target.value}))} className="w-full bg-dark-900 border border-dark-700 rounded-lg p-2 text-white outline-none focus:border-google-blue text-sm">
                                        <option value="on-failure">On Failure</option>
                                        <option value="always">Always</option>
                                        <option value="never">Never</option>
                                    </select>
                                </div>
                                <div className="flex justify-end gap-2 pt-4">
                                    <button onClick={saveAgentConfig} className="bg-google-blue hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors"><Save size={16} /> Save Config</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;