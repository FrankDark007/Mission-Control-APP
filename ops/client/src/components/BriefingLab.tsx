
import React, { useState, useEffect } from 'react';
import { Loader2, Radio, Sparkles, MessageSquare, FileText, ChevronDown, Bot, Inbox, Clock, AlertCircle } from 'lucide-react';

interface AIModel {
    id: string;
    name: string;
    provider: string;
    capabilities?: string[];
}

interface PendingTask {
    id: string;
    title: string;
    status: string;
    createdAt: string;
    createdByModel: string;
}

const BriefingLab = () => {
    const [topic, setTopic] = useState('');
    const [briefing, setBriefing] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    // Model selection
    const [models, setModels] = useState<AIModel[]>([]);
    const [selectedModel, setSelectedModel] = useState<string>('gemini-3-pro');
    const [showModelDropdown, setShowModelDropdown] = useState(false);

    // Pending tasks created by Director
    const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);

    // Fetch available models
    useEffect(() => {
        fetch('/api/projects/director-models')
            .then(res => res.json())
            .then(data => {
                if (data.models) {
                    setModels(data.models);
                }
            })
            .catch(err => console.error('Failed to fetch models:', err));

        // Fetch pending tasks
        fetch('/api/claude/inbox')
            .then(res => res.json())
            .then(data => {
                if (data.tasks) {
                    setPendingTasks(data.tasks.filter((t: PendingTask) => t.status === 'pending').slice(0, 5));
                }
            })
            .catch(err => console.error('Failed to fetch tasks:', err));
    }, []);

    const generateBriefing = async () => {
        if (!topic.trim()) return;
        setIsGenerating(true);
        try {
            const res = await fetch('/api/briefing/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic, model: selectedModel })
            });
            const data = await res.json();
            setBriefing(data.briefing);
        } catch (e) {
            console.error(e);
        } finally {
            setIsGenerating(false);
        }
    };

    const selectedModelData = models.find(m => m.id === selectedModel);

    return (
        <div className="space-y-10 animate-in fade-in duration-500">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-4xl font-black text-white tracking-tighter mb-1">Mission Briefing</h2>
                    <p className="text-sm text-gray-500 font-medium">Generate tactical mission summaries and intelligence reports.</p>
                </div>
                <div className="flex items-center gap-3 bg-dark-800 px-6 py-3 rounded-2xl border border-dark-700">
                    <Radio className="text-google-red animate-pulse" size={18} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white">Intel Active</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="space-y-8">
                    <div className="bg-dark-800 p-10 rounded-[2.5rem] border border-dark-700 shadow-2xl space-y-8">
                        {/* Model Selector */}
                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                                <Bot size={12} className="text-google-green" /> AI Model
                            </label>
                            <div className="relative">
                                <button
                                    onClick={() => setShowModelDropdown(!showModelDropdown)}
                                    className="w-full bg-dark-900 border border-dark-700 p-4 rounded-2xl flex items-center justify-between text-left hover:border-google-blue transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-google-blue/20 rounded-lg flex items-center justify-center">
                                            <Bot size={16} className="text-google-blue" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-white">
                                                {selectedModelData?.name || selectedModel}
                                            </div>
                                            <div className="text-[10px] text-gray-500">
                                                {selectedModelData?.provider || 'AI Provider'}
                                            </div>
                                        </div>
                                    </div>
                                    <ChevronDown size={16} className={`text-gray-400 transition-transform ${showModelDropdown ? 'rotate-180' : ''}`} />
                                </button>

                                {showModelDropdown && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-dark-800 border border-dark-600 rounded-2xl shadow-xl z-50 overflow-hidden max-h-64 overflow-y-auto">
                                        {models.map(model => (
                                            <button
                                                key={model.id}
                                                onClick={() => {
                                                    setSelectedModel(model.id);
                                                    setShowModelDropdown(false);
                                                }}
                                                className={`w-full p-4 flex items-center gap-3 hover:bg-dark-700 transition-colors ${
                                                    selectedModel === model.id ? 'bg-google-blue/10 border-l-2 border-google-blue' : ''
                                                }`}
                                            >
                                                <div className="w-8 h-8 bg-dark-600 rounded-lg flex items-center justify-center">
                                                    <Bot size={14} className="text-gray-400" />
                                                </div>
                                                <div className="text-left">
                                                    <div className="text-sm font-medium text-white">{model.name}</div>
                                                    <div className="text-[10px] text-gray-500">{model.provider}</div>
                                                </div>
                                            </button>
                                        ))}
                                        {models.length === 0 && (
                                            <div className="p-4 text-center text-gray-500 text-sm">
                                                Loading models...
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Briefing Input */}
                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                                <MessageSquare size={12} className="text-google-blue" /> Briefing Objective
                            </label>
                            <div className="relative">
                                <input
                                    value={topic}
                                    onChange={(e) => setTopic(e.target.value)}
                                    placeholder="e.g. Current Swarm health and deployment status"
                                    className="w-full bg-dark-900 border border-dark-700 p-6 rounded-3xl focus:border-google-blue outline-none text-sm text-white shadow-inner"
                                />
                                <button
                                    onClick={generateBriefing}
                                    disabled={isGenerating || !topic.trim()}
                                    className="absolute right-3 top-3 p-3 bg-google-blue text-white rounded-2xl shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                                </button>
                            </div>
                        </div>

                        <div className="p-6 bg-dark-900 rounded-3xl border border-dark-700 space-y-2">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-google-blue" />
                                <span className="text-[10px] font-black uppercase text-gray-400">Format</span>
                            </div>
                            <div className="text-sm font-bold text-white">Military-Style SMEAC</div>
                            <div className="text-[9px] text-gray-600 font-black uppercase">Situation, Mission, Execution, Admin, Command</div>
                        </div>
                    </div>

                    {/* Pending Tasks Widget */}
                    {pendingTasks.length > 0 && (
                        <div className="bg-dark-800 p-6 rounded-2xl border border-orange-500/30 space-y-4">
                            <div className="flex items-center gap-2">
                                <AlertCircle size={16} className="text-orange-400" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-orange-400">
                                    {pendingTasks.length} Pending Task{pendingTasks.length > 1 ? 's' : ''}
                                </span>
                            </div>
                            <div className="space-y-2">
                                {pendingTasks.slice(0, 3).map(task => (
                                    <div key={task.id} className="flex items-center gap-3 p-3 bg-dark-900 rounded-xl">
                                        <Clock size={14} className="text-gray-500" />
                                        <span className="text-xs text-gray-300 truncate flex-1">{task.title}</span>
                                        <span className="text-[9px] text-gray-500">{task.createdByModel}</span>
                                    </div>
                                ))}
                            </div>
                            <p className="text-[10px] text-gray-500">
                                Director created tasks awaiting Claude Code execution
                            </p>
                        </div>
                    )}
                </div>

                <div className="space-y-8">
                    {briefing ? (
                        <div className="bg-dark-800 rounded-[2.5rem] border border-google-blue/30 shadow-2xl overflow-hidden flex flex-col h-full animate-in slide-in-from-right-4">
                            <div className="p-8 border-b border-dark-700 flex justify-between items-center bg-google-blue/5">
                                <div className="flex items-center gap-4">
                                    <span className="p-2 bg-google-blue/10 rounded-lg text-google-blue"><FileText size={24} /></span>
                                    <h3 className="text-xl font-black text-white">Intelligence Report</h3>
                                </div>
                                <div className="text-[10px] text-gray-500 font-medium">
                                    via {selectedModelData?.name || selectedModel}
                                </div>
                            </div>
                            <div className="p-10 flex-1 overflow-y-auto max-h-[500px]">
                                <div className="prose prose-invert prose-sm max-w-none">
                                    <pre className="whitespace-pre-wrap font-sans text-sm text-gray-300 leading-relaxed">{briefing}</pre>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full border-2 border-dashed border-dark-800 rounded-[2.5rem] flex flex-col items-center justify-center text-center p-20 opacity-20">
                            <FileText size={64} className="mb-6" />
                            <p className="text-xs font-black uppercase tracking-[0.3em]">Briefing Matrix Ready</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BriefingLab;
