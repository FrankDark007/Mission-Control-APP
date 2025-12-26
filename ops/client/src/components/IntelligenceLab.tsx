
import React, { useState, useEffect } from 'react';
import { BrainCircuit, Plus, Database, ShieldCheck, Trash2, Edit3, Sparkles, Link2, Search, Filter } from 'lucide-react';
import { ProjectFact } from '../types';

const IntelligenceLab = () => {
    const [facts, setFacts] = useState<ProjectFact[]>([]);
    const [newFact, setNewFact] = useState({ title: '', content: '', category: 'rule' as any, agentAffinities: [] as string[] });
    const [isAdding, setIsAdding] = useState(false);
    const [filter, setFilter] = useState<'all' | 'rule' | 'knowledge' | 'tech'>('all');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetch('/api/facts').then(r => r.json()).then(setFacts);
    }, []);

    const addFact = async () => {
        if (!newFact.title || !newFact.content) return;
        const res = await fetch('/api/facts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newFact)
        });
        const data = await res.json();
        setFacts([...facts, data]);
        setIsAdding(false);
        setNewFact({ title: '', content: '', category: 'rule', agentAffinities: [] });
    };

    const toggleAffinity = (agentId: string) => {
        setNewFact(prev => ({
            ...prev,
            agentAffinities: prev.agentAffinities.includes(agentId) 
                ? prev.agentAffinities.filter(id => id !== agentId)
                : [...prev.agentAffinities, agentId]
        }));
    };

    const filteredFacts = facts.filter(f => {
        const matchesCategory = filter === 'all' || f.category === filter;
        const matchesSearch = f.title.toLowerCase().includes(searchTerm.toLowerCase()) || f.content.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    return (
        <div className="space-y-10 animate-in fade-in duration-500 pb-20">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-4xl font-black text-white tracking-tighter mb-1 uppercase">Grounding Intelligence</h2>
                    <p className="text-sm text-gray-500 font-medium">Core grounding data and tactical knowledge registry for the neural swarm.</p>
                </div>
                <div className="flex gap-4">
                    <div className="relative">
                        <Search className="absolute left-4 top-3.5 text-gray-600" size={16} />
                        <input 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search Knowledge..."
                            className="bg-dark-800 border border-dark-700 pl-12 pr-6 py-3 rounded-2xl text-xs text-white outline-none focus:border-google-blue w-64 shadow-xl"
                        />
                    </div>
                    <button onClick={() => setIsAdding(true)} className="bg-google-blue text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest shadow-lg flex items-center gap-2 hover:scale-105 transition-all">
                        <Plus size={18} /> Register Fact
                    </button>
                </div>
            </div>

            <div className="flex gap-2 p-1 bg-dark-800 rounded-2xl border border-dark-700 w-fit">
                {['all', 'rule', 'knowledge', 'tech'].map(cat => (
                    <button 
                        key={cat}
                        onClick={() => setFilter(cat as any)}
                        className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${filter === cat ? 'bg-google-blue text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {isAdding && (
                <div className="bg-dark-800 p-10 rounded-[2.5rem] border border-google-blue/30 shadow-2xl space-y-8 animate-in slide-in-from-top-4">
                    <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Fact Title</label>
                            <input value={newFact.title} onChange={e => setNewFact({...newFact, title: e.target.value})} className="w-full bg-dark-900 border border-dark-700 p-5 rounded-2xl focus:border-google-blue outline-none text-sm text-white shadow-inner" placeholder="e.g., Tactical Design Constraints" />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Classification</label>
                            <select value={newFact.category} onChange={e => setNewFact({...newFact, category: e.target.value as any})} className="w-full bg-dark-900 border border-dark-700 p-5 rounded-2xl focus:border-google-blue outline-none text-sm text-white shadow-inner">
                                <option value="rule">Tactical Rule</option>
                                <option value="knowledge">Project Knowledge</option>
                                <option value="tech">Tech Stack Constant</option>
                            </select>
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2"><Link2 size={12} /> Swarm Core Affinity</label>
                        <div className="flex gap-4">
                            {['design', 'seo'].map(agentId => (
                                <button 
                                    key={agentId}
                                    onClick={() => toggleAffinity(agentId)}
                                    className={`px-6 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${newFact.agentAffinities.includes(agentId) ? 'bg-google-blue border-google-blue text-white shadow-lg' : 'bg-dark-900 border-dark-700 text-gray-500 hover:border-dark-600'}`}
                                >
                                    {agentId} Scope
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Contextual Payload</label>
                        <textarea value={newFact.content} onChange={e => setNewFact({...newFact, content: e.target.value})} className="w-full bg-dark-900 border border-dark-700 p-6 rounded-3xl focus:border-google-blue outline-none text-sm text-white h-48 resize-none shadow-inner" placeholder="Provide complete grounding data..." />
                    </div>
                    <div className="flex gap-4">
                        <button onClick={addFact} className="bg-google-green text-dark-900 px-10 py-4 rounded-2xl font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl">Commit Grounding</button>
                        <button onClick={() => setIsAdding(false)} className="text-gray-500 px-10 py-4 rounded-2xl font-black uppercase tracking-widest hover:text-white transition-all">Abort</button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredFacts.map(fact => (
                    <div key={fact.id} className="bg-dark-800 p-8 rounded-[2.5rem] border border-dark-700 shadow-xl group hover:border-google-blue/30 transition-all flex flex-col h-full relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-google-blue/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-google-blue/10 transition-colors" />
                        
                        <div className="flex justify-between items-start mb-6 relative z-10">
                            <div className={`p-4 rounded-2xl shadow-lg ${fact.category === 'rule' ? 'bg-google-red/10 text-google-red' : fact.category === 'tech' ? 'bg-google-blue/10 text-google-blue' : 'bg-google-yellow/10 text-google-yellow'}`}>
                                {fact.category === 'rule' ? <ShieldCheck size={24} /> : fact.category === 'tech' ? <Database size={24} /> : <Sparkles size={24} />}
                            </div>
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 bg-dark-900 px-3 py-1 rounded-full">{fact.category}</span>
                        </div>
                        
                        <h3 className="text-xl font-black text-white mb-3 relative z-10">{fact.title}</h3>
                        <p className="text-sm text-gray-400 leading-relaxed mb-6 flex-1 line-clamp-6 font-medium relative z-10">{fact.content}</p>
                        
                        {(fact as any).agentAffinities?.length > 0 && (
                            <div className="mb-6 flex flex-wrap gap-2 relative z-10">
                                {(fact as any).agentAffinities.map((aff: string) => (
                                    <span key={aff} className="px-3 py-1 bg-dark-900/50 border border-dark-700 rounded-lg text-[8px] font-black uppercase text-google-blue tracking-tighter shadow-sm">
                                        LINKED: {aff}
                                    </span>
                                ))}
                            </div>
                        )}

                        <div className="pt-6 border-t border-dark-700 flex justify-between items-center opacity-40 group-hover:opacity-100 transition-opacity relative z-10">
                            <div className="text-[10px] text-gray-600 font-mono flex items-center gap-2">
                                <BrainCircuit size={12} /> ID: {fact.id}
                            </div>
                            <div className="flex gap-2">
                                <button className="p-2 text-gray-500 hover:text-google-blue transition-colors"><Edit3 size={16} /></button>
                                <button className="p-2 text-gray-500 hover:text-google-red transition-colors"><Trash2 size={16} /></button>
                            </div>
                        </div>
                    </div>
                ))}
                
                {filteredFacts.length === 0 && (
                    <div className="lg:col-span-3 py-40 border-2 border-dashed border-dark-800 rounded-[3rem] text-center opacity-10 flex flex-col items-center justify-center">
                        <Database size={64} className="mb-6" />
                        <p className="text-lg font-black uppercase tracking-widest">Knowledge Registry Empty</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default IntelligenceLab;
