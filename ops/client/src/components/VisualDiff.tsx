
import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Layers, Monitor, Layout, Save, Trash2, Camera, RefreshCw } from 'lucide-react';

const VisualDiff = () => {
    const [viewMode, setViewMode] = useState<'side-by-side' | 'overlay'>('side-by-side');
    const [opacity, setOpacity] = useState(50);
    const [baselines, setBaselines] = useState<any[]>([]);
    const [isCapturing, setIsCapturing] = useState(false);

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
        // Simulation of capturing the current page state - in production, this uses a hidden canvas of the site
        const mockImg = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
        
        try {
            const res = await fetch('/api/baselines/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, image: mockImg })
            });
            const data = await res.json();
            if (data.success) {
                fetchBaselines();
            }
        } finally {
            setIsCapturing(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4 p-1 bg-dark-800 rounded-2xl border border-dark-700">
                    <button 
                        onClick={() => setViewMode('side-by-side')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${viewMode === 'side-by-side' ? 'bg-google-blue text-white shadow-lg' : 'text-gray-400 hover:text-gray-200'}`}
                    >
                        Side-by-Side
                    </button>
                    <button 
                        onClick={() => setViewMode('overlay')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${viewMode === 'overlay' ? 'bg-google-blue text-white shadow-lg' : 'text-gray-400 hover:text-gray-200'}`}
                    >
                        Onion Skin
                    </button>
                </div>
                
                <div className="flex items-center gap-4">
                    {viewMode === 'overlay' && (
                        <div className="flex items-center gap-4 bg-dark-800 px-6 py-2 rounded-2xl border border-dark-700">
                            <EyeOff size={16} className="text-gray-600" />
                            <input type="range" value={opacity} onChange={(e) => setOpacity(parseInt(e.target.value))} className="w-32 accent-google-blue cursor-pointer" />
                            <Eye size={16} className="text-google-blue" />
                        </div>
                    )}
                    <button 
                        onClick={() => {
                            const n = prompt("Baseline Name:");
                            if (n) saveBaseline(n);
                        }}
                        disabled={isCapturing}
                        className="bg-google-blue border border-google-blue text-white px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center gap-2 shadow-lg disabled:opacity-50"
                    >
                        {isCapturing ? <RefreshCw className="animate-spin" size={16} /> : <Camera size={16} />}
                        Snapshot Baseline
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-10">
                {baselines.length === 0 && (
                    <div className="p-20 border-2 border-dashed border-dark-700 rounded-[2rem] text-center opacity-30 flex flex-col items-center">
                        <Monitor size={64} className="mb-6 text-gray-500" />
                        <p className="text-sm font-black uppercase tracking-widest">No baselines established</p>
                    </div>
                )}
                {baselines.map(snap => (
                    <div key={snap.id} className="bg-dark-800 p-8 rounded-[3rem] border border-dark-700 shadow-2xl relative overflow-hidden group hover:border-google-blue/20 transition-all">
                        <div className="flex justify-between items-start mb-8">
                            <div className="flex items-center gap-5">
                                <div className="p-4 bg-dark-900 rounded-2xl border border-dark-700 group-hover:border-google-blue/40 transition-colors">
                                    <Layout className="text-google-blue" size={28} />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-white tracking-tight">{snap.name}</h3>
                                    <div className="text-[10px] text-gray-500 font-mono flex items-center gap-2 mt-1">
                                        <Save size={10} /> Established: {new Date(snap.date).toLocaleString()}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className={`px-5 py-3 rounded-2xl flex flex-col items-center ${snap.change > 5 ? 'bg-google-red/10 border border-google-red/20' : 'bg-google-green/10 border border-google-green/20'}`}>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Visual Delta</span>
                                    <span className={`text-xl font-black ${snap.change > 5 ? 'text-google-red' : 'text-google-green'}`}>{snap.change.toFixed(1)}%</span>
                                </div>
                                <button className="p-3 text-gray-600 hover:text-google-red hover:bg-google-red/10 rounded-xl transition-all">
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="relative aspect-video bg-dark-900 rounded-[2rem] border border-dark-700 overflow-hidden shadow-inner flex items-center justify-center">
                            {viewMode === 'side-by-side' ? (
                                <div className="absolute inset-0 grid grid-cols-2 divide-x divide-dark-700">
                                    <div className="relative p-4">
                                        <div className="absolute top-4 left-4 z-10 text-[9px] font-black uppercase bg-google-blue px-3 py-1 rounded-full shadow-lg">Baseline</div>
                                        <div className="w-full h-full bg-dark-800/50 rounded-xl flex items-center justify-center">
                                            <Monitor size={48} className="text-dark-700 opacity-20" />
                                        </div>
                                    </div>
                                    <div className="relative p-4">
                                        <div className="absolute top-4 left-4 z-10 text-[9px] font-black uppercase bg-google-red px-3 py-1 rounded-full shadow-lg">Live Actual</div>
                                        <div className="w-full h-full bg-dark-800/50 rounded-xl flex items-center justify-center overflow-hidden">
                                            <Monitor size={48} className="text-dark-700 opacity-20" />
                                            {snap.change > 5 && <div className="absolute top-1/4 right-1/4 w-32 h-32 border-2 border-google-red/50 bg-google-red/5 animate-pulse rounded-2xl" />}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="w-full h-full relative">
                                    <div className="absolute inset-0 bg-dark-800 flex items-center justify-center opacity-40">
                                        <Monitor size={120} className="text-dark-700" />
                                    </div>
                                    <div 
                                        className="absolute inset-0 bg-google-blue/10 flex items-center justify-center"
                                        style={{ opacity: opacity / 100 }}
                                    >
                                        <div className="w-full h-full border-4 border-dashed border-google-blue/20" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default VisualDiff;
