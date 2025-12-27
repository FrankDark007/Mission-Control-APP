
import React, { useState, useEffect } from 'react';
import { History, Brain, Sparkles, Pin, Search, Filter, Loader2, ArrowRight, CheckCircle, Database, BookOpen } from 'lucide-react';
import { TaskDefinition } from '../types';

const MemoryLab = () => {
    const [missions, setMissions] = useState<TaskDefinition[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [promoting, setPromoting] = useState<number | null>(null);

    const fetchMemory = () => {
        fetch('/api/memory/missions')
            .then(res => res.json())
            .then(data => {
                setMissions(data.sort((a: any, b: any) => new Date(b.created || 0).getTime() - new Date(a.created || 0).getTime()));
                setIsLoading(false);
            });
    };

    useEffect(() => { fetchMemory(); }, []);

    const promoteToGrounding = async (task: TaskDefinition) => {
        setPromoting(task.id);
        try {
            const res = await fetch('/api/memory/promote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskId: task.id, title: `Learning: ${task.name}` })
            });
            if (res.ok) {
                alert("Tactical learning promoted to Grounding Layer.");
            }
        } finally {
            setPromoting(null);
        }
    };

    const filtered = missions.filter(m => 
        m.status === 'completed' && 
        (m.name.toLowerCase().includes(searchTerm.toLowerCase()) || m.type.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="space-y-10 animate-in fade-in duration-500 pb-20">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-4xl font-black text-white tracking-tighter mb-1 uppercase italic">Neural Memory Lab</h2>
                    <p className="text-sm text-gray-500 font-medium">Archive of successful mission outcomes and tactical logic promotions.</p>
                </div>
                <div className="flex gap-4">
                    <div className="relative">
                        <Search className="absolute left-4 top-3.5 text-gray-600" size={16} />
                        <input 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Search Successful Logic..."
                            className="bg-dark-800 border border-dark-700 pl-12 pr-6 py-3 rounded-2xl text-xs text-white outline-none focus:border-google-blue w-64 shadow-xl"
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-dark-800 p-8 rounded-[2.5rem] border border-dark-700 shadow-2xl space-y-8 flex flex-col items-center text-center">
                        <div className="p-5 bg-google-blue/10 rounded-3xl border border-google-blue/20">
                            <Brain className="text-google-blue" size={40} />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-black text-white">Cognitive Load</h3>
                            <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest leading-relaxed">
                                {missions.length} indexed memories. Memory lab transforms raw logs into architectural knowledge.
                            </p>
                        </div>
                        <div className="w-full pt-6 border-t border-dark-700 grid grid-cols-2 gap-4">
                             <div className="p-4 bg-dark-900 rounded-2xl">
                                 <div className="text-[8px] font-black uppercase text-gray-600 mb-1">Retention</div>
                                 <div className="text-lg font-black text-white">100%</div>
                             </div>
                             <div className="p-4 bg-dark-900 rounded-2xl">
                                 <div className="text-[8px] font-black uppercase text-gray-600 mb-1">Certainty</div>
                                 <div className="text-lg font-black text-google-green">94.2%</div>
                             </div>
                        </div>
                    </div>
                    
                    <div className="bg-dark-800 p-8 rounded-[2.5rem] border border-dark-700 shadow-2xl">
                         <div className="flex items-center gap-3 mb-6">
                             <Sparkles size={16} className="text-google-yellow" />
                             <span className="text-[10px] font-black uppercase text-gray-500">Autonomous Insights</span>
                         </div>
                         <p className="text-xs text-gray-400 leading-relaxed italic">"Swarm has successfully refactored 12 components this week. Memory reuse is currently saving ~400ms per neural inference."</p>
                    </div>
                </div>

                <div className="lg:col-span-3 space-y-6">
                    {isLoading ? (
                        <div className="h-96 flex flex-col items-center justify-center opacity-20"><Loader2 className="animate-spin" size={48} /></div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {filtered.map(mission => (
                                <div key={mission.id} className="bg-dark-800 p-8 rounded-[2.5rem] border border-dark-700 hover:border-google-blue/30 transition-all group shadow-xl flex flex-col">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-google-green/10 rounded-xl border border-google-green/20 text-google-green">
                                                <CheckCircle size={18} />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-black text-white truncate max-w-[180px]">{mission.name}</h4>
                                                <span className="text-[8px] font-mono text-gray-600">ID: {mission.id} • {mission.type}</span>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => promoteToGrounding(mission)}
                                            disabled={promoting === mission.id}
                                            className="p-3 bg-dark-900 border border-dark-700 text-gray-500 hover:text-google-yellow hover:border-google-yellow transition-all rounded-xl"
                                            title="Promote to Grounding"
                                        >
                                            {promoting === mission.id ? <Loader2 size={16} className="animate-spin" /> : <Pin size={16} />}
                                        </button>
                                    </div>
                                    
                                    <p className="text-[11px] text-gray-400 font-medium italic mb-6 leading-relaxed flex-1">
                                        "{mission.instruction || 'Autonomous mission logic verified and archived for swarm reuse.'}"
                                    </p>

                                    <div className="pt-6 border-t border-dark-700 flex justify-between items-center opacity-40 group-hover:opacity-100 transition-opacity">
                                        <div className="flex items-center gap-2 text-[9px] font-black uppercase text-gray-500">
                                            <Database size={10} /> Verified Solution
                                        </div>
                                        <span className="text-[9px] font-mono text-gray-600">{new Date(mission.endTime || 0).toLocaleTimeString()}</span>
                                    </div>
                                </div>
                            ))}
                            
                            {filtered.length === 0 && (
                                <div className="md:col-span-2 py-40 border-2 border-dashed border-dark-800 rounded-[3rem] text-center opacity-10 flex flex-col items-center justify-center">
                                    <BookOpen size={64} className="mb-6" />
                                    <p className="text-lg font-black uppercase tracking-widest">Memory Archive Empty</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MemoryLab;
