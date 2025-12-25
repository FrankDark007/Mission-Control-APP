
import React, { useState } from 'react';
import { Eye, EyeOff, Layers, Monitor, Smartphone, Layout, ArrowRight } from 'lucide-react';

const VisualDiff = () => {
    const [viewMode, setViewMode] = useState<'side-by-side' | 'overlay'>('side-by-side');
    const [opacity, setOpacity] = useState(50);

    // Mock data for restoration
    const snaps = [
        { id: 1, name: 'Home Layout', change: 2.4, date: '2024-12-24' },
        { id: 2, name: 'Contact Form', change: 12.8, date: '2024-12-24' },
        { id: 3, name: 'Service Grid', change: 0.1, date: '2024-12-24' }
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4 p-1 bg-dark-800 rounded-2xl border border-dark-700">
                    <button 
                        onClick={() => setViewMode('side-by-side')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${viewMode === 'side-by-side' ? 'bg-google-blue text-white shadow-lg' : 'text-gray-500'}`}
                    >
                        Side-by-Side
                    </button>
                    <button 
                        onClick={() => setViewMode('overlay')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${viewMode === 'overlay' ? 'bg-google-blue text-white shadow-lg' : 'text-gray-500'}`}
                    >
                        Onion Skin
                    </button>
                </div>
                {viewMode === 'overlay' && (
                    <div className="flex items-center gap-4 bg-dark-800 px-6 py-2 rounded-2xl border border-dark-700">
                        <EyeOff size={16} className="text-gray-600" />
                        <input type="range" value={opacity} onChange={(e) => setOpacity(parseInt(e.target.value))} className="w-32 accent-google-blue" />
                        <Eye size={16} className="text-google-blue" />
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 gap-10">
                {snaps.map(snap => (
                    <div key={snap.id} className="bg-dark-800 p-8 rounded-[2rem] border border-dark-700 shadow-2xl relative overflow-hidden group">
                        <div className="flex justify-between items-start mb-8">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-dark-900 rounded-xl border border-dark-700">
                                    <Layout className="text-google-blue" size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white tracking-tight">{snap.name}</h3>
                                    <div className="text-[10px] text-gray-500 font-mono">Ref: dec-24-baseline.png</div>
                                </div>
                            </div>
                            <div className={`px-4 py-2 rounded-2xl flex flex-col items-center ${snap.change > 5 ? 'bg-google-red/10 border border-google-red/20' : 'bg-google-green/10 border border-google-green/20'}`}>
                                <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Visual Delta</span>
                                <span className={`text-lg font-black ${snap.change > 5 ? 'text-google-red' : 'text-google-green'}`}>{snap.change}%</span>
                            </div>
                        </div>

                        {viewMode === 'side-by-side' ? (
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-google-blue" /> Baseline (Expected)
                                    </div>
                                    <div className="aspect-video bg-dark-900 rounded-2xl border border-dark-700 flex items-center justify-center relative overflow-hidden">
                                        <Monitor size={48} className="text-dark-700 opacity-20" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-dark-900/80 to-transparent" />
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-google-red" /> Current (Actual)
                                    </div>
                                    <div className="aspect-video bg-dark-900 rounded-2xl border border-dark-700 flex items-center justify-center relative overflow-hidden">
                                        <Monitor size={48} className="text-dark-700 opacity-20" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-dark-900/80 to-transparent" />
                                        {/* Highlight mask overlay simulation */}
                                        <div className="absolute top-10 left-10 w-20 h-20 bg-google-red/20 border-2 border-google-red/50 animate-pulse rounded-lg" />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="relative aspect-video bg-dark-900 rounded-3xl border border-dark-700 overflow-hidden shadow-inner flex items-center justify-center">
                                <Monitor size={64} className="text-dark-700 opacity-10" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-[10px] font-black uppercase tracking-[1em] text-dark-600">Visual Diff Engine</span>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default VisualDiff;
