
import React, { useState, useEffect } from 'react';
import { ListTree, Plus, Play, Trash2, ChevronRight, Zap, Loader2, Save, Sparkles, Bot, Settings2 } from 'lucide-react';

interface ProtocolStep {
    agentId: string;
    taskName: string;
    instruction: string;
}

interface Protocol {
    id: string;
    name: string;
    steps: ProtocolStep[];
    timestamp: number;
}

const ProtocolLab = () => {
    const [protocols, setProtocols] = useState<Protocol[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [newProto, setNewProto] = useState({ name: '', steps: [] as ProtocolStep[] });
    const [isLoading, setIsLoading] = useState(true);
    const [isExecuting, setIsExecuting] = useState<string | null>(null);

    const fetchProtocols = async () => {
        try {
            const res = await fetch('/api/protocols');
            const data = await res.json();
            setProtocols(data);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchProtocols();
    }, []);

    const addStep = () => {
        setNewProto({
            ...newProto,
            steps: [...newProto.steps, { agentId: 'design', taskName: '', instruction: '' }]
        });
    };

    const updateStep = (index: number, field: keyof ProtocolStep, value: string) => {
        const steps = [...newProto.steps];
        steps[index] = { ...steps[index], [field]: value };
        setNewProto({ ...newProto, steps });
    };

    const saveProtocol = async () => {
        if (!newProto.name || newProto.steps.length === 0) return;
        const res = await fetch('/api/protocols', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newProto)
        });
        if (res.ok) {
            setIsCreating(false);
            setNewProto({ name: '', steps: [] });
            fetchProtocols();
        }
    };

    const executeProtocol = async (id: string) => {
        setIsExecuting(id);
        try {
            const res = await fetch(`/api/protocols/execute/${id}`, { method: 'POST' });
            if (res.ok) {
                alert("Protocol sequence injected into Mission Queue.");
            }
        } finally {
            setIsExecuting(null);
        }
    };

    return (
        <div className="space-y-10 animate-in fade-in pb-20">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-4xl font-black text-white tracking-tighter mb-1 uppercase italic">Runbook protocols</h2>
                    <p className="text-sm text-gray-500 font-medium">Chain complex multi-agent missions into executable autonomous pipelines.</p>
                </div>
                <button 
                    onClick={() => setIsCreating(true)}
                    className="bg-google-blue text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center gap-3 hover:scale-105 transition-all"
                >
                    <Plus size={18} /> New Protocol
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-1 space-y-6">
                    {isCreating ? (
                        <div className="bg-dark-800 p-8 rounded-[2.5rem] border border-google-blue/30 shadow-2xl space-y-8 animate-in slide-in-from-left-4">
                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Runbook Name</label>
                                <input 
                                    value={newProto.name}
                                    onChange={e => setNewProto({...newProto, name: e.target.value})}
                                    className="w-full bg-dark-900 border border-dark-700 p-4 rounded-xl focus:border-google-blue outline-none text-sm text-white"
                                    placeholder="e.g. SEO Content Pipeline v1"
                                />
                            </div>

                            <div className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500">Mission Sequence</h4>
                                    <button onClick={addStep} className="text-google-blue hover:text-white transition-colors"><Plus size={16} /></button>
                                </div>
                                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
                                    {newProto.steps.map((step, idx) => (
                                        <div key={idx} className="p-4 bg-dark-900 rounded-2xl border border-dark-700 space-y-3 relative group">
                                            <div className="flex gap-2">
                                                <select 
                                                    value={step.agentId}
                                                    onChange={e => updateStep(idx, 'agentId', e.target.value)}
                                                    className="bg-dark-800 border border-dark-700 p-2 rounded-lg text-[9px] font-black uppercase text-google-blue outline-none"
                                                >
                                                    <option value="design">Design</option>
                                                    <option value="seo">SEO</option>
                                                </select>
                                                <input 
                                                    value={step.taskName}
                                                    onChange={e => updateStep(idx, 'taskName', e.target.value)}
                                                    className="flex-1 bg-dark-800 border border-dark-700 p-2 rounded-lg text-[10px] font-bold text-white outline-none"
                                                    placeholder="Task Name"
                                                />
                                            </div>
                                            <textarea 
                                                value={step.instruction}
                                                onChange={e => updateStep(idx, 'instruction', e.target.value)}
                                                className="w-full bg-dark-800 border border-dark-700 p-3 rounded-lg text-[10px] text-gray-400 outline-none h-20 resize-none"
                                                placeholder="Instructional prompt..."
                                            />
                                        </div>
                                    ))}
                                    {newProto.steps.length === 0 && (
                                        <div className="py-10 border-2 border-dashed border-dark-700 rounded-2xl text-center opacity-20">
                                            <span className="text-[10px] font-black uppercase">No Steps Defined</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <button 
                                    onClick={saveProtocol}
                                    className="flex-1 py-4 bg-google-green text-dark-900 rounded-2xl font-black uppercase tracking-widest shadow-lg flex items-center justify-center gap-2"
                                >
                                    <Save size={16} /> Commit Protocol
                                </button>
                                <button 
                                    onClick={() => setIsCreating(false)}
                                    className="px-6 py-4 bg-dark-700 text-gray-300 rounded-2xl font-black uppercase text-[10px]"
                                >
                                    Abort
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-dark-800 p-8 rounded-[2.5rem] border border-dark-700 shadow-2xl flex flex-col items-center justify-center text-center gap-6 opacity-60">
                            <ListTree size={64} className="text-gray-700" />
                            <div className="space-y-2">
                                <h3 className="text-sm font-black text-white uppercase">Protocol Foundry</h3>
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest">Awaiting Runbook Definition</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="lg:col-span-2 space-y-8">
                    {protocols.map(proto => (
                        <div key={proto.id} className="bg-dark-800 rounded-[2.5rem] border border-dark-700 shadow-2xl overflow-hidden group hover:border-google-blue/30 transition-all">
                            <div className="p-8 border-b border-dark-700 flex justify-between items-center bg-dark-900/40">
                                <div className="flex items-center gap-5">
                                    <div className="p-4 bg-google-blue/10 rounded-2xl border border-google-blue/20">
                                        <Bot className="text-google-blue" size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-white">{proto.name}</h3>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-google-blue">{proto.steps.length} Parallel Missions</span>
                                            <span className="text-[9px] text-gray-600 font-mono">#{proto.id}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button 
                                        onClick={() => executeProtocol(proto.id)}
                                        disabled={!!isExecuting}
                                        className="bg-google-green text-dark-900 px-8 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:scale-105 transition-all shadow-lg"
                                    >
                                        {isExecuting === proto.id ? <Loader2 className="animate-spin" size={14} /> : <Zap size={14} />}
                                        Execute Sequence
                                    </button>
                                    <button className="p-3 bg-dark-900 border border-dark-700 rounded-xl text-gray-500 hover:text-google-red transition-colors">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                            <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {proto.steps.map((step, idx) => (
                                    <div key={idx} className="p-5 bg-dark-900 rounded-2xl border border-dark-700 flex items-start gap-4">
                                        <div className="w-6 h-6 rounded-full bg-dark-800 border border-dark-700 flex items-center justify-center text-[10px] font-black text-gray-500 shrink-0">
                                            {idx + 1}
                                        </div>
                                        <div className="space-y-1 overflow-hidden">
                                            <div className="text-[9px] font-black uppercase text-google-blue tracking-tighter">{step.agentId} Node</div>
                                            <div className="text-[11px] font-bold text-white truncate">{step.taskName}</div>
                                            <p className="text-[10px] text-gray-500 line-clamp-2 italic">"{step.instruction}"</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {protocols.length === 0 && !isLoading && (
                        <div className="h-[400px] border-2 border-dashed border-dark-800 rounded-[3rem] flex flex-col items-center justify-center text-center p-20 opacity-20">
                            <Sparkles size={64} className="mb-6" />
                            <p className="text-sm font-black uppercase tracking-[0.3em]">Protocol Library Empty</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProtocolLab;
