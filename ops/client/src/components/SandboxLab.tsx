
import React, { useState } from 'react';
import { Beaker, Send, Zap, Brain, Cpu, Clock, Layers, Sparkles, Loader2, Info, ChevronRight, LayoutGrid, SplitSquareVertical, ArrowUpCircle } from 'lucide-react';

const SandboxLab = () => {
    const [globalPrompt, setGlobalPrompt] = useState('');
    const [systemInstruction, setSystemInstruction] = useState('You are a tactical operations expert. Provide concise, actionable architectural advice.');
    const [isBroadcasting, setIsBroadcasting] = useState(false);
    const [results, setResults] = useState<any>({
        flash: { content: null, loading: false, latency: 0, tokens: 0 },
        pro: { content: null, loading: false, latency: 0, tokens: 0 }
    });

    const runComparison = async () => {
        if (!globalPrompt.trim()) return;
        setIsBroadcasting(true);
        setResults({
            flash: { ...results.flash, loading: true, content: null },
            pro: { ...results.pro, loading: true, content: null }
        });

        const models = [
            { id: 'flash', name: 'gemini-3-flash-preview' },
            { id: 'pro', name: 'gemini-3-pro-preview' }
        ];

        await Promise.all(models.map(async (m) => {
            try {
                const mStart = Date.now();
                const res = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: globalPrompt,
                        model: m.name,
                        systemInstruction,
                        thinkingBudget: m.id === 'pro' ? 16000 : 0
                    })
                });
                const data = await res.json();
                const mEnd = Date.now();

                setResults((prev: any) => ({
                    ...prev,
                    [m.id]: {
                        content: data.content,
                        loading: false,
                        latency: mEnd - mStart,
                        tokens: Math.floor(data.content.length / 4)
                    }
                }));
            } catch (e) {
                setResults((prev: any) => ({
                    ...prev,
                    [m.id]: { content: "Transmission Error", loading: false, latency: 0, tokens: 0 }
                }));
            }
        }));

        setIsBroadcasting(false);
    };

    const promoteToStrategy = async () => {
        if (!globalPrompt.trim()) return;
        const name = prompt("Strategy Name:");
        if (!name) return;

        await fetch('/api/prompts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                name, 
                content: globalPrompt, 
                tags: ['sandbox-promotion'] 
            })
        });
        alert("Strategy Registered successfully.");
    };

    return (
        <div className="space-y-10 animate-in fade-in duration-500 pb-20">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-4xl font-black text-white tracking-tighter mb-1 uppercase italic">Neural Sandbox</h2>
                    <p className="text-sm text-gray-500 font-medium">A/B test strategic prompts across the swarm's processing nodes.</p>
                </div>
                <div className="flex gap-4">
                    <button 
                        onClick={promoteToStrategy}
                        disabled={!globalPrompt.trim()}
                        className="bg-google-yellow text-dark-900 px-6 py-3 rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center gap-2 hover:scale-105 transition-all disabled:opacity-50"
                    >
                        <ArrowUpCircle size={16} /> Promote to Strategy
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-dark-800 p-8 rounded-[2.5rem] border border-dark-700 shadow-2xl space-y-6">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                                <Sparkles size={12} className="text-google-yellow" /> Neural Context
                            </label>
                            <textarea 
                                value={systemInstruction}
                                onChange={(e) => setSystemInstruction(e.target.value)}
                                className="w-full bg-dark-900 border border-dark-700 p-4 rounded-xl focus:border-google-blue outline-none text-[11px] text-gray-400 h-32 resize-none shadow-inner"
                                placeholder="System instructions for all nodes..."
                            />
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                                <Zap size={12} className="text-google-blue" /> Command Input
                            </label>
                            <textarea 
                                value={globalPrompt}
                                onChange={(e) => setGlobalPrompt(e.target.value)}
                                className="w-full bg-dark-900 border border-dark-700 p-4 rounded-xl focus:border-google-blue outline-none text-sm text-white h-48 resize-none shadow-inner"
                                placeholder="Enter a tactical command to broadcast..."
                            />
                        </div>

                        <button 
                            onClick={runComparison}
                            disabled={isBroadcasting || !globalPrompt.trim()}
                            className="w-full py-5 bg-google-blue text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl flex items-center justify-center gap-3 hover:scale-[1.02] transition-all disabled:opacity-50"
                        >
                            {isBroadcasting ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                            Broadcast Command
                        </button>
                    </div>
                </div>

                <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-8 h-full">
                    {['flash', 'pro'].map(mId => (
                        <div key={mId} className={`bg-dark-800 rounded-[2.5rem] border transition-all duration-500 flex flex-col overflow-hidden ${results[mId].loading ? 'border-google-blue/50 shadow-[0_0_30px_rgba(26,115,232,0.1)]' : 'border-dark-700'}`}>
                            <div className="p-8 border-b border-dark-700 bg-dark-900/40 flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-xl ${mId === 'flash' ? 'bg-google-blue/10 text-google-blue' : 'bg-google-yellow/10 text-google-yellow'}`}>
                                        {mId === 'flash' ? <Zap size={20} /> : <Brain size={20} />}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-white">{mId === 'flash' ? 'Gemini 3 Flash' : 'Gemini 3 Pro'}</h3>
                                        <p className="text-[9px] font-black uppercase text-gray-500">{mId === 'flash' ? 'High-Speed' : 'Complex reasoning'}</p>
                                    </div>
                                </div>
                                {results[mId].latency > 0 && (
                                    <div className="text-right">
                                        <div className="text-[8px] font-black text-google-blue uppercase">{results[mId].latency}ms</div>
                                        <div className="text-[8px] font-black text-gray-600 uppercase">Latency</div>
                                    </div>
                                )}
                            </div>
                            <div className="p-10 flex-1 relative">
                                {results[mId].loading ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                                        <Loader2 className="animate-spin text-google-blue" size={40} />
                                    </div>
                                ) : results[mId].content ? (
                                    <div className="prose prose-invert prose-sm max-w-none">
                                        <p className="text-gray-300 leading-relaxed text-xs italic">"{results[mId].content}"</p>
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center opacity-10 text-center gap-4">
                                        <Layers size={64} />
                                        <p className="text-[10px] font-black uppercase tracking-widest">Awaiting Inference</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SandboxLab;
