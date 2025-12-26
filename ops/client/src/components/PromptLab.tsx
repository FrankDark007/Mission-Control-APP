
import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, Tag, Clock, Code, Copy, Trash2, Edit3, Save, ChevronRight, Hash, Star, Layers, Search, ShieldCheck, AlertCircle } from 'lucide-react';
import { qualityGate } from '../services/qualityGate';

interface PromptDefinition {
    id: string;
    name: string;
    content: string;
    version: number;
    tags: string[];
    timestamp: number;
}

const PromptLab = () => {
    const [prompts, setPrompts] = useState<PromptDefinition[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [newPrompt, setNewPrompt] = useState({ name: '', content: '', tags: [] as string[] });
    const [qualityReport, setQualityReport] = useState<any>(null);

    useEffect(() => {
        fetch('/api/prompts').then(r => r.json()).then(setPrompts);
    }, []);

    useEffect(() => {
        if (newPrompt.content) {
            const timer = setTimeout(async () => {
                const report = await qualityGate.analyze(newPrompt.content);
                setQualityReport(report);
            }, 500);
            return () => clearTimeout(timer);
        } else {
            setQualityReport(null);
        }
    }, [newPrompt.content]);

    const savePrompt = async () => {
        if (!newPrompt.name || !newPrompt.content) return;
        if (qualityReport?.status === 'failed') {
            alert("Quality Gate Refused: Fix critical grammar/clarity issues before committing.");
            return;
        }
        const res = await fetch('/api/prompts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newPrompt)
        });
        const saved = await res.json();
        setPrompts([saved, ...prompts]);
        setIsAdding(false);
        setNewPrompt({ name: '', content: '', tags: [] });
    };

    const filteredPrompts = prompts.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="space-y-10 animate-in fade-in duration-500 pb-20">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-4xl font-black text-white tracking-tighter mb-1 uppercase">Strategy Room</h2>
                    <p className="text-sm text-gray-500 font-medium">Versioned prompt registry and agent behavioral templates.</p>
                </div>
                <div className="flex gap-4">
                    <div className="relative group">
                        <Search className="absolute left-4 top-3.5 text-gray-600 group-focus-within:text-google-blue transition-colors" size={16} />
                        <input 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Search Strategies..."
                            className="bg-dark-800 border border-dark-700 pl-12 pr-6 py-3 rounded-2xl text-xs text-white outline-none focus:border-google-blue w-64 shadow-xl"
                        />
                    </div>
                    <button 
                        onClick={() => setIsAdding(true)}
                        className="bg-google-blue text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center gap-2 hover:scale-105 transition-all"
                    >
                        <Plus size={18} /> Register Strategy
                    </button>
                </div>
            </div>

            {isAdding && (
                <div className="bg-dark-800 p-10 rounded-[2.5rem] border border-google-blue/30 shadow-2xl space-y-8 animate-in slide-in-from-top-4 grid grid-cols-1 lg:grid-cols-3 gap-10">
                    <div className="lg:col-span-2 space-y-8">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Strategy Name</label>
                            <input 
                                value={newPrompt.name}
                                onChange={e => setNewPrompt({...newPrompt, name: e.target.value})}
                                className="w-full bg-dark-900 border border-dark-700 p-4 rounded-xl focus:border-google-blue outline-none text-sm text-white" 
                                placeholder="e.g., Tactical UI Reviewer" 
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Neural Payload</label>
                            <textarea 
                                value={newPrompt.content}
                                onChange={e => setNewPrompt({...newPrompt, content: e.target.value})}
                                className="w-full bg-dark-900 border border-dark-700 p-6 rounded-3xl focus:border-google-blue outline-none text-[11px] font-mono text-gray-400 h-64 resize-none shadow-inner"
                                placeholder="Enter the prompt content here. Use {{variable}} for dynamic injection..."
                            />
                        </div>
                        <div className="flex gap-4">
                            <button 
                                onClick={savePrompt} 
                                disabled={qualityReport?.status === 'failed'}
                                className={`px-8 py-3 rounded-xl font-black uppercase tracking-widest transition-all shadow-lg ${qualityReport?.status === 'failed' ? 'bg-dark-700 text-gray-500' : 'bg-google-green text-dark-900 hover:scale-105'}`}
                            >
                                Commit Strategy
                            </button>
                            <button onClick={() => setIsAdding(false)} className="text-gray-500 px-8 py-3 rounded-xl font-black uppercase tracking-widest">Abort</button>
                        </div>
                    </div>

                    <div className="lg:col-span-1 bg-dark-900 p-8 rounded-[2rem] border border-dark-700 flex flex-col gap-6">
                        <div className="flex items-center justify-between">
                            <h4 className="text-[10px] font-black uppercase text-gray-500 tracking-widest flex items-center gap-2">
                                <ShieldCheck className="text-google-blue" size={12} /> Grammarly Gate
                            </h4>
                            {qualityReport && (
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded ${qualityReport.status === 'passed' ? 'bg-google-green/10 text-google-green' : 'bg-google-red/10 text-google-red'}`}>
                                    Score: {qualityReport.score}%
                                </span>
                            )}
                        </div>

                        {qualityReport ? (
                            <div className="space-y-6">
                                <div className="space-y-3">
                                    {qualityReport.issues.map((issue: any, i: number) => (
                                        <div key={i} className="flex gap-3 p-4 bg-dark-800 border border-dark-700 rounded-xl">
                                            <AlertCircle className="text-google-red shrink-0" size={14} />
                                            <p className="text-[10px] text-gray-300 font-medium">[{issue.type.toUpperCase()}] {issue.msg}</p>
                                        </div>
                                    ))}
                                    {qualityReport.issues.length === 0 && (
                                        <div className="flex flex-col items-center justify-center py-10 opacity-30 text-center">
                                            <ShieldCheck size={40} className="text-google-green mb-2" />
                                            <p className="text-[10px] font-black uppercase tracking-widest">Quality Enforced</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 opacity-10">
                                <BookOpen size={48} />
                                <p className="text-[8px] font-black uppercase tracking-widest mt-4">Awaiting Input Analysis</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {filteredPrompts.map(prompt => (
                    <div key={prompt.id} className="bg-dark-800 rounded-[2rem] border border-dark-700 shadow-xl overflow-hidden group hover:border-google-blue/30 transition-all flex flex-col h-[400px]">
                        <div className="p-8 border-b border-dark-700 flex justify-between items-start bg-dark-900/20">
                            <div className="flex items-center gap-4">
                                <div className="p-4 bg-dark-900 rounded-2xl border border-dark-700 group-hover:border-google-blue/50 transition-colors">
                                    <BookOpen className="text-google-blue" size={24} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-1">{prompt.name}</h3>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-google-blue">v{prompt.version}.0</span>
                                        <span className="text-[9px] text-gray-600 font-mono">#{prompt.id}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button className="p-2 text-gray-600 hover:text-white"><Copy size={16} /></button>
                                <button className="p-2 text-gray-600 hover:text-white"><Edit3 size={16} /></button>
                                <button className="p-2 text-gray-600 hover:text-google-red"><Trash2 size={16} /></button>
                            </div>
                        </div>
                        <div className="p-8 flex-1 overflow-y-auto scrollbar-hide">
                            <pre className="text-[10px] font-mono text-gray-400 whitespace-pre-wrap leading-relaxed">
                                {prompt.content.split(/(\{\{.*?\}\})/).map((part, i) => 
                                    part.startsWith('{{') 
                                        ? <span key={i} className="text-google-yellow font-black">{part}</span> 
                                        : part
                                )}
                            </pre>
                        </div>
                        <div className="px-8 py-4 bg-dark-900/50 border-t border-dark-700 flex justify-between items-center">
                            <div className="flex gap-2">
                                {prompt.tags?.map(tag => (
                                    <span key={tag} className="px-2 py-0.5 bg-dark-800 border border-dark-700 rounded text-[8px] font-black uppercase text-gray-500">#{tag}</span>
                                ))}
                                {(!prompt.tags || prompt.tags.length === 0) && (
                                    <span className="text-[8px] font-black uppercase text-gray-700 italic">No Tags</span>
                                )}
                            </div>
                            <div className="text-[8px] font-black text-gray-600 uppercase tracking-widest flex items-center gap-2">
                                <Clock size={10} /> {new Date(prompt.timestamp).toLocaleDateString()}
                            </div>
                        </div>
                    </div>
                ))}

                {filteredPrompts.length === 0 && !isAdding && (
                    <div className="md:col-span-2 py-32 border-2 border-dashed border-dark-800 rounded-[3rem] text-center opacity-20">
                        <Layers size={64} className="mx-auto mb-6" />
                        <p className="text-sm font-black uppercase tracking-[0.3em]">Strategy Registry Empty</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PromptLab;
