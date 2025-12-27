
import React, { useState, useEffect } from 'react';
import { Settings, Plus, Key, Cpu, Trash2, Edit3, Save, RefreshCw, Activity, ShieldCheck, Zap } from 'lucide-react';

const ModelsLab = () => {
    const [models, setModels] = useState<any[]>([]);
    const [isAdding, setIsAdding] = useState(false);

    const fetchModels = () => {
        fetch('/api/models')
            .then(res => res.json())
            .then(setModels);
    };

    useEffect(() => {
        fetchModels();
    }, []);

    return (
        <div className="space-y-10 animate-in fade-in duration-500">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-4xl font-black text-white tracking-tighter mb-1">Model Registry</h2>
                    <p className="text-sm text-gray-500 font-medium">Neural engine configuration and provider orchestration.</p>
                </div>
                <button onClick={() => setIsAdding(true)} className="bg-google-blue text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center gap-3">
                    <Plus size={18} /> Register Model
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {models.map(model => (
                    <div key={model.id} className="bg-dark-800 p-8 rounded-[2rem] border border-dark-700 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="flex gap-2">
                                <button className="p-2 text-gray-500 hover:text-white transition-colors"><Edit3 size={16} /></button>
                                <button className="p-2 text-gray-500 hover:text-google-red transition-colors"><Trash2 size={16} /></button>
                            </div>
                        </div>

                        <div className="flex justify-between items-start mb-8">
                            <div className={`p-4 rounded-2xl ${model.provider === 'google' ? 'bg-google-blue/10 text-google-blue' : 'bg-google-green/10 text-google-green'}`}>
                                <Cpu size={28} />
                            </div>
                            <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${model.apiKeyEnv ? 'bg-google-green/10 text-google-green' : 'bg-google-yellow/10 text-google-yellow'}`}>
                                <Key size={12} /> {model.apiKeyEnv ? 'Linked' : 'Missing Key'}
                            </div>
                        </div>

                        <h3 className="text-xl font-black text-white mb-2">{model.name}</h3>
                        <p className="text-xs text-gray-500 font-mono mb-8 uppercase tracking-tighter">{model.apiModelId}</p>

                        <div className="space-y-4 pt-6 border-t border-dark-700">
                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-gray-500">
                                <span>Provider</span>
                                <span className="text-white">{model.provider}</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-gray-500">
                                <span>Status</span>
                                <span className="text-google-green flex items-center gap-1">
                                    <Activity size={10} /> Operational
                                </span>
                            </div>
                        </div>

                        <button className="w-full mt-8 py-4 bg-dark-900 border border-dark-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-dark-700 transition-all flex items-center justify-center gap-2">
                            <RefreshCw size={14} /> Test Connectivity
                        </button>
                    </div>
                ))}

                {/* Simulated specialized model slots */}
                <div className="bg-dark-800/30 p-8 rounded-[2rem] border border-dashed border-dark-700 flex flex-col items-center justify-center text-center group hover:border-google-blue/50 transition-all">
                    <ShieldCheck className="text-gray-700 mb-4 group-hover:text-google-blue transition-colors" size={48} />
                    <h4 className="text-sm font-black text-gray-600 uppercase tracking-widest">Add Reasoning Engine</h4>
                </div>
            </div>
        </div>
    );
};

export default ModelsLab;
