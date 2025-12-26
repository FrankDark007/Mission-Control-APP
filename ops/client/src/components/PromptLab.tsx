
import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, Tag, Clock, Code, Copy, Trash2, Edit3, Save, ChevronRight, Hash, Star, Layers, Search } from 'lucide-react';

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

    useEffect(() => {
        fetch('/api/prompts').then(r => r.json()).then(setPrompts);
    }, []);

    const savePrompt = async () => {
        if (!newPrompt.name || !newPrompt.content) return;
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
                <div className="bg-dark-800 p-10 rounded-[2.5rem] border border-google-blue/30 shadow-2xl space-y-8 animate-in slide-in-from-top-4">
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
                        <button onClick={savePrompt} className="bg-google-green text-dark-900 px-8 py-3 rounded-xl font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg">Commit Strategy</button>
                        <button onClick={() => setIsAdding(false)} className="text-gray-500 px-8 py-3 rounded-xl font-black uppercase tracking-widest">Abort</button>
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
