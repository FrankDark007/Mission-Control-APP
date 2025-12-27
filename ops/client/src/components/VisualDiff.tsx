
import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Layers, Monitor, Layout, Save, Trash2, Camera, RefreshCw, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

const VisualDiff = () => {
    const [viewMode, setViewMode] = useState<'side-by-side' | 'overlay'>('side-by-side');
    const [opacity, setOpacity] = useState(50);
    const [baselines, setBaselines] = useState<any[]>([]);
    const [isCapturing, setIsCapturing] = useState(false);
    const [isComparing, setIsComparing] = useState<string | null>(null);
    const [liveSnapshots, setLiveSnapshots] = useState<Record<string, string>>({});

    const fetchBaselines = () => {
        fetch('/api/baselines')
            .then(res => res.json())
            .then(setBaselines)
            .catch(() => {});
    };

    useEffect(() => {
        fetchBaselines();
    }, []);

    const saveBaseline = async (name: string) => {
        if (!name) return;
        setIsCapturing(true);
        try {
            const res = await fetch('/api/baselines/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            if (res.ok) fetchBaselines();
        } finally {
            setIsCapturing(false);
        }
    };

    const runComparison = async (id: string) => {
        setIsComparing(id);
        try {
            const res = await fetch(`/api/baselines/compare/${id}`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                setLiveSnapshots(prev => ({ ...prev, [id]: data.liveImage }));
                fetchBaselines();
            }
        } finally {
            setIsComparing(null);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-4xl font-black text-white tracking-tighter mb-1 uppercase italic">Visual Delta</h2>
                    <p className="text-sm text-gray-500 font-medium">Pixel-perfect regression monitoring via Neural Vision Bridge.</p>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-4 p-1 bg-dark-800 rounded-2xl border border-dark-700">
                        <button 
                            onClick={() => setViewMode('side-by-side')}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === 'side-by-side' ? 'bg-google-blue text-white shadow-lg' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                            Side-by-Side
                        </button>
                        <button 
                            onClick={() => setViewMode('overlay')}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === 'overlay' ? 'bg-google-blue text-white shadow-lg' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                            Onion Skin
                        </button>
                    </div>
                    <button 
                        onClick={() => {
                            const n = prompt("Baseline Name:");
                            if (n) saveBaseline(n);
                        }}
                        disabled={isCapturing}
                        className="bg-google-blue text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all flex items-center gap-3 disabled:opacity-50"
                    >
                        {isCapturing ? <Loader2 className="animate-spin" size={18} /> : <Camera size={18} />}
                        Snapshot Baseline
                    </button>
                </div>
            </div>

            {viewMode === 'overlay' && (
                <div className="flex justify-center">
                    <div className="flex items-center gap-6 bg-dark-800 px-8 py-4 rounded-3xl border border-dark-700 shadow-xl">
                        <EyeOff size={18} className="text-gray-600" />
                        <input 
                            type="range" 
                            value={opacity} 
                            onChange={(e) => setOpacity(parseInt(e.target.value))} 
                            className="w-48 accent-google-blue h-1 bg-dark-700 rounded-full appearance-none cursor-pointer" 
                        />
                        <Eye size={18} className="text-google-blue" />
                        <span className="text-[10px] font-mono text-google-blue w-8 font-black">{opacity}%</span>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-10">
                {baselines.length === 0 && !isCapturing && (
                    <div className="p-32 border-2 border-dashed border-dark-800 rounded-[3rem] text-center opacity-10 flex flex-col items-center justify-center">
                        <Monitor size={80} className="mb-6" />
                        <p className="text-lg font-black uppercase tracking-widest">No Visual Baselines established</p>
                    </div>
                )}
                {baselines.map(snap => (
                    <div key={snap.id} className="bg-dark-800 rounded-[3rem] border border-dark-700 shadow-2xl overflow-hidden group hover:border-google-blue/20 transition-all flex flex-col">
                        <div className="p-8 border-b border-dark-700 flex justify-between items-center bg-dark-900/40">
                            <div className="flex items-center gap-5">
                                <div className="p-4 bg-dark-800 rounded-2xl border border-dark-700 group-hover:border-google-blue/40 transition-colors">
                                    <Layout className="text-google-blue" size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-white">{snap.name}</h3>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className="text-[9px] font-black uppercase text-gray-500 flex items-center gap-1.5"><Save size={10} /> {new Date(snap.date).toLocaleString()}</span>
                                        {snap.lastComparison && <span className="text-[9px] font-black uppercase text-google-blue flex items-center gap-1.5"><RefreshCw size={10} /> Latched: {new Date(snap.lastComparison).toLocaleTimeString()}</span>}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className={`px-6 py-3 rounded-2xl flex flex-col items-center shadow-inner ${snap.change > 2 ? 'bg-google-red/10 border border-google-red/20' : 'bg-google-green/10 border border-google-green/20'}`}>
                                    <span className="text-[8px] font-black uppercase tracking-widest text-gray-500 mb-0.5">Neural Variance</span>
                                    <span className={`text-lg font-black ${snap.change > 2 ? 'text-google-red' : 'text-google-green'}`}>{snap.change.toFixed(2)}%</span>
                                </div>
                                <button 
                                    onClick={() => runComparison(snap.id)}
                                    disabled={isComparing === snap.id}
                                    className="p-4 bg-dark-900 border border-dark-700 text-white rounded-2xl hover:bg-google-blue transition-all disabled:opacity-50"
                                >
                                    {isComparing === snap.id ? <Loader2 size={20} className="animate-spin" /> : <RefreshCw size={20} />}
                                </button>
                                <button className="p-4 bg-dark-900 border border-dark-700 text-gray-500 hover:text-google-red transition-all rounded-2xl">
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="relative aspect-video bg-black flex items-center justify-center">
                            {viewMode === 'side-by-side' ? (
                                <div className="absolute inset-0 grid grid-cols-2 divide-x divide-dark-700">
                                    <div className="relative bg-dark-900 group/img overflow-hidden">
                                        <div className="absolute top-6 left-6 z-10 text-[9px] font-black uppercase bg-google-blue text-white px-4 py-1.5 rounded-full shadow-2xl border border-white/10">Master Baseline</div>
                                        <img src={snap.image} className="w-full h-full object-contain opacity-70 transition-transform duration-700 group-hover/img:scale-105" alt="Baseline" />
                                    </div>
                                    <div className="relative bg-dark-900 group/img overflow-hidden">
                                        <div className="absolute top-6 left-6 z-10 text-[9px] font-black uppercase bg-google-red text-white px-4 py-1.5 rounded-full shadow-2xl border border-white/10">Neural Live Probe</div>
                                        {liveSnapshots[snap.id] ? (
                                            <img src={liveSnapshots[snap.id]} className="w-full h-full object-contain transition-transform duration-700 group-hover/img:scale-105" alt="Live" />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center opacity-20 gap-4">
                                                <Monitor size={64} />
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em]">Awaiting Comparative Stream</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="w-full h-full relative bg-dark-900">
                                    <img src={snap.image} className="absolute inset-0 w-full h-full object-contain grayscale opacity-30" alt="Reference" />
                                    {liveSnapshots[snap.id] && (
                                        <img 
                                            src={liveSnapshots[snap.id]} 
                                            className="absolute inset-0 w-full h-full object-contain transition-opacity duration-300" 
                                            style={{ opacity: opacity / 100 }} 
                                            alt="Overlay Live" 
                                        />
                                    )}
                                    {!liveSnapshots[snap.id] && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center opacity-10 gap-4">
                                            <Monitor size={64} />
                                            <p className="text-[10px] font-black uppercase tracking-widest">Run Probe to Engage Overlay</p>
                                        </div>
                                    )}
                                    <div className="absolute inset-0 border-8 border-dashed border-google-blue/10 pointer-events-none" />
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-dark-900/50 flex justify-between items-center">
                            <div className="flex gap-4">
                                <div className="flex items-center gap-2 text-[10px] font-black uppercase text-gray-500">
                                    <CheckCircle2 size={12} className="text-google-green" /> Layout Verified
                                </div>
                                <div className="flex items-center gap-2 text-[10px] font-black uppercase text-gray-500">
                                    <AlertCircle size={12} className={snap.change > 2 ? 'text-google-red' : 'text-gray-700'} /> Drifts Flagged
                                </div>
                            </div>
                            <div className="text-[9px] font-mono text-gray-600 tracking-tighter">ID: {snap.id}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default VisualDiff;
